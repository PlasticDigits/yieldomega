// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits, type TransactionReceipt } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { readContract } from "wagmi/actions";
import { optimisticArenaWalletBuyStats } from "@/hooks/useWalletStats";
import { xpGainFromBuyReceiptLogs } from "@/lib/arenaWalletXpOptimistic";
import { xpForCharm } from "@/lib/arenaXpMath";
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { extractHttpResponseStatus } from "@/lib/extractHttpResponseStatus";
import { reportRpcFetchAttempt, reportRpcRateLimited } from "@/lib/rpcConnectivity";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import {
  erc20Abi,
  timeArenaBuyEventAbi,
  timeArenaReadAbi,
  timeArenaWriteAbi,
} from "@/lib/abis";
import {
  defaultArenaPayWith,
  defaultPayTokenDecimals,
  directArenaSpendLabel,
  isDirectArenaSpendPay,
  payUsesKumbayaRoute,
} from "@/lib/arenaPayAsset";
import { readArenaDoubUnlimitedApproval } from "@/lib/arenaDoubApprovalPreference";
import { ensureDoubTimeArenaAllowance } from "@/lib/ensureDoubTimeArenaAllowance";
import { useKumbayaExactOutputQuote } from "@/hooks/useKumbayaExactOutputQuote";
import {
  cl8ySpendWeiFromPayTokenBudget,
  cl8ySpendWeiFromPayTokenFallback,
} from "@/lib/kumbayaCl8ySpendFromPayToken";
import { type WalletWriteAsync } from "@/lib/timeArenaKumbayaSingleTx";
import { submitArenaKumbayaSingleTxBuy } from "@/lib/timeArenaKumbayaSingleTx";
import { resolveReferralCodeHashForBuy } from "@/lib/referralBuyPreflight";
import { clearPendingReferralCode } from "@/lib/referralStorage";
import {
  type KumbayaEnv,
  type PayWithAsset,
  resolveKumbayaRouting,
  resolveTimeArenaBuyRouterForKumbayaSingleTx,
  routingForArenaPayAsset,
} from "@/lib/kumbayaRoutes";
import { usePendingReferralCode } from "@/hooks/usePendingReferralCode";
import { kumbayaBuyDebugError, logKumbayaBuyDebugHelpOnce } from "@/lib/kumbayaBuyDebug";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import {
  captureWalletBuySession,
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
} from "@/lib/walletBuySessionGuard";
import { finalizeCharmSpendForBuy, reconcileSpendWeiToCl8yBounds } from "@/lib/timeArenaBuyAmount";
import { isArenaBuySpendDefaultMin } from "@/lib/timeArenaBuySpendDefault";
import {
  arenaPaySpendInputCompactFractionDigits,
  formatArenaPaySpendInputDisplay,
} from "@/lib/timeArenaPaySpendInputFormat";
import { assertSuccessfulBuyReceipt } from "@/lib/timeArenaBuyReceipt";
import { deriveWarbowClaimFlagFields } from "@/lib/warbowClaimFlagState";
import {
  buyCooldownWallUntilMsFromNow,
  chainSecondsAtReceiptBlock,
} from "@/lib/timeArenaBuyCooldownUx";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import {
  resolveCl8yCheckoutBoundsGate,
  type Cl8yCheckoutBoundsGate,
} from "@/lib/timeArenaCl8yCheckoutBounds";
import {
  doubSpendWeiFromCredPayTarget,
  doubSpendWeiFromPayTokenSliderTarget,
  payTokenWeiAtSliderPermille,
  payTokenWeiForDoubSpend,
  payTokenWeiFromCachedQuoteRate,
  resolveArenaPayTokenDisplayWei,
  resolveArenaPayTokenSpendBand,
  sliderPermilleForPayTokenWei,
} from "@/lib/arenaPayTokenSpendBand";
import {
  credBurnForCharmWad,
  resolveCredCheckoutBoundsGate,
  type CredCheckoutBoundsGate,
} from "@/lib/arenaCredBurn";
import { useArenaPlayCred } from "@/hooks/useArenaPlayCred";
import {
  arenaV2CoreContracts,
  arenaV2UserContracts,
  coreReadRowsFromArenaTimers,
  isTimeArenaV2,
  mapArenaV2CoreRows,
  mapArenaV2UserRows,
} from "@/pages/arena/arenaV2SaleSessionBridge";
import { useArenaHeroTimer } from "@/pages/arena/useArenaHeroTimer";
import {
  coreReadRowsFromSaleState,
  useArenaSaleStateQuery,
  useArenaTimersQuery,
} from "@/pages/arena/useArenaSaleState";
import type { EnvelopeCurveParamsWire } from "@/lib/timeArenaBuyDisplay";
import {
  derivePhase,
  ledgerSecIntForPhase,
  arenaHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/arena/arenaSimplePhase";
import { ARENA_CHARM_MIN_WAD, ARENA_CHARM_MAX_WAD, ARENA_REFERRAL_FLAT_CRED_WAD } from "@/lib/arenaConstants";
import { formatBuyProjectedGuideCredLine } from "@/pages/arena/arenaBuyProjectedEffects";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import { wagmiConfig } from "@/wagmi-config";
import type { HexAddress } from "@/lib/addresses";
import {
  DEFAULT_ARENA_BUY_PREVIEW_POLICY,
  type ArenaBuyPreviewPolicy,
} from "@/lib/timeArenaBuyPreview";
import { arenaSaleSessionBuyPreflight } from "@/pages/arena/arenaSaleSessionBuyPreflight";

export type { SaleSessionPhase };

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

function clampBigint(x: bigint, lo: bigint, hi: bigint): bigint {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

function hexAddressFromRead(v: unknown): HexAddress | undefined {
  if (typeof v !== "string" || !v.startsWith("0x") || v.length !== 42) {
    return undefined;
  }
  return v as HexAddress;
}

function isNonZeroHexAddress(v: unknown): boolean {
  const a = hexAddressFromRead(v);
  return Boolean(a && a.toLowerCase() !== "0x0000000000000000000000000000000000000000");
}

/**
 * Minimal sale-session reads + buy handler tailored for the **simple Time Arena view**.
 *
 * Invariants:
 * - Reads only public view functions on TimeArena / accepted-asset ERC20.
 * - The buy handler calls the same `TimeArena.buy(charmWad)` /
 *   `buy(charmWad, codeHash)` write paths used by the legacy/Arena page, or
 *   **`TimeArenaBuyRouter.buyViaKumbaya`** when `timeArenaBuyRouter` is set and pay mode is
 *   ETH/USDM (issue #66) — one tx replacing swap + `buy` while preserving sale semantics.
 * - With `VITE_INDEXER_URL`, global sale reads use `GET /v1/arena/timers` (Arena v2) or
 *   legacy sale-state mapping; browser RPC multicall is not used for display head ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)).
 * - **`submitBuy`** latches **`getAccount(wagmi)`** after submit-time sizing and
 *   aborts when the wallet **disconnects**, **switches accounts**, or **changes
 *   chains** mid-flow ([GitLab #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144)).
 */
export type UseArenaSaleSession = {
  ready: boolean;
  phase: SaleSessionPhase;
  isPending: boolean;
  isError: boolean;
  saleStartSec: number | undefined;
  deadlineSec: number | undefined;
  ended: boolean | undefined;
  /** Decimals of the accepted spend asset (DOUB on Arena v2). 18 until reads land. */
  decimals: number;
  /** Last-good `acceptedAsset()` address (latched across flaky multicall rows). */
  acceptedAsset: HexAddress | undefined;
  /** `podiumPool()` when read succeeds. */
  podiumPoolAddress: HexAddress | undefined;
  /** Decimals of the launched token (DOUB at launch). 18 until reads land. */
  launchedDec: number;
  walletConnected: boolean;
  walletAddress: HexAddress | undefined;
  walletBalanceWei: bigint | undefined;
  /** Manual one-shot `balanceOf` refresh for the active pay asset ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)). */
  refetchWalletBalance: () => void;
  walletBalanceRefreshing: boolean;
  cl8ySpendBounds: { minS: bigint; maxS: bigint } | null;
  /** Distinguishes live bounds loading from insufficient direct spend token. */
  cl8yCheckoutBoundsGate: Cl8yCheckoutBoundsGate;
  spendWei: bigint;
  spendInputStr: string;
  /** Decimals for the spend amount text field (direct spend token or routed pay token). */
  spendInputDecimals: number;
  setSpendFromInput: (raw: string) => void;
  setSpendFromInputFocus: () => void;
  setSpendFromInputBlur: () => void | Promise<void>;
  setSpendFromSliderPermille: (permille: number) => void;
  /** Call while the spend slider thumb is dragged so quote sync does not fight the control. */
  setSpendSliderInteracting: (interacting: boolean) => void;
  spendSliderPermille: number;
  charmWadSelected: bigint | undefined;
  estimatedSpendWei: bigint | undefined;
  /**
   * Total CHARM **weight** credited to the buyer for this checkout (`charmWadSelected` plus onchain referral
   * buyer tranche when referral registry is on).
   */
  buyCheckoutCharmWeightWad: bigint | undefined;
  /** Bonus caption lines under the buy preview (referral code, presale). Empty when none apply. */
  buyCharmBonusPreviewLines: readonly string[];
  /** Pre-start countdown — uses chain time for `saleStart - now`. */
  preStartCountdownSec: number | undefined;
  /** Live sale countdown — uses the shared `useArenaHeroTimer` skew. */
  saleCountdownSec: number | undefined;
  /** Last Buy timer armed; false when epoch timer awaits first buy ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)). */
  lastBuyTimerArmed: boolean | undefined;
  /** Hero placeholder when Last Buy timer is unarmed ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)). */
  heroCountdownPlaceholder: string | undefined;
  /** Wall-vs-chain skewed `chain time` shared with the hero timer. */
  chainNowSec: number | undefined;
  /**
   * Capped timer extension preview (matches Arena `timerExtensionPreview`) for buy
   * checkout chips during an active sale.
   */
  timerExtensionPreviewSec: number | undefined;
  /**
   * Onchain timer + WarBow constants for buy projected-effects preview (GitLab #227).
   * `undefined` until `timerExtensionSec` / `timerCapSec` reads succeed.
   */
  buyPreviewPolicy: ArenaBuyPreviewPolicy | undefined;
  /** `activeDefendedStreak(wallet)` for projected-effects copy; undefined until read succeeds. */
  activeDefendedStreak: bigint | undefined;
  warbowPendingFlagOwner: HexAddress | undefined;
  /** `0n` when unset or read pending — same semantics as Arena flag plant-at wiring. */
  warbowPendingFlagPlantAt: bigint;
  /** Wallet buy cooldown remaining (seconds). 0 when not gated or not connected. */
  walletCooldownRemainingSec: number;
  /** Current onchain buy-energy charges for the connected wallet, when available. */
  walletBuyCharges: number | undefined;
  /** Maximum stored buy-energy charges for the connected wallet, when available. */
  walletMaxBuyCharges: number | undefined;
  /** Next charge accrual timestamp from onchain buy-energy state, or 0 when capped/full. */
  walletNextBuyChargeAtSec: number | undefined;
  /** True during the full purchase flow after validations pass (includes mempool confirmation waits). */
  buySubmitBusy: boolean;
  totalRaisedWei: bigint | undefined;
  /** Live per-CHARM price in DOUB wei (Arena v2 `charmPriceWad`). */
  pricePerCharmWad: bigint | undefined;
  /** Fixed-price envelope for recent-buy min/max position displays. */
  buyEnvelopeParams: EnvelopeCurveParamsWire | null;
  referralRegistryOn: boolean;
  pendingReferralCode: string | null;
  useReferral: boolean;
  setUseReferral: (next: boolean) => void;
  /** Opt-in: this tx sets `warbowPendingFlag*` onchain ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). */
  plantWarBowFlag: boolean;
  setPlantWarBowFlag: (next: boolean) => void;
  /** WarBow flag silence + claim BP policy reads; undefined until core reads succeed. */
  warbowFlagClaimBp: bigint | undefined;
  warbowFlagSilenceSec: bigint | undefined;
  /** Pending flag holder with an active plant timestamp during a live sale. */
  showWarbowClaimFlagButton: boolean;
  canClaimWarBowFlag: boolean;
  warbowFlagSilenceEndSec: bigint;
  submitClaimWarBowFlag: () => Promise<void>;
  isWriting: boolean;
  buyError: string | null;
  clearBuyError: () => void;
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
  /** Active pay-token min/max band resolved for YOU PAY + slider (null while quotes load). */
  paySpendBandReady: boolean;
  /** Arena v2 mount — enables Play CRED pay (#269). */
  isArenaV2: boolean;
  /** `TimeArena.playCred()` or env override; unset when CRED buys unavailable. */
  playCredAddress: HexAddress | undefined;
  credBalanceWei: bigint | undefined;
  requiredCredBurnWei: bigint | undefined;
  credCheckoutBoundsGate: CredCheckoutBoundsGate;
  kumbayaRoutingBlocker: string | null;
  quotedPayInWei: bigint | undefined;
  payTokenDecimals: number;
  /**
   * True only before the **first** pay-token quote for the active asset is available.
   * Background refetches while sliding keep the last quote (hook `placeholderData` + latch)
   * and do **not** set this — buy stays enabled and the CTA label stays on "Buy".
   */
  swapQuoteLoading: boolean;
  /** Alias of {@link swapQuoteLoading} — same semantics; kept for readability at call sites (GitLab #56). */
  swapQuoteDisplayLoading: boolean;
  swapQuoteFailed: boolean;
  /**
   * Kumbaya `quoteExactOutput` for **one CHARM** (amount out = direct spend token), for the rate board.
   * Undefined while loading, on error, or when pay mode is direct spend / routing unavailable.
   */
  quotedPerCharmPayInWei: bigint | undefined;
  /** True until the first per-CHARM quoter value exists; avoids flicker on background refetch. */
  perCharmPayQuoteLoading: boolean;
  perCharmPayQuoteFailed: boolean;
  /** Kumbaya-quoted pay token for `cl8ySpendBounds.minS` / `maxS` (ETH/USDM band row). */
  quotedBandMinPayInWei: bigint | undefined;
  quotedBandMaxPayInWei: bigint | undefined;
  bandBoundaryQuotesLoading: boolean;
  /** Connected-wallet balance for the active pay asset (DOUB/CL8Y / native ETH / USDM). */
  payWalletBalance: { raw: bigint | undefined; decimals: number; symbol: string };
  /** Current Last Buy epoch CHARM weight for the connected wallet (`epochCharmWad`). */
  charmWalletBalanceWad: bigint | undefined;
  refetchCharmWalletBalance: () => void;
  charmWalletBalanceRefreshing: boolean;
  /** Submits optional Kumbaya `exactOutput` + approve + `buy(charmWad)` — same onchain buy as Arena. */
  submitBuy: () => Promise<void>;
  /** TimeArena operator pause — `true` when `paused()` onchain. */
  arenaPaused: boolean | undefined;
  onchainTimeArenaBuyRouter: HexAddress | undefined;
  refresh: () => void;
};

export function useArenaSaleSession(
  timeArenaAddress: HexAddress | undefined,
  options?: { forceArenaV2?: boolean },
): UseArenaSaleSession {
  const chainId = useChainId();
  const { address, isConnected, status: walletStatus } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { data: latestBlock } = useLatestBlock();

  const [spendWei, setSpendWei] = useState(0n);
  const [spendInputStr, setSpendInputStr] = useState("");
  const payInputFocusedRef = useRef(false);
  /** When true, YOU PAY uses compact decimals for slider/default (2 for stable tokens, 10 for ETH). */
  const paySpendInputCompactRef = useRef(true);
  /** Holds user-driven slider permille until pointer-up so quotes cannot jerk the thumb. */
  const spendSliderPermilleOverrideRef = useRef<number | null>(null);
  const spendSliderInteractingRef = useRef(false);
  const [spendSliderInteracting, setSpendSliderInteractingState] = useState(false);
  const [spendSliderInteractionEpoch, setSpendSliderInteractionEpoch] = useState(0);
  const [useReferral, setUseReferral] = useState(true);
  const [plantWarBowFlag, setPlantWarBowFlag] = useState(false);
  const pendingReferralCode = usePendingReferralCode();
  const [buyError, setBuyError] = useState<string | null>(null);
  const [payWith, setPayWithState] = useState<PayWithAsset>("doub");
  const prevPayWithRef = useRef<PayWithAsset>("doub");
  /** Last successful Kumbaya pay quote per asset — keeps buy CTA stable during slider refetch. */
  const [kumbayaPayQuoteLatch, setKumbayaPayQuoteLatch] = useState<
    Partial<Record<PayWithAsset, { payInWei: bigint; amountOutWei: bigint }>>
  >({});
  /** Keeps the quoter query warm while `estimatedSpendWei` briefly recomputes during slider drags. */
  const [quoteAmountOutLatch, setQuoteAmountOutLatch] = useState<bigint | undefined>(undefined);
  const [preemptiveCooldownUntilChainSec, setPreemptiveCooldownUntilChainSec] = useState<number | null>(
    null,
  );
  /** Starts on mined buy (before `getBlock` / wagmi `nextBuyAllowedAt` refresh) so the CTA ticks immediately. */
  const [buyCooldownUxWallUntilMs, setBuyCooldownUxWallUntilMs] = useState<number | null>(null);
  /** Bumps once per second while `buyCooldownUxWallUntilMs` is set so wall-clock countdown recomputes. */
  const [buyCooldownUxTick, setBuyCooldownUxTick] = useState(0);
  const [buySubmitBusy, setBuySubmitBusy] = useState(false);
  const queryClient = useQueryClient();
  const lastWalletXpBumpTxRef = useRef<string | null>(null);

  useEffect(() => {
    logKumbayaBuyDebugHelpOnce();
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setPreemptiveCooldownUntilChainSec(null);
      setBuyCooldownUxWallUntilMs(null);
    }
  }, [isConnected, address]);

  const tc = timeArenaAddress;
  const bumpWalletXpAfterBuy = useCallback(
    (
      txHash: string,
      charmWad: bigint,
      options?: { receipt?: Pick<TransactionReceipt, "logs">; paidWithCred?: boolean },
    ) => {
      if (!address || !tc || charmWad <= 0n) return;
      if (lastWalletXpBumpTxRef.current === txHash) return;
      lastWalletXpBumpTxRef.current = txHash;
      const paidWithCred = options?.paidWithCred === true;
      const fromReceipt =
        options?.receipt != null
          ? xpGainFromBuyReceiptLogs(options.receipt.logs, tc, address)
          : null;
      const gain = fromReceipt ?? xpForCharm(charmWad);
      optimisticArenaWalletBuyStats(queryClient, address, charmWad, paidWithCred, gain);
    },
    [address, queryClient, tc],
  );
  const isArenaV2 = Boolean(options?.forceArenaV2) || isTimeArenaV2(tc);
  const payUsesKumbaya = payUsesKumbayaRoute(payWith, isArenaV2);

  useEffect(() => {
    if (!isArenaV2 && payWith === "doub") {
      setPayWithState("cl8y");
    }
  }, [isArenaV2, payWith]);

  const indexerOn = Boolean(indexerBaseUrl());
  const timersQuery = useArenaTimersQuery(tc);
  const saleStateQuery = useArenaSaleStateQuery(tc, { enabled: !isArenaV2 });

  const coreContracts = tc ? [...arenaV2CoreContracts(tc)] : [];

  const {
    data: coreDataRaw,
    isPending: coreRpcPending,
    isLoading: coreRpcLoading,
    isError: coreRpcError,
    isFetched: coreRpcFetched,
    isFetching: coreRpcFetching,
    isSuccess: coreRpcSuccess,
    error: coreRpcQueryError,
    refetch: refetchCoreRpc,
  } = useReadContracts({
    contracts: coreContracts as readonly unknown[],
    query: {
      // Indexer-first when configured (#301); RPC fallback for Anvil E2E (`VITE_INDEXER_URL=`).
      enabled: Boolean(tc) && !indexerOn,
      refetchInterval: false,
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: coreRpcFetched,
    isFetching: coreRpcFetching,
    isError: coreRpcError,
    isSuccess: coreRpcSuccess,
    error: coreRpcQueryError,
  });

  const coreDataFromIndexer = useMemo((): readonly ContractReadRow[] | undefined => {
    if (isArenaV2) {
      if (!timersQuery.data) {
        return undefined;
      }
      return coreReadRowsFromArenaTimers(timersQuery.data);
    }
    if (!saleStateQuery.data) {
      return undefined;
    }
    return coreReadRowsFromSaleState(saleStateQuery.data);
  }, [isArenaV2, timersQuery.data, saleStateQuery.data]);

  const coreDataRpc = mapArenaV2CoreRows(
    coreDataRaw as readonly { status: string; result?: unknown }[] | undefined,
  );
  const coreData = (indexerOn ? coreDataFromIndexer : coreDataRpc) as
    | readonly ContractReadRow[]
    | undefined;
  const coreReadsLoading = indexerOn
    ? isArenaV2
      ? timersQuery.isLoading
      : saleStateQuery.isLoading
    : coreRpcLoading;
  const isPending = indexerOn
    ? isArenaV2
      ? timersQuery.isLoading
      : saleStateQuery.isLoading
    : coreRpcPending;
  const isError = indexerOn
    ? isArenaV2
      ? timersQuery.isError
      : saleStateQuery.isError
    : coreRpcError;
  const refetchCore = useCallback(() => {
    if (indexerOn) {
      if (isArenaV2) {
        void timersQuery.refetch();
      } else {
        void saleStateQuery.refetch();
      }
    } else {
      void refetchCoreRpc();
    }
  }, [indexerOn, isArenaV2, timersQuery, saleStateQuery, refetchCoreRpc]);

  const userContracts = tc && address ? [...arenaV2UserContracts(tc, address)] : [];
  const {
    data: userDataRaw,
    refetch: refetchUser,
  } = useReadContracts({
    contracts: userContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc && address),
      refetchInterval: false,
      placeholderData: (previous) => previous,
    },
  });
  const userData = mapArenaV2UserRows(
    userDataRaw as readonly { status: string; result?: unknown }[] | undefined,
  ) as readonly ContractReadRow[] | undefined;

  const {
    heroTimer,
    secondsRemaining: saleCountdownSec,
    countdownPlaceholder: heroCountdownPlaceholder,
    chainNowSec: heroChainNowSec,
    refresh: refreshHeroTimer,
    refreshSoft: refreshHeroTimerSoft,
  } = useArenaHeroTimer(tc);

  const [
    saleStartR,
    deadlineR,
    endedR,
    minBuyR,
    maxBuyR,
    charmBoundsR,
    pricePerCharmR,
    acceptedAssetR,
    referralRegistryR,
    totalRaisedR,
    timerExtensionSecR,
    timerCapSecR,
    buyCooldownSecR,
    launchedTokenR,
    arenaPausedRowR,
    arenaBuyRouterR,
    podiumPoolR,
    warbowPendingFlagOwnerR,
    warbowPendingFlagPlantAtR,
    warbowFlagClaimBpR,
    warbowFlagSilenceSecR,
    referralFlatCredWadR,
    presaleCharmWeightBpsR,
  ] = coreData ?? [];

  const [nextBuyAllowedAtR, activeDefendedStreakR, buyEnergyStateR] = userData ?? [];

  /**
   * Last successful `acceptedAsset()` for **this** `tc`. Core multicall refetches (~1 Hz) occasionally return a
   * transient **failure** row; without this, `acceptedAsset` disappears, `balanceOf` disables briefly, and the
   * buy panel flashes `YOUR DOUB: —` even though that read already uses `placeholderData`.
   */
  const acceptedAssetLastGoodRef = useRef<{ tc: HexAddress; asset: HexAddress } | null>(null);

  /** Holds last successful RPC values that drive {@link derivePhase} so UX does not blink to loading on flaky multicalls. */
  const phaseCoreLatchRef = useRef<{
    saleStartSec?: number;
    deadlineSec?: number;
    ended?: boolean;
  }>({});

  /** Last-good wallet-scoped multicall slices (MegaETH throttle / flaky rows). Same idea as checkoutReadLatchRef. */
  const userWalletLatchRef = useRef<{
    /** Last successful chain `nextBuyAllowedAt(wallet)` unix sec — used when multicall rows flicker pending/failure mid-refetch. */
    nextBuyAllowedAtChainSec?: number;
    /** `address` snapshot for {@link nextBuyAllowedAtChainSec} (ref is not keyed by wallet elsewhere). */
    nextBuyCooldownWallet?: HexAddress;
  }>({});

  /** Holds last successful referral config reads so referral/presale bonus lines stay stable across refetches. */
  const referralMetaLatchRef = useRef<{
    referralRegistryOn?: boolean;
    referralFlatCredWad?: bigint;
    presaleCharmWeightBps?: number;
  }>({});

  useEffect(() => {
    if (!tc) {
      phaseCoreLatchRef.current = {};
      return;
    }
    const L = phaseCoreLatchRef.current;
    if (saleStartR?.status === "success") {
      const v = Number(saleStartR.result as bigint);
      if (Number.isFinite(v)) L.saleStartSec = v;
    }
    if (deadlineR?.status === "success") {
      const v = Number(deadlineR.result as bigint);
      if (Number.isFinite(v)) L.deadlineSec = v;
    }
    if (endedR?.status === "success") {
      L.ended = endedR.result as boolean;
    }
  }, [tc, saleStartR, deadlineR, endedR]);

  useEffect(() => {
    if (!tc) {
      acceptedAssetLastGoodRef.current = null;
    }
  }, [tc]);

  useEffect(() => {
    if (!tc || !address) {
      userWalletLatchRef.current = {};
      return;
    }
    const L = userWalletLatchRef.current;
    if (nextBuyAllowedAtR?.status === "success") {
      const v = Number(nextBuyAllowedAtR.result as bigint);
      if (Number.isFinite(v)) L.nextBuyAllowedAtChainSec = v;
      if (address) L.nextBuyCooldownWallet = address;
    }
  }, [tc, address, nextBuyAllowedAtR]);

  useEffect(() => {
    if (!tc) {
      referralMetaLatchRef.current = {};
      return;
    }
    const L = referralMetaLatchRef.current;
    if (referralRegistryR?.status === "success") {
      L.referralRegistryOn = isNonZeroHexAddress(referralRegistryR.result);
    }
    if (referralFlatCredWadR?.status === "success") {
      const v = referralFlatCredWadR.result as bigint;
      if (typeof v === "bigint" && v >= 0n) L.referralFlatCredWad = v;
    }
    if (presaleCharmWeightBpsR?.status === "success") {
      const v = Number(presaleCharmWeightBpsR.result as number);
      if (Number.isFinite(v)) L.presaleCharmWeightBps = v;
    }
  }, [tc, referralRegistryR, referralFlatCredWadR, presaleCharmWeightBpsR]);

  const buyCooldownSecResolved = useMemo(() => {
    if (buyCooldownSecR?.status !== "success") return 15;
    const n = Number(buyCooldownSecR.result as bigint);
    return Number.isFinite(n) && n > 0 ? n : 15;
  }, [buyCooldownSecR]);

  const acceptedAsset = useMemo(() => {
    if (!tc) return undefined;
    if (acceptedAssetR?.status === "success") {
      const asset = acceptedAssetR.result as HexAddress;
      acceptedAssetLastGoodRef.current = { tc, asset };
      return asset;
    }
    const L = acceptedAssetLastGoodRef.current;
    return L?.tc === tc ? L.asset : undefined;
  }, [tc, acceptedAssetR]);
  const launchedToken =
    launchedTokenR?.status === "success" ? (launchedTokenR.result as HexAddress) : undefined;

  const podiumPoolAddress = useMemo((): HexAddress | undefined => {
    if (podiumPoolR?.status === "success") {
      return podiumPoolR.result as HexAddress;
    }
    return undefined;
  }, [podiumPoolR]);

  const { data: tokenDecimals } = useReadContract({
    address: acceptedAsset,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(acceptedAsset) },
  });
  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

  const { data: launchedDecimals } = useReadContract({
    address: launchedToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(launchedToken) },
  });
  const launchedDec = launchedDecimals !== undefined ? Number(launchedDecimals) : 18;

  const {
    data: walletBalance,
    refetch: refetchWalletBalance,
    isFetching: walletBalanceFetching,
  } = useReadContract({
    address: acceptedAsset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: acceptedAsset && address ? [address] : undefined,
    query: {
      enabled: Boolean(acceptedAsset && address && isConnected),
      // Avoid buy-panel flicker: background refetches otherwise clear `data` briefly (`YOUR DOUB: —`).
      placeholderData: keepPreviousData,
      refetchInterval: false,
    },
  });
  const walletBalanceWei = walletBalance as bigint | undefined;

  const { data: lastBuyEpoch, refetch: refetchLastBuyEpoch } = useReadContract({
    address: tc,
    abi: timeArenaReadAbi,
    functionName: "lastBuyEpoch",
    query: { enabled: Boolean(tc) },
  });

  const charmBalanceReadEnabled = Boolean(tc && address && lastBuyEpoch !== undefined);
  const {
    data: charmWalletBalance,
    refetch: refetchCharmWalletBalance,
    isFetching: charmWalletBalanceFetching,
  } = useReadContract({
    address: tc,
    abi: timeArenaReadAbi,
    functionName: "epochCharmWad",
    args: lastBuyEpoch !== undefined && address ? [lastBuyEpoch, address] : undefined,
    query: {
      enabled: charmBalanceReadEnabled,
      placeholderData: keepPreviousData,
      refetchInterval: false,
    },
  });
  const charmWalletBalanceWad = charmWalletBalance as bigint | undefined;

  const onBuyEventLogs = useCallback(
    (logs: {
      args?: { buyer?: `0x${string}`; charmWad?: bigint };
      transactionHash?: `0x${string}` | null;
    }[]) => {
      if (address) {
        const w = address.toLowerCase();
        for (const log of logs) {
          const buyer = log.args?.buyer;
          const charmWad = log.args?.charmWad;
          if (
            buyer &&
            charmWad !== undefined &&
            charmWad > 0n &&
            buyer.toLowerCase() === w &&
            log.transactionHash
          ) {
            bumpWalletXpAfterBuy(log.transactionHash, charmWad);
          }
        }
      }
      void refetchCore();
      void refetchUser();
      void refetchLastBuyEpoch();
      void refetchCharmWalletBalance();
      refreshHeroTimerSoft();
    },
    [
      address,
      bumpWalletXpAfterBuy,
      refetchCharmWalletBalance,
      refetchCore,
      refetchLastBuyEpoch,
      refetchUser,
      refreshHeroTimerSoft,
    ],
  );

  const onBuyEventWatchError = useCallback((err: Error) => {
    const status = extractHttpResponseStatus(err);
    if (status === 429) {
      reportRpcRateLimited();
    } else {
      reportRpcFetchAttempt(false);
    }
  }, []);

  /** Indexer-first ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)): no browser filter poll when indexer polls sale head. */
  useWatchContractEvent({
    address: tc,
    abi: timeArenaBuyEventAbi,
    eventName: "Buy",
    enabled: Boolean(tc) && !indexerOn,
    onLogs: onBuyEventLogs,
    onError: onBuyEventWatchError,
  });

  const prevWalletRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const cur = address?.toLowerCase();
    if (cur && prevWalletRef.current && prevWalletRef.current !== cur) {
      void refetchUser();
      void refetchWalletBalance();
      void refetchCharmWalletBalance();
    }
    prevWalletRef.current = cur;
  }, [address, refetchUser, refetchWalletBalance, refetchCharmWalletBalance]);

  const referralRegistryOn =
    referralRegistryR?.status === "success"
      ? isNonZeroHexAddress(referralRegistryR.result)
      : (referralMetaLatchRef.current.referralRegistryOn ?? false);

  const referralFlatCredWadOnchain =
    referralFlatCredWadR?.status === "success"
      ? (referralFlatCredWadR.result as bigint)
      : referralMetaLatchRef.current.referralFlatCredWad;

  const warbowFlagClaimBp =
    warbowFlagClaimBpR?.status === "success" ? (warbowFlagClaimBpR.result as bigint) : undefined;
  const warbowFlagSilenceSec =
    warbowFlagSilenceSecR?.status === "success" ? (warbowFlagSilenceSecR.result as bigint) : undefined;

  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const ledgerSecInt = Math.floor(
    blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000,
  );

  const saleStartSec =
    saleStartR?.status === "success"
      ? Number(saleStartR.result as bigint)
      : phaseCoreLatchRef.current.saleStartSec;
  const deadlineSec =
    deadlineR?.status === "success"
      ? Number(deadlineR.result as bigint)
      : phaseCoreLatchRef.current.deadlineSec;
  const ended =
    endedR?.status === "success" ? (endedR.result as boolean) : phaseCoreLatchRef.current.ended;

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  const phase: SaleSessionPhase = useMemo(
    () =>
      derivePhase({
        hasCoreData: Boolean(coreData && coreData.length > 0),
        saleStartSec,
        deadlineSec,
        ledgerSecInt: phaseLedgerSecInt,
      }),
    [coreData, saleStartSec, deadlineSec, phaseLedgerSecInt],
  );

  /** Last good multicall rows during sale — avoids hero + CTA flicker when a refetch briefly drops a row. */
  const checkoutReadLatchRef = useRef<{
    pricePerCharmWad: bigint | undefined;
    charmBounds: readonly [bigint, bigint] | undefined;
    minBuy: bigint | undefined;
    maxBuy: bigint | undefined;
  }>({
    pricePerCharmWad: undefined,
    charmBounds: undefined,
    minBuy: undefined,
    maxBuy: undefined,
  });

  useEffect(() => {
    if (phase !== "saleActive") {
      checkoutReadLatchRef.current = {
        pricePerCharmWad: undefined,
        charmBounds: undefined,
        minBuy: undefined,
        maxBuy: undefined,
      };
      return;
    }
    const L = checkoutReadLatchRef.current;
    if (pricePerCharmR?.status === "success") {
      L.pricePerCharmWad = pricePerCharmR.result as bigint;
    }
    if (charmBoundsR?.status === "success") {
      L.charmBounds = charmBoundsR.result as readonly [bigint, bigint];
    }
    if (minBuyR?.status === "success") {
      L.minBuy = minBuyR.result as bigint;
    }
    if (maxBuyR?.status === "success") {
      L.maxBuy = maxBuyR.result as bigint;
    }
  }, [phase, pricePerCharmR, charmBoundsR, minBuyR, maxBuyR]);

  const pricePerCharmWad = useMemo((): bigint | undefined => {
    if (pricePerCharmR?.status === "success") {
      return pricePerCharmR.result as bigint;
    }
    if (phase === "saleActive") {
      return checkoutReadLatchRef.current.pricePerCharmWad;
    }
    return undefined;
  }, [phase, pricePerCharmR]);

  const charmBoundsResolved = useMemo((): readonly [bigint, bigint] | undefined => {
    if (charmBoundsR?.status === "success") {
      return charmBoundsR.result as readonly [bigint, bigint];
    }
    if (phase === "saleActive") {
      return checkoutReadLatchRef.current.charmBounds;
    }
    return undefined;
  }, [phase, charmBoundsR]);

  const buyEnvelopeParams = useMemo((): EnvelopeCurveParamsWire | null => {
    if (pricePerCharmWad === undefined || pricePerCharmWad <= 0n) {
      return null;
    }
    return {
      charmPriceWad: pricePerCharmWad.toString(),
      minCharmWad: ARENA_CHARM_MIN_WAD.toString(),
      maxCharmWad: ARENA_CHARM_MAX_WAD.toString(),
    };
  }, [pricePerCharmWad]);

  const preStartCountdownSec = useMemo(() => {
    if (phase !== "saleStartPending") {
      return undefined;
    }
    const saleStartForHero =
      heroTimer && heroTimer.saleStartSec > 0 ? heroTimer.saleStartSec : saleStartSec;
    return arenaHeroDisplaySecondsRemaining({
      phase: "saleStartPending",
      saleStartSec: saleStartForHero,
      deadlineSec,
      chainNowSec: heroChainNowSec,
    });
  }, [phase, heroTimer, saleStartSec, deadlineSec, heroChainNowSec]);

  const liveMinBuyWei = useMemo((): bigint | undefined => {
    const L = checkoutReadLatchRef.current;
    return minBuyR?.status === "success" ? (minBuyR.result as bigint) : L.minBuy;
  }, [minBuyR]);

  const liveMaxBuyWei = useMemo((): bigint | undefined => {
    const L = checkoutReadLatchRef.current;
    return maxBuyR?.status === "success" ? (maxBuyR.result as bigint) : L.maxBuy;
  }, [maxBuyR]);

  const cl8yCheckoutBoundsGate = useMemo(
    (): Cl8yCheckoutBoundsGate =>
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: liveMinBuyWei,
        maxBuyWei: liveMaxBuyWei,
        walletBalanceWei:
          walletBalanceWei !== undefined ? BigInt(walletBalanceWei) : undefined,
        payWith,
      }),
    [liveMinBuyWei, liveMaxBuyWei, walletBalanceWei, payWith],
  );

  const cl8ySpendBounds = useMemo(() => {
    if (liveMinBuyWei === undefined || liveMaxBuyWei === undefined) {
      return null;
    }
    const minS = minCl8ySpendBroadcastHeadroom(liveMinBuyWei);
    let maxS = liveMaxBuyWei;
    if (isDirectArenaSpendPay(payWith, isArenaV2) && walletBalanceWei !== undefined) {
      const b = BigInt(walletBalanceWei);
      if (b < maxS) maxS = b;
    }
    if (minS > maxS) return null;
    return { minS, maxS };
  }, [liveMinBuyWei, liveMaxBuyWei, walletBalanceWei, payWith, isArenaV2]);

  const cl8ySpendBoundsRef = useRef<{ minS: bigint; maxS: bigint } | null>(null);

  useEffect(() => {
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;
    const prevBounds = cl8ySpendBoundsRef.current;
    cl8ySpendBoundsRef.current = { minS, maxS };
    setSpendWei((prev) =>
      reconcileSpendWeiToCl8yBounds({
        prevSpendWei: prev,
        nextBounds: { minS, maxS },
        prevBounds,
      }),
    );
  }, [cl8ySpendBounds]);

  const buySizing = useMemo(() => {
    if (!cl8ySpendBounds) {
      return null;
    }
    const L = checkoutReadLatchRef.current;
    const price =
      pricePerCharmR?.status === "success"
        ? (pricePerCharmR.result as bigint)
        : L.pricePerCharmWad;
    const bounds =
      charmBoundsR?.status === "success"
        ? (charmBoundsR.result as readonly [bigint, bigint])
        : L.charmBounds;
    if (price === undefined || bounds === undefined) {
      return null;
    }
    const [minC, maxC] = bounds;
    const { minS, maxS } = cl8ySpendBounds;
    const sw = clampBigint(spendWei, minS, maxS);
    try {
      return finalizeCharmSpendForBuy(sw, price, minC, maxC);
    } catch {
      return null;
    }
  }, [cl8ySpendBounds, pricePerCharmR, charmBoundsR, spendWei]);

  const charmWadSelected = buySizing?.charmWad;
  const estimatedSpendWei = buySizing?.spendWei;

  useEffect(() => {
    if (estimatedSpendWei !== undefined && estimatedSpendWei > 0n) {
      setQuoteAmountOutLatch(estimatedSpendWei);
    }
  }, [estimatedSpendWei]);

  const quoteAmountOut =
    estimatedSpendWei !== undefined && estimatedSpendWei > 0n
      ? estimatedSpendWei
      : quoteAmountOutLatch;

  const {
    playCredAddress: playCredFromArena,
    credPerCharmWad,
    credBalanceWei,
    requiredCredBurnWei,
    refetchCred,
  } = useArenaPlayCred({
    arenaAddress: isArenaV2 ? tc : undefined,
    charmWad: charmWadSelected,
    enabled: isArenaV2,
  });

  const playCredAddress = addresses.playCred ?? playCredFromArena;
  const playCredConfigured = playCredAddress !== undefined;

  useEffect(() => {
    if (payWith === "cred" && isArenaV2 && !playCredConfigured) {
      setPayWithState(defaultArenaPayWith(isArenaV2));
    }
  }, [payWith, isArenaV2, playCredConfigured]);

  const credCheckoutBoundsGate = useMemo(
    (): CredCheckoutBoundsGate =>
      resolveCredCheckoutBoundsGate({
        payWith,
        playCredConfigured,
        requiredCredWei: requiredCredBurnWei,
        walletBalanceWei: credBalanceWei,
      }),
    [payWith, playCredConfigured, requiredCredBurnWei, credBalanceWei],
  );

  const referralFlatCredWadResolved =
    typeof referralFlatCredWadOnchain === "bigint" && referralFlatCredWadOnchain >= 0n
      ? referralFlatCredWadOnchain
      : ARENA_REFERRAL_FLAT_CRED_WAD;

  const buyCharmReferralBonusWad = 0n;

  const buyCheckoutCharmWeightWad = useMemo(() => {
    if (charmWadSelected === undefined) return undefined;
    return charmWadSelected + buyCharmReferralBonusWad;
  }, [charmWadSelected, buyCharmReferralBonusWad]);

  const buyCharmBonusPreviewLines = useMemo((): readonly string[] => {
    const lines: string[] = [];
    if (
      charmWadSelected !== undefined &&
      charmWadSelected > 0n &&
      useReferral &&
      referralRegistryOn &&
      pendingReferralCode?.trim()
    ) {
      lines.push(formatBuyProjectedGuideCredLine(referralFlatCredWadResolved));
    }
    return lines;
  }, [
    charmWadSelected,
    useReferral,
    referralRegistryOn,
    pendingReferralCode,
    referralFlatCredWadResolved,
  ]);

  const kumbayaResolved = useMemo(
    () => resolveKumbayaRouting(chainId, import.meta.env as unknown as KumbayaEnv),
    [chainId],
  );

  const onchainTimeArenaBuyRouter = useMemo((): HexAddress | undefined => {
    if (arenaBuyRouterR?.status === "success") {
      return hexAddressFromRead(arenaBuyRouterR.result);
    }
    return undefined;
  }, [arenaBuyRouterR]);

  const singleTxBuyRouterRes = useMemo(
    () =>
      resolveTimeArenaBuyRouterForKumbayaSingleTx(
        onchainTimeArenaBuyRouter,
        import.meta.env as unknown as KumbayaEnv,
      ),
    [onchainTimeArenaBuyRouter],
  );

  const swapRoute = useMemo(() => {
    if (!payUsesKumbaya || !acceptedAsset || !kumbayaResolved.ok) return null;
    return routingForArenaPayAsset(payWith, acceptedAsset, kumbayaResolved.config);
  }, [payWith, acceptedAsset, kumbayaResolved, payUsesKumbaya]);

  const kumbayaRoutingBlocker =
    payUsesKumbaya && singleTxBuyRouterRes.kind === "mismatch"
      ? singleTxBuyRouterRes.message
      : payUsesKumbaya && !kumbayaResolved.ok
        ? kumbayaResolved.message
        : payUsesKumbaya && swapRoute !== null && !swapRoute.ok
          ? swapRoute.message
          : null;

  const charmPriceQuoteEnabled =
    payUsesKumbaya &&
    phase === "saleActive" &&
    pricePerCharmWad !== undefined &&
    pricePerCharmWad > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const quoteEnabled =
    payUsesKumbaya &&
    phase === "saleActive" &&
    quoteAmountOut !== undefined &&
    quoteAmountOut > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const kumbayaQuoteKConfig = kumbayaResolved.ok ? kumbayaResolved.config : undefined;

  const {
    data: quotedPayInWei,
    isPending: quotePending,
    isFetching: quoteFetching,
    isError: quoteIsError,
  } = useKumbayaExactOutputQuote({
    enabled: quoteEnabled,
    payWith,
    kConfig: kumbayaQuoteKConfig,
    acceptedCl8y: acceptedAsset,
    amountOut: quoteAmountOut,
    swapOutToken: isArenaV2 ? "doub" : "cl8y",
  });

  useEffect(() => {
    if (
      quotedPayInWei !== undefined &&
      quoteAmountOut !== undefined &&
      quoteAmountOut > 0n
    ) {
      setKumbayaPayQuoteLatch((prev) => {
        const cur = prev[payWith];
        if (cur?.payInWei === quotedPayInWei && cur?.amountOutWei === quoteAmountOut) {
          return prev;
        }
        return {
          ...prev,
          [payWith]: { payInWei: quotedPayInWei, amountOutWei: quoteAmountOut },
        };
      });
    }
  }, [quotedPayInWei, quoteAmountOut, payWith]);

  const latchedPayQuote = kumbayaPayQuoteLatch[payWith];
  const quotedPayInWeiResolved = quotedPayInWei ?? latchedPayQuote?.payInWei;
  const quotedForAmountOutResolved =
    quotedPayInWei !== undefined &&
    quoteAmountOut !== undefined &&
    quoteAmountOut > 0n
      ? quoteAmountOut
      : latchedPayQuote?.amountOutWei;

  /** First quote only — background refetches (slider) must not block buy or show "Refreshing quote". */
  const payQuoteAwaitingFirst =
    quoteEnabled && quotedPayInWeiResolved === undefined && quotePending;

  const {
    data: quotedPerCharmPayInWei,
    isPending: charmPriceQuotePending,
    isFetching: charmPriceQuoteFetching,
    isError: charmPriceQuoteIsError,
  } = useKumbayaExactOutputQuote({
    enabled: charmPriceQuoteEnabled,
    payWith,
    kConfig: kumbayaQuoteKConfig,
    acceptedCl8y: acceptedAsset,
    amountOut: pricePerCharmWad,
    swapOutToken: isArenaV2 ? "doub" : "cl8y",
  });

  const perCharmPayQuoteLoading =
    charmPriceQuoteEnabled &&
    quotedPerCharmPayInWei === undefined &&
    (charmPriceQuotePending || charmPriceQuoteFetching);
  const perCharmPayQuoteFailed = charmPriceQuoteIsError;

  const payTokenInAddr =
    payUsesKumbaya && swapRoute !== null && swapRoute.ok ? swapRoute.tokenIn : undefined;

  const { data: payTokDec } = useReadContract({
    address: payTokenInAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(payTokenInAddr && payUsesKumbaya) },
  });
  const payTokenDecimals =
    payTokDec !== undefined ? Number(payTokDec) : defaultPayTokenDecimals(payWith);

  const bandQuoteEnabled =
    payUsesKumbaya &&
    phase === "saleActive" &&
    cl8ySpendBounds !== null &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const {
    data: quotedBandMinPayInWei,
    isPending: bandMinPending,
    isFetching: bandMinFetching,
  } = useKumbayaExactOutputQuote({
    enabled: bandQuoteEnabled && Boolean(cl8ySpendBounds),
    payWith,
    kConfig: kumbayaQuoteKConfig,
    acceptedCl8y: acceptedAsset,
    amountOut: cl8ySpendBounds?.minS,
    swapOutToken: isArenaV2 ? "doub" : "cl8y",
  });

  const {
    data: quotedBandMaxPayInWei,
    isPending: bandMaxPending,
    isFetching: bandMaxFetching,
  } = useKumbayaExactOutputQuote({
    enabled: bandQuoteEnabled && Boolean(cl8ySpendBounds),
    payWith,
    kConfig: kumbayaQuoteKConfig,
    acceptedCl8y: acceptedAsset,
    amountOut: cl8ySpendBounds?.maxS,
    swapOutToken: isArenaV2 ? "doub" : "cl8y",
  });
  const bandBoundaryQuotesLoading =
    bandQuoteEnabled &&
    (quotedBandMinPayInWei === undefined || quotedBandMaxPayInWei === undefined) &&
    (bandMinPending || bandMinFetching || bandMaxPending || bandMaxFetching);

  const swapQuoteAwaitingFirstResult =
    payQuoteAwaitingFirst && !spendSliderInteracting;

  const swapQuoteFailed =
    quoteEnabled &&
    quoteIsError &&
    !quoteFetching &&
    !quotePending &&
    quotedPayInWeiResolved === undefined;

  const buySpendDefaultMin = useMemo(
    () =>
      isArenaBuySpendDefaultMin({
        phase,
        walletConnected: isConnected && Boolean(address),
        chainMismatch: chainMismatchWriteMessage(chainId) !== null,
        cl8ySpendBounds,
        payWith,
        cl8yCheckoutBoundsGate,
        credCheckoutBoundsGate,
        payUsesKumbaya,
        kumbayaRoutingBlocker,
        swapQuoteFailed,
      }),
    [
      phase,
      isConnected,
      address,
      chainId,
      cl8ySpendBounds,
      payWith,
      cl8yCheckoutBoundsGate,
      credCheckoutBoundsGate,
      payUsesKumbaya,
      kumbayaRoutingBlocker,
      swapQuoteFailed,
    ],
  );

  const spendInputDecimals = isDirectArenaSpendPay(payWith, isArenaV2)
    ? decimals
    : payWith === "cred"
      ? 18
      : payTokenDecimals;

  const formatSpendInputDisplay = useCallback(
    (wei: bigint, tokenDecimals: number) =>
      formatArenaPaySpendInputDisplay(
        wei,
        tokenDecimals,
        payWith,
        paySpendInputCompactRef.current
          ? { compactFractionDigits: arenaPaySpendInputCompactFractionDigits(payWith) }
          : undefined,
      ),
    [payWith],
  );

  useEffect(() => {
    if (!cl8ySpendBounds || payInputFocusedRef.current || !buySpendDefaultMin) return;
    paySpendInputCompactRef.current = true;
    const { minS } = cl8ySpendBounds;
    setSpendWei((prev) => (prev === minS ? prev : minS));
  }, [buySpendDefaultMin, cl8ySpendBounds]);

  const { data: nativeEthBal } = useBalance({
    address: address as `0x${string}` | undefined,
    query: {
      enabled: Boolean(isConnected && address && payWith === "eth"),
      placeholderData: keepPreviousData,
    },
  });

  const { data: usdmWalletBal } = useReadContract({
    address: payWith === "usdm" ? payTokenInAddr : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args:
      payWith === "usdm" && payTokenInAddr && address ? [address] : undefined,
    query: {
      enabled: Boolean(payWith === "usdm" && payTokenInAddr && address && isConnected),
      placeholderData: keepPreviousData,
    },
  });

  const reserveCl8yAddress =
    payWith === "cl8y" && isArenaV2 && kumbayaResolved.ok ? kumbayaResolved.config.cl8y : undefined;

  const { data: reserveCl8yWalletBal } = useReadContract({
    address: reserveCl8yAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: reserveCl8yAddress && address ? [address] : undefined,
    query: {
      enabled: Boolean(reserveCl8yAddress && address && isConnected),
      placeholderData: keepPreviousData,
    },
  });

  const payWalletBalance = useMemo(() => {
    if (isDirectArenaSpendPay(payWith, isArenaV2)) {
      return {
        raw: walletBalanceWei,
        decimals,
        symbol: directArenaSpendLabel(isArenaV2),
      };
    }
    if (payWith === "cl8y" && isArenaV2) {
      return {
        raw: reserveCl8yWalletBal !== undefined ? (reserveCl8yWalletBal as bigint) : undefined,
        decimals: 18,
        symbol: "CL8Y",
      };
    }
    if (payWith === "cred") {
      return { raw: credBalanceWei, decimals: 18, symbol: "CRED" };
    }
    if (payWith === "eth") {
      return {
        raw: nativeEthBal?.value !== undefined ? BigInt(nativeEthBal.value) : undefined,
        decimals: nativeEthBal?.decimals ?? 18,
        symbol: "ETH",
      };
    }
    return {
      raw: usdmWalletBal !== undefined ? (usdmWalletBal as bigint) : undefined,
      decimals: payTokenDecimals,
      symbol: "USDM",
    };
  }, [
    payWith,
    walletBalanceWei,
    credBalanceWei,
    decimals,
    isArenaV2,
    nativeEthBal,
    usdmWalletBal,
    reserveCl8yWalletBal,
    payTokenDecimals,
  ]);

  const payTokenSpendBand = useMemo(
    () =>
      resolveArenaPayTokenSpendBand({
        payWith,
        isArenaV2,
        cl8ySpendBounds,
        decimals,
        payTokenDecimals,
        quotedBandMinPayInWei,
        quotedBandMaxPayInWei,
        walletPayBalanceWei: payWalletBalance.raw,
        credPerCharmWad,
        pricePerCharmWad,
        charmBounds: charmBoundsResolved,
      }),
    [
      payWith,
      isArenaV2,
      cl8ySpendBounds,
      decimals,
      payTokenDecimals,
      quotedBandMinPayInWei,
      quotedBandMaxPayInWei,
      payWalletBalance.raw,
      credPerCharmWad,
      pricePerCharmWad,
      charmBoundsResolved,
    ],
  );

  const setPayWith = useCallback((next: PayWithAsset) => {
    setPayWithState((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    if (prevPayWithRef.current === payWith) return;
    prevPayWithRef.current = payWith;
    paySpendInputCompactRef.current = true;
    payInputFocusedRef.current = false;
    spendSliderPermilleOverrideRef.current = null;
    spendSliderInteractingRef.current = false;
    setSpendSliderInteractingState(false);
    setSpendInputStr("");
    if (cl8ySpendBounds) {
      setSpendWei(cl8ySpendBounds.minS);
    }
  }, [payWith, cl8ySpendBounds]);

  const setSpendSliderInteracting = useCallback((interacting: boolean) => {
    spendSliderInteractingRef.current = interacting;
    setSpendSliderInteractingState(interacting);
    if (!interacting) {
      spendSliderPermilleOverrideRef.current = null;
      setSpendSliderInteractionEpoch((epoch) => epoch + 1);
    }
  }, []);

  useEffect(() => {
    if (!cl8ySpendBounds || payInputFocusedRef.current || spendSliderInteractingRef.current) return;
    const displayWei = resolveArenaPayTokenDisplayWei({
      payWith,
      isArenaV2,
      spendWei,
      cl8ySpendBounds,
      payTokenSpendBand,
      quotedPayInWei: quotedPayInWeiResolved,
      quotedForAmountOutWei: quotedForAmountOutResolved,
      quoteLoading: payQuoteAwaitingFirst,
      requiredCredBurnWei,
      credPerCharmWad,
      pricePerCharmWad,
      charmBounds: charmBoundsResolved,
    });
    if (displayWei === undefined) return;
    const tokenDecimals =
      payTokenSpendBand?.tokenDecimals ??
      (isDirectArenaSpendPay(payWith, isArenaV2)
        ? decimals
        : payWith === "cred"
          ? 18
          : payTokenDecimals);
    setSpendInputStr(formatSpendInputDisplay(displayWei, tokenDecimals));
  }, [
    cl8ySpendBounds,
    payTokenSpendBand,
    spendWei,
    decimals,
    payWith,
    isArenaV2,
    quotedPayInWeiResolved,
    quotedForAmountOutResolved,
    payQuoteAwaitingFirst,
    requiredCredBurnWei,
    credPerCharmWad,
    pricePerCharmWad,
    charmBoundsResolved,
    payTokenDecimals,
    formatSpendInputDisplay,
    spendSliderInteractionEpoch,
  ]);

  const spendSliderPermille = useMemo(() => {
    if (spendSliderPermilleOverrideRef.current !== null) {
      return spendSliderPermilleOverrideRef.current;
    }
    if (payTokenSpendBand && cl8ySpendBounds) {
      const payWei = payTokenWeiForDoubSpend({
        spendWei,
        cl8ySpendBounds,
        payTokenSpendBand,
      });
      return sliderPermilleForPayTokenWei(payTokenSpendBand, payWei);
    }
    if (!cl8ySpendBounds) return 0;
    const { minS, maxS } = cl8ySpendBounds;
    const span = maxS - minS;
    if (span <= 0n) return 0;
    const sw = clampBigint(spendWei, minS, maxS);
    return Number(((sw - minS) * 10000n) / span);
  }, [cl8ySpendBounds, payTokenSpendBand, spendWei, spendSliderInteractionEpoch]);

  const setSpendFromSliderPermille = useCallback(
    (permille: number) => {
      if (!cl8ySpendBounds) return;
      spendSliderPermilleOverrideRef.current = permille;
      payInputFocusedRef.current = false;
      paySpendInputCompactRef.current = true;
      const { minS, maxS } = cl8ySpendBounds;
      const p = clampBigint(BigInt(Math.round(permille)), 0n, 10000n);
      if (!payTokenSpendBand) {
        const spend = minS + ((maxS - minS) * p) / 10000n;
        setSpendWei(spend);
        const previewWei = resolveArenaPayTokenDisplayWei({
          payWith,
          isArenaV2,
          spendWei: spend,
          cl8ySpendBounds,
          payTokenSpendBand: null,
          quotedPayInWei: quotedPayInWeiResolved,
          quotedForAmountOutWei: quotedForAmountOutResolved,
          quoteLoading: payQuoteAwaitingFirst,
          requiredCredBurnWei,
          credPerCharmWad,
          pricePerCharmWad,
          charmBounds: charmBoundsResolved,
        });
        if (previewWei !== undefined) {
          const tokenDecimals =
            payWith === "cred" ? 18 : payWith === "cl8y" ? 18 : payTokenDecimals;
          setSpendInputStr(formatSpendInputDisplay(previewWei, tokenDecimals));
        } else if (isDirectArenaSpendPay(payWith, isArenaV2)) {
          setSpendInputStr(formatSpendInputDisplay(spend, decimals));
        }
        return;
      }
      const { tokenDecimals } = payTokenSpendBand;
      const targetPay = payTokenWeiAtSliderPermille(payTokenSpendBand, p);
      let spend: bigint;
      if (isDirectArenaSpendPay(payWith, isArenaV2)) {
        spend = clampBigint(targetPay, minS, maxS);
      } else if (
        (payWith === "cl8y" && isArenaV2) ||
        payWith === "eth" ||
        payWith === "usdm"
      ) {
        spend = minS + ((maxS - minS) * p) / 10000n;
      } else {
        spend = doubSpendWeiFromPayTokenSliderTarget({
          payWith,
          isArenaV2,
          targetPayWei: targetPay,
          minSpendWei: minS,
          maxSpendWei: maxS,
          credPerCharmWad,
          pricePerCharmWad,
          charmBounds: charmBoundsResolved,
        });
      }
      setSpendWei(spend);
      let displayPay = targetPay;
      if (
        payWith === "usdm" &&
        quotedPayInWeiResolved !== undefined &&
        quotedForAmountOutResolved !== undefined &&
        quotedForAmountOutResolved > 0n
      ) {
        const scaled = payTokenWeiFromCachedQuoteRate({
          spendWei: spend,
          cl8ySpendBounds: { minS, maxS },
          quotedPayInWei: quotedPayInWeiResolved,
          quotedForAmountOutWei: quotedForAmountOutResolved,
        });
        if (scaled !== undefined) displayPay = scaled;
      }
      setSpendInputStr(formatSpendInputDisplay(displayPay, tokenDecimals));
    },
    [
      charmBoundsResolved,
      cl8ySpendBounds,
      credPerCharmWad,
      decimals,
      formatSpendInputDisplay,
      isArenaV2,
      payTokenDecimals,
      payTokenSpendBand,
      payWith,
      pricePerCharmWad,
      payQuoteAwaitingFirst,
      quotedForAmountOutResolved,
      quotedPayInWeiResolved,
      requiredCredBurnWei,
    ],
  );

  const setSpendFromInput = useCallback((raw: string) => {
    paySpendInputCompactRef.current = false;
    setSpendInputStr(raw);
  }, []);

  const setSpendFromInputFocus = useCallback(() => {
    payInputFocusedRef.current = true;
  }, []);

  const setSpendFromInputBlur = useCallback(async () => {
    payInputFocusedRef.current = false;
    paySpendInputCompactRef.current = false;
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;

    if (isDirectArenaSpendPay(payWith, isArenaV2)) {
      try {
        const raw = spendInputStr.trim() === "" ? "0" : spendInputStr.trim();
        const p = parseUnits(raw, decimals);
        const c = clampBigint(p, minS, maxS);
        setSpendWei(c);
        setSpendInputStr(formatUnits(c, decimals));
      } catch {
        setSpendInputStr(formatUnits(clampBigint(spendWei, minS, maxS), decimals));
      }
      return;
    }

    if (payWith === "cred") {
      try {
        const raw = spendInputStr.trim() === "" ? "0" : spendInputStr.trim();
        let targetPay = parseUnits(raw, 18);
        const walletCap = payWalletBalance.raw;
        if (walletCap !== undefined && targetPay > walletCap) {
          targetPay = walletCap;
        }
        let spend = minS;
        if (
          credPerCharmWad !== undefined &&
          pricePerCharmWad !== undefined &&
          charmBoundsResolved !== undefined
        ) {
          const [minCharmWad, maxCharmWad] = charmBoundsResolved;
          spend = doubSpendWeiFromCredPayTarget({
            targetCredWei: targetPay,
            credPerCharmWad,
            pricePerCharmWad,
            minCharmWad,
            maxCharmWad,
            minSpendWei: minS,
            maxSpendWei: maxS,
          });
        }
        setSpendWei(spend);
        setSpendInputStr(formatUnits(targetPay, 18));
      } catch {
        if (requiredCredBurnWei !== undefined) {
          setSpendInputStr(formatUnits(requiredCredBurnWei, 18));
        } else {
          setSpendInputStr(formatUnits(clampBigint(spendWei, minS, maxS), decimals));
        }
      }
      return;
    }

    try {
      const raw = spendInputStr.trim() === "" ? "0" : spendInputStr.trim();
      let targetPay = parseUnits(raw, payTokenDecimals);
      const walletCap = payWalletBalance.raw;
      if (walletCap !== undefined && targetPay > walletCap) {
        targetPay = walletCap;
      }

      let spend: bigint;
      if (payUsesKumbaya && kumbayaResolved.ok && acceptedAsset && swapRoute?.ok) {
        spend = await cl8ySpendWeiFromPayTokenBudget(wagmiConfig, {
          quoter: kumbayaResolved.config.quoter,
          kConfig: kumbayaResolved.config,
          payWith: payWith as Exclude<PayWithAsset, "doub" | "cred">,
          acceptedCl8y: acceptedAsset,
          targetPayInWei: targetPay,
          minSpendWei: minS,
          maxSpendWei: maxS,
          swapOutToken: isArenaV2 ? "doub" : "cl8y",
        });
      } else if (payUsesKumbaya && (payWith === "eth" || payWith === "usdm")) {
        spend = cl8ySpendWeiFromPayTokenFallback(targetPay, payWith, minS, maxS);
      } else {
        spend = clampBigint(spendWei, minS, maxS);
      }
      setSpendWei(spend);
      setSpendInputStr(formatUnits(targetPay, payTokenDecimals));
    } catch {
      if (quotedPayInWeiResolved !== undefined) {
        setSpendInputStr(formatUnits(quotedPayInWeiResolved, payTokenDecimals));
      } else {
        setSpendInputStr(formatUnits(clampBigint(spendWei, minS, maxS), decimals));
      }
    }
  }, [
    acceptedAsset,
    charmBoundsResolved,
    cl8ySpendBounds,
    credPerCharmWad,
    decimals,
    isArenaV2,
    kumbayaResolved,
    payTokenDecimals,
    payWalletBalance.raw,
    payWith,
    payUsesKumbaya,
    pricePerCharmWad,
    quotedPayInWeiResolved,
    requiredCredBurnWei,
    spendInputStr,
    spendWei,
    swapRoute,
  ]);

  /**
   * Buy cooldown countdown uses the same wall-skewed `chainNowSec` as the hero
   * timer (`useArenaHeroTimer`), so the CTA ticks every second with the main
   * countdown. When the hero snapshot is missing, fall back to the latest head
   * timestamp (integer seconds).
   */
  const chainNowForCooldown = useMemo(() => {
    if (heroChainNowSec !== undefined) return heroChainNowSec;
    return ledgerSecInt;
  }, [heroChainNowSec, ledgerSecInt]);

  const walletCooldownRemainingFromReads = useMemo(() => {
    if (phase !== "saleActive" || !isConnected) {
      return 0;
    }
    let nextAllowed: bigint | undefined;
    if (nextBuyAllowedAtR?.status === "success") {
      nextAllowed = BigInt(nextBuyAllowedAtR.result as bigint);
    } else {
      const latchedWallet = userWalletLatchRef.current.nextBuyCooldownWallet;
      const latched = userWalletLatchRef.current.nextBuyAllowedAtChainSec;
      if (latchedWallet !== address || latched === undefined) return 0;
      nextAllowed = BigInt(latched);
    }
    if (nextAllowed <= 0n) return 0;
    return Math.max(0, Math.ceil(Number(nextAllowed) - chainNowForCooldown));
  }, [phase, isConnected, nextBuyAllowedAtR, chainNowForCooldown, address]);

  const preemptiveCooldownRemainingSec = useMemo(() => {
    if (preemptiveCooldownUntilChainSec === null) return 0;
    return Math.max(0, Math.ceil(preemptiveCooldownUntilChainSec - chainNowForCooldown));
  }, [preemptiveCooldownUntilChainSec, chainNowForCooldown]);

  const buyCooldownUxWallRemainingSec = useMemo(() => {
    void buyCooldownUxTick;
    if (buyCooldownUxWallUntilMs === null) return 0;
    return Math.max(0, Math.ceil((buyCooldownUxWallUntilMs - Date.now()) / 1000));
  }, [buyCooldownUxWallUntilMs, buyCooldownUxTick]);

  useEffect(() => {
    if (buyCooldownUxWallUntilMs === null) return undefined;
    const id = window.setInterval(() => setBuyCooldownUxTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [buyCooldownUxWallUntilMs]);

  useEffect(() => {
    if (buyCooldownUxWallUntilMs !== null && Date.now() >= buyCooldownUxWallUntilMs) {
      setBuyCooldownUxWallUntilMs(null);
    }
  }, [buyCooldownUxWallUntilMs, buyCooldownUxTick]);

  const walletCooldownRemainingSec = useMemo(
    () =>
      Math.max(
        walletCooldownRemainingFromReads,
        preemptiveCooldownRemainingSec,
        buyCooldownUxWallRemainingSec,
      ),
    [
      walletCooldownRemainingFromReads,
      preemptiveCooldownRemainingSec,
      buyCooldownUxWallRemainingSec,
    ],
  );

  const walletBuyEnergy = useMemo(() => {
    if (buyEnergyStateR?.status !== "success" || !Array.isArray(buyEnergyStateR.result)) {
      return undefined;
    }
    const [chargesRaw, maxRaw, , , nextChargeRaw] = buyEnergyStateR.result as readonly unknown[];
    const charges = Number(chargesRaw);
    const maxCharges = Number(maxRaw);
    const nextChargeAtSec = Number(nextChargeRaw);
    if (!Number.isFinite(charges) || !Number.isFinite(maxCharges)) {
      return undefined;
    }
    return {
      charges,
      maxCharges,
      nextChargeAtSec: Number.isFinite(nextChargeAtSec) ? nextChargeAtSec : undefined,
    };
  }, [buyEnergyStateR]);

  const timerExtensionPreviewSec = useMemo(() => {
    if (
      phase !== "saleActive" ||
      saleCountdownSec === undefined ||
      timerExtensionSecR?.status !== "success" ||
      timerCapSecR?.status !== "success"
    ) {
      return undefined;
    }
    const timerCapSec = Number(timerCapSecR.result as bigint);
    const rawExt = Number(timerExtensionSecR.result as bigint);
    return Math.max(0, Math.min(rawExt, Math.max(0, timerCapSec - saleCountdownSec)));
  }, [phase, saleCountdownSec, timerExtensionSecR, timerCapSecR]);

  const buyPreviewPolicy = useMemo((): ArenaBuyPreviewPolicy | undefined => {
    if (timerExtensionSecR?.status !== "success" || timerCapSecR?.status !== "success") {
      return undefined;
    }
    return {
      ...DEFAULT_ARENA_BUY_PREVIEW_POLICY,
      timerExtensionSec: Number(timerExtensionSecR.result as bigint),
      timerCapSec: Number(timerCapSecR.result as bigint),
    };
  }, [timerExtensionSecR, timerCapSecR]);

  const activeDefendedStreak =
    activeDefendedStreakR?.status === "success" ? (activeDefendedStreakR.result as bigint) : undefined;

  const warbowPendingFlagOwner =
    warbowPendingFlagOwnerR?.status === "success"
      ? (warbowPendingFlagOwnerR.result as HexAddress)
      : undefined;

  const warbowPendingFlagPlantAt =
    warbowPendingFlagPlantAtR?.status === "success"
      ? (warbowPendingFlagPlantAtR.result as bigint)
      : 0n;

  const warbowFlagSilenceSecEffective = warbowFlagSilenceSec ?? 300n;

  const warbowClaimFlagFields = useMemo(
    () =>
      deriveWarbowClaimFlagFields({
        saleActive: phase === "saleActive",
        walletAddress: address,
        warbowPendingFlagOwner,
        warbowPendingFlagPlantAt,
        warbowFlagSilenceSec: warbowFlagSilenceSecEffective,
        phaseLedgerSecInt,
      }),
    [
      phase,
      address,
      warbowPendingFlagOwner,
      warbowPendingFlagPlantAt,
      warbowFlagSilenceSecEffective,
      phaseLedgerSecInt,
    ],
  );

  const refetchAll = useCallback(() => {
    void refetchCore();
    void refetchUser();
    void refetchLastBuyEpoch();
    void refetchCharmWalletBalance();
    void refreshHeroTimer();
    refetchCred();
  }, [refetchCore, refetchUser, refetchLastBuyEpoch, refetchCharmWalletBalance, refreshHeroTimer, refetchCred]);

  const arenaPaused =
    arenaPausedRowR?.status === "success"
      ? (arenaPausedRowR.result as boolean)
      : undefined;

  const submitBuy = useCallback(async () => {
    setBuyError(null);
    const preflightErr = arenaSaleSessionBuyPreflight({
      walletStatus,
      chainId,
      address: address as HexAddress | undefined,
      timeArenaAddress: tc,
      acceptedAsset,
      arenaPaused,
      payWith,
      playCredConfigured,
      playCredAddress,
      credCheckoutBoundsGate,
      walletCooldownRemainingSec,
      charmWadSelected,
      isArenaV2,
      charmBoundsR,
      hasLatchedCharmBounds: checkoutReadLatchRef.current.charmBounds !== undefined,
    });
    if (preflightErr) {
      setBuyError(preflightErr);
      return;
    }
    if (!address || !tc || !acceptedAsset) {
      return;
    }

    setBuySubmitBusy(true);
    try {
      const cw =
        charmWadSelected && charmWadSelected > 0n
          ? charmWadSelected
          : parseUnits("1", 18);

      if (payWith === "cred") {
          if (credPerCharmWad === undefined || !playCredAddress) {
            setBuyError("Play CRED burn parameters are not loaded yet.");
            return;
          }
          const burnWei = credBurnForCharmWad(cw, credPerCharmWad);
          const freshBal = await readContract(wagmiConfig, {
            address: playCredAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });
          if (freshBal < burnWei) {
            setBuyError("Not enough Play CRED in your wallet for this CHARM amount.");
            return;
          }
          const { hash: buyHash } = await writeContractWithGasBuffer({
            wagmiConfig,
            writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
            account: address as `0x${string}`,
            chainId,
            address: tc,
            abi: timeArenaWriteAbi,
            functionName: "buyWithCred",
            args: [cw],
          });
          const receipt = await waitForWriteReceipt(wagmiConfig, { hash: buyHash });
          assertSuccessfulBuyReceipt(receipt);
          bumpWalletXpAfterBuy(buyHash, cw, { receipt, paidWithCred: true });
          setBuyCooldownUxWallUntilMs(buyCooldownWallUntilMsFromNow(buyCooldownSecResolved));
          const chainSec = await chainSecondsAtReceiptBlock(wagmiConfig, receipt);
          setPreemptiveCooldownUntilChainSec(chainSec + buyCooldownSecResolved);
          refetchAll();
          return;
        }

        const priceWad =
          pricePerCharmR?.status === "success"
            ? (pricePerCharmR.result as bigint)
            : parseUnits("1000", 18);
        const needDoub = (cw * priceWad) / parseUnits("1", 18);

        const resolveBuyReferralCodeHash = async (): Promise<`0x${string}` | undefined> => {
          if (!useReferral || !referralRegistryOn || !pendingReferralCode) {
            return undefined;
          }
          const referralRegistryAddress =
            referralRegistryR?.status === "success" &&
            isNonZeroHexAddress(referralRegistryR.result)
              ? (referralRegistryR.result as `0x${string}`)
              : undefined;
          return resolveReferralCodeHashForBuy({
            wagmiConfig,
            referralRegistry: referralRegistryAddress,
            buyer: address as `0x${string}`,
            pendingCode: pendingReferralCode,
            clearPendingReferral: clearPendingReferralCode,
          });
        };

        if (payUsesKumbayaRoute(payWith, isArenaV2)) {
          const k = resolveKumbayaRouting(chainId, import.meta.env as unknown as KumbayaEnv);
          if (!k.ok) {
            setBuyError(k.message);
            return;
          }
          const route = routingForArenaPayAsset(payWith, acceptedAsset, k.config);
          if (!route.ok) {
            setBuyError(route.message);
            return;
          }
          const singleRes = resolveTimeArenaBuyRouterForKumbayaSingleTx(
            onchainTimeArenaBuyRouter,
            import.meta.env as unknown as KumbayaEnv,
          );
          if (singleRes.kind === "mismatch") {
            setBuyError(singleRes.message);
            return;
          }
          if (singleRes.kind !== "ok") {
            setBuyError("Time Arena buy router is not configured onchain — use DOUB pay or deploy the router.");
            return;
          }
          const buySessionSnapshot = captureWalletBuySession(wagmiConfig);
          if (
            !buySessionSnapshot ||
            buySessionSnapshot.address.toLowerCase() !== address.toLowerCase() ||
            buySessionSnapshot.chainId !== chainId
          ) {
            setBuyError(WALLET_BUY_SESSION_DRIFT_MESSAGE);
            return;
          }
          let codeHash: `0x${string}` | undefined;
          if (useReferral && referralRegistryOn && pendingReferralCode) {
            codeHash = await resolveBuyReferralCodeHash();
          }
          const chainSec = await submitArenaKumbayaSingleTxBuy({
            wagmiConfig,
            writeContractAsync: writeContractAsync as WalletWriteAsync,
            userAddress: address as `0x${string}`,
            chainId,
            timeArenaBuyRouter: singleRes.router,
            timeArenaAddress: tc,
            doubAddress: acceptedAsset,
            payWith: payWith as "eth" | "usdm" | "cl8y",
            kConfig: k.config,
            route,
            charmWad: cw,
            codeHash,
            plantWarBowFlag,
            sessionSnapshot: buySessionSnapshot,
            onBuyMinedBeforeChainTimestamp: () => {
              setBuyCooldownUxWallUntilMs(buyCooldownWallUntilMsFromNow(buyCooldownSecResolved));
            },
          });
          setPreemptiveCooldownUntilChainSec(chainSec + buyCooldownSecResolved);
          refetchAll();
          return;
        }

        await ensureDoubTimeArenaAllowance({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
          doubAddress: acceptedAsset,
          timeArenaAddress: tc,
          needWei: needDoub,
          unlimitedPreferred: readArenaDoubUnlimitedApproval(),
        });
        let codeHash: `0x${string}` | undefined;
        if (useReferral && referralRegistryOn && pendingReferralCode) {
          codeHash = await resolveBuyReferralCodeHash();
        }
        const buyArgs = plantWarBowFlag
          ? codeHash
            ? ([cw, codeHash, plantWarBowFlag] as const)
            : ([cw, plantWarBowFlag] as const)
          : codeHash
            ? ([cw, codeHash] as const)
            : ([cw] as const);
        const { hash: buyHash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
          address: tc,
          abi: timeArenaWriteAbi,
          functionName: "buy",
          args: buyArgs,
        });
        const receipt = await waitForWriteReceipt(wagmiConfig, { hash: buyHash });
        assertSuccessfulBuyReceipt(receipt);
        bumpWalletXpAfterBuy(buyHash, cw, { receipt });
        setBuyCooldownUxWallUntilMs(buyCooldownWallUntilMsFromNow(buyCooldownSecResolved));
        const chainSec = await chainSecondsAtReceiptBlock(wagmiConfig, receipt);
        setPreemptiveCooldownUntilChainSec(chainSec + buyCooldownSecResolved);
        refetchAll();
      return;

    } catch (e) {
      kumbayaBuyDebugError("saleSession:buy-submit-failed", e, {
        payWith,
        charmWad: charmWadSelected?.toString(),
        spendWei: spendWei?.toString(),
      });
      setBuyError(friendlyRevertFromUnknown(e, { buySubmit: true }));
    } finally {
      setBuySubmitBusy(false);
    }
  }, [
    address,
    tc,
    acceptedAsset,
    walletCooldownRemainingSec,
    charmWadSelected,
    charmBoundsR,
    spendWei,
    useReferral,
    referralRegistryOn,
    referralRegistryR,
    pendingReferralCode,
    plantWarBowFlag,
    writeContractAsync,
    bumpWalletXpAfterBuy,
    refetchAll,
    payWith,
    chainId,
    arenaPaused,
    onchainTimeArenaBuyRouter,
    buyCooldownSecResolved,
    isArenaV2,
    pricePerCharmR,
    playCredAddress,
    playCredConfigured,
    credPerCharmWad,
    credCheckoutBoundsGate,
    walletStatus,
  ]);

  const submitClaimWarBowFlag = useCallback(async () => {
    setBuyError(null);
    const netErr = chainMismatchWriteMessage(chainId);
    if (netErr) {
      setBuyError(netErr);
      return;
    }
    if (arenaPaused === true) {
      setBuyError("Time Arena is paused — WarBow actions are disabled until operators unpause.");
      return;
    }
    if (!tc || !address || !warbowClaimFlagFields.canClaimWarBowFlag) {
      return;
    }
    try {
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeArenaWriteAbi,
        functionName: "claimWarBowFlag",
      });
      await waitForWriteReceipt(wagmiConfig, { hash });
      await refetchAll();
    } catch (e) {
      setBuyError(friendlyRevertFromUnknown(e));
    }
  }, [
    chainId,
    arenaPaused,
    tc,
    address,
    warbowClaimFlagFields.canClaimWarBowFlag,
    writeContractAsync,
    refetchAll,
  ]);

  const ready = Boolean(coreData && coreData.length > 0 && !coreReadsLoading);

  return {
    ready,
    phase,
    isPending,
    isError,
    saleStartSec,
    deadlineSec,
    ended,
    decimals,
    acceptedAsset,
    podiumPoolAddress,
    launchedDec,
    // UI gating: match RainbowKit / CharmCred (`isConnected`). Wagmi stays `reconnecting` when
    // RPC is unreachable even though the connector has an address; writes stay strict below.
    walletConnected: isConnected && Boolean(address),
    walletAddress: (address as HexAddress | undefined) ?? undefined,
    walletBalanceWei,
    refetchWalletBalance: () => {
      void refetchWalletBalance();
    },
    walletBalanceRefreshing: walletBalanceFetching,
    cl8ySpendBounds,
    cl8yCheckoutBoundsGate,
    spendWei,
    spendInputStr,
    spendInputDecimals,
    setSpendFromInput,
    setSpendFromInputFocus,
    setSpendFromInputBlur,
    setSpendFromSliderPermille,
    setSpendSliderInteracting,
    spendSliderPermille,
    charmWadSelected,
    buyCheckoutCharmWeightWad,
    estimatedSpendWei,
    buyCharmBonusPreviewLines,
    preStartCountdownSec,
    saleCountdownSec,
    lastBuyTimerArmed: heroTimer?.lastBuyTimerArmed,
    heroCountdownPlaceholder,
    chainNowSec: heroChainNowSec,
    timerExtensionPreviewSec,
    buyPreviewPolicy,
    activeDefendedStreak,
    warbowPendingFlagOwner,
    warbowPendingFlagPlantAt,
    walletCooldownRemainingSec,
    walletBuyCharges: walletBuyEnergy?.charges,
    walletMaxBuyCharges: walletBuyEnergy?.maxCharges,
    walletNextBuyChargeAtSec: walletBuyEnergy?.nextChargeAtSec,
    buySubmitBusy,
    totalRaisedWei:
      totalRaisedR?.status === "success" ? (totalRaisedR.result as bigint) : undefined,
    pricePerCharmWad,
    buyEnvelopeParams,
    referralRegistryOn,
    pendingReferralCode,
    useReferral,
    setUseReferral,
    plantWarBowFlag,
    setPlantWarBowFlag,
    warbowFlagClaimBp,
    warbowFlagSilenceSec,
    showWarbowClaimFlagButton: warbowClaimFlagFields.showClaimFlagControl,
    canClaimWarBowFlag: warbowClaimFlagFields.canClaimWarBowFlag,
    warbowFlagSilenceEndSec: warbowClaimFlagFields.flagSilenceEndSec,
    submitClaimWarBowFlag,
    isWriting,
    buyError,
    clearBuyError: () => setBuyError(null),
    payWith,
    setPayWith,
    paySpendBandReady: payTokenSpendBand !== null,
    isArenaV2,
    playCredAddress,
    credBalanceWei,
    requiredCredBurnWei,
    credCheckoutBoundsGate,
    kumbayaRoutingBlocker,
    quotedPayInWei: quotedPayInWeiResolved,
    payTokenDecimals,
    swapQuoteLoading: swapQuoteAwaitingFirstResult,
    swapQuoteDisplayLoading: swapQuoteAwaitingFirstResult,
    swapQuoteFailed,
    quotedPerCharmPayInWei,
    perCharmPayQuoteLoading,
    perCharmPayQuoteFailed,
    quotedBandMinPayInWei,
    quotedBandMaxPayInWei,
    bandBoundaryQuotesLoading,
    payWalletBalance,
    charmWalletBalanceWad,
    refetchCharmWalletBalance: () => {
      void refetchLastBuyEpoch();
      void refetchCharmWalletBalance();
    },
    charmWalletBalanceRefreshing: charmWalletBalanceFetching,
    submitBuy,
    arenaPaused,
    onchainTimeArenaBuyRouter,
    refresh: refetchAll,
  };
}
