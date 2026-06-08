// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
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
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import {
  erc20Abi,
  timeArenaBuyEventAbi,
  timeArenaWriteAbi,
} from "@/lib/abis";
import { readArenaDoubUnlimitedApproval } from "@/lib/arenaDoubApprovalPreference";
import { ensureDoubTimeArenaAllowance } from "@/lib/ensureDoubTimeArenaAllowance";
import { useKumbayaExactOutputQuote } from "@/hooks/useKumbayaExactOutputQuote";
import {
  cl8ySpendWeiFromPayTokenBudget,
  cl8ySpendWeiFromPayTokenFallback,
} from "@/lib/kumbayaCl8ySpendFromPayToken";
import { type WalletWriteAsync } from "@/lib/timeArenaKumbayaSingleTx";
import { submitArenaKumbayaSingleTxBuy } from "@/lib/timeArenaKumbayaSingleTx";
import { hashReferralCode } from "@/lib/referralCode";
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
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import { wagmiConfig } from "@/wagmi-config";
import type { HexAddress } from "@/lib/addresses";
import {
  DEFAULT_ARENA_BUY_PREVIEW_POLICY,
  type ArenaBuyPreviewPolicy,
} from "@/lib/timeArenaBuyPreview";

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
   * True while we're waiting on the quoter **before we have any** pay-token quote
   * for the current slider (`quotedPayInWei` still undefined). Keeps ETH/USDM
   * buys disabled (#56). Background refetches that keep a prior quote mounted
   * via `placeholderData` do **not** set this — see {@link swapQuoteDisplayLoading}.
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
  /** True until the first per-CHARM quoter value exists (rate board); avoids “…” on every background refetch. */
  perCharmPayQuoteLoading: boolean;
  perCharmPayQuoteFailed: boolean;
  /**
   * When paying with ETH/USDM, true if the rate board is using static fallback rates or the per-CHARM quote failed.
   * Drives the yellow “kumbaya route failed” affordance (display only; buy still uses live swap quotes).
   */
  rateBoardKumbayaWarning: boolean;
  /** Kumbaya-quoted pay token for `cl8ySpendBounds.minS` / `maxS` (ETH/USDM band row). */
  quotedBandMinPayInWei: bigint | undefined;
  quotedBandMaxPayInWei: bigint | undefined;
  bandBoundaryQuotesLoading: boolean;
  /** Connected-wallet balance for the active pay asset (DOUB/CL8Y / native ETH / USDM). */
  payWalletBalance: { raw: bigint | undefined; decimals: number; symbol: string };
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
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { data: latestBlock } = useLatestBlock();

  const [spendWei, setSpendWei] = useState(0n);
  const [spendInputStr, setSpendInputStr] = useState("");
  const payInputFocusedRef = useRef(false);
  const [useReferral, setUseReferral] = useState(true);
  const [plantWarBowFlag, setPlantWarBowFlag] = useState(false);
  const pendingReferralCode = usePendingReferralCode();
  const [buyError, setBuyError] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<PayWithAsset>("cl8y");
  const payUsesKumbaya = payWith === "eth" || payWith === "usdm";
  const [preemptiveCooldownUntilChainSec, setPreemptiveCooldownUntilChainSec] = useState<number | null>(
    null,
  );
  /** Starts on mined buy (before `getBlock` / wagmi `nextBuyAllowedAt` refresh) so the CTA ticks immediately. */
  const [buyCooldownUxWallUntilMs, setBuyCooldownUxWallUntilMs] = useState<number | null>(null);
  /** Bumps once per second while `buyCooldownUxWallUntilMs` is set so wall-clock countdown recomputes. */
  const [buyCooldownUxTick, setBuyCooldownUxTick] = useState(0);
  const [buySubmitBusy, setBuySubmitBusy] = useState(false);

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
  const isArenaV2 = Boolean(options?.forceArenaV2) || isTimeArenaV2(tc);
  const indexerOn = Boolean(indexerBaseUrl());
  const timersQuery = useArenaTimersQuery(tc);
  const saleStateQuery = useArenaSaleStateQuery(tc);

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
      enabled: false,
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
    chainNowSec: heroChainNowSec,
    refresh: refreshHeroTimer,
    refreshSoft: refreshHeroTimerSoft,
  } = useArenaHeroTimer(tc);

  useWatchContractEvent({
    address: tc,
    abi: timeArenaBuyEventAbi,
    eventName: "Buy",
    enabled: Boolean(tc),
    onLogs: () => {
      void refetchCore();
      void refetchUser();
      refreshHeroTimerSoft();
    },
  });

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

  const [nextBuyAllowedAtR, activeDefendedStreakR] = userData ?? [];

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
    if (buyCooldownSecR?.status !== "success") return 300;
    const n = Number(buyCooldownSecR.result as bigint);
    return Number.isFinite(n) && n > 0 ? n : 300;
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

  const prevWalletRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const cur = address?.toLowerCase();
    if (cur && prevWalletRef.current && prevWalletRef.current !== cur) {
      void refetchUser();
      void refetchWalletBalance();
    }
    prevWalletRef.current = cur;
  }, [address, refetchUser, refetchWalletBalance]);

  const referralRegistryOn =
    referralRegistryR?.status === "success"
      ? isNonZeroHexAddress(referralRegistryR.result)
      : (referralMetaLatchRef.current.referralRegistryOn ?? false);

  const referralRegistryAddr =
    referralRegistryR?.status === "success"
      ? hexAddressFromRead(referralRegistryR.result)
      : undefined;

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
    if (payWith === "cl8y" && walletBalanceWei !== undefined) {
      const b = BigInt(walletBalanceWei);
      if (b < maxS) maxS = b;
    }
    if (minS > maxS) return null;
    return { minS, maxS };
  }, [liveMinBuyWei, liveMaxBuyWei, walletBalanceWei, payWith]);

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
      setPayWith("cl8y");
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
      const credLabel = formatCompactFromRaw(referralFlatCredWadResolved, 18, { sigfigs: 4 });
      const raw = pendingReferralCode.trim();
      const codeLabel = raw.length > 22 ? `${raw.slice(0, 20)}…` : raw;
      lines.push(`+${credLabel} CRED Referral ${codeLabel}`);
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
    estimatedSpendWei !== undefined &&
    estimatedSpendWei > 0n &&
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
    amountOut: estimatedSpendWei,
    swapOutToken: isArenaV2 ? "doub" : "cl8y",
  });

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

  const rateBoardKumbayaWarning =
    payUsesKumbaya &&
    phase === "saleActive" &&
    (kumbayaRoutingBlocker !== null ||
      swapRoute?.ok === false ||
      charmPriceQuoteIsError ||
      (pricePerCharmWad !== undefined &&
        pricePerCharmWad > 0n &&
        !perCharmPayQuoteLoading &&
        charmPriceQuoteEnabled &&
        quotedPerCharmPayInWei === undefined));

  const payTokenInAddr =
    payUsesKumbaya && swapRoute !== null && swapRoute.ok ? swapRoute.tokenIn : undefined;

  const { data: payTokDec } = useReadContract({
    address: payTokenInAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(payTokenInAddr && payUsesKumbaya) },
  });
  const payTokenDecimals = payTokDec !== undefined ? Number(payTokDec) : 18;

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

  const payWalletBalance = useMemo(() => {
    if (payWith === "cl8y") {
      return { raw: walletBalanceWei, decimals, symbol: isArenaV2 ? "DOUB" : "CL8Y" };
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
  }, [payWith, walletBalanceWei, credBalanceWei, decimals, isArenaV2, nativeEthBal, usdmWalletBal, payTokenDecimals]);

  const spendInputDecimals =
    payWith === "cl8y" ? decimals : payWith === "cred" ? 18 : payTokenDecimals;

  useEffect(() => {
    if (!cl8ySpendBounds || payInputFocusedRef.current) return;
    const { minS, maxS } = cl8ySpendBounds;
    const c = clampBigint(spendWei, minS, maxS);
    if (payWith === "cl8y") {
      setSpendInputStr(formatUnits(c, decimals));
      return;
    }
    if (quotedPayInWei !== undefined) {
      setSpendInputStr(formatUnits(quotedPayInWei, payTokenDecimals));
    }
  }, [cl8ySpendBounds, spendWei, decimals, payWith, quotedPayInWei, payTokenDecimals]);

  const spendSliderPermille = useMemo(() => {
    if (!cl8ySpendBounds) return 0;
    const { minS, maxS } = cl8ySpendBounds;
    const span = maxS - minS;
    if (span <= 0n) return 0;
    const sw = clampBigint(spendWei, minS, maxS);
    return Number(((sw - minS) * 10000n) / span);
  }, [cl8ySpendBounds, spendWei]);

  const setSpendFromSliderPermille = useCallback(
    (permille: number) => {
      if (!cl8ySpendBounds) return;
      payInputFocusedRef.current = false;
      const { minS, maxS } = cl8ySpendBounds;
      const p = clampBigint(BigInt(Math.round(permille)), 0n, 10000n);
      const spend = minS + ((maxS - minS) * p) / 10000n;
      setSpendWei(spend);
      if (payWith === "cl8y") {
        setSpendInputStr(formatUnits(spend, decimals));
      }
    },
    [cl8ySpendBounds, decimals, payWith],
  );

  const setSpendFromInput = useCallback((raw: string) => {
    setSpendInputStr(raw);
  }, []);

  const setSpendFromInputFocus = useCallback(() => {
    payInputFocusedRef.current = true;
  }, []);

  const setSpendFromInputBlur = useCallback(async () => {
    payInputFocusedRef.current = false;
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;

    if (payWith === "cl8y") {
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
          payWith,
          acceptedCl8y: acceptedAsset,
          targetPayInWei: targetPay,
          minSpendWei: minS,
          maxSpendWei: maxS,
        });
      } else if (payUsesKumbaya) {
        spend = cl8ySpendWeiFromPayTokenFallback(targetPay, payWith, minS, maxS);
      } else {
        spend = clampBigint(spendWei, minS, maxS);
      }
      setSpendWei(spend);
      setSpendInputStr(formatUnits(targetPay, payTokenDecimals));
    } catch {
      if (quotedPayInWei !== undefined) {
        setSpendInputStr(formatUnits(quotedPayInWei, payTokenDecimals));
      } else {
        setSpendInputStr(formatUnits(clampBigint(spendWei, minS, maxS), decimals));
      }
    }
  }, [
    acceptedAsset,
    cl8ySpendBounds,
    decimals,
    kumbayaResolved,
    payTokenDecimals,
    payWalletBalance.raw,
    payWith,
    quotedPayInWei,
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
    void refreshHeroTimer();
    refetchCred();
  }, [refetchCore, refetchUser, refreshHeroTimer, refetchCred]);

  const arenaPaused =
    arenaPausedRowR?.status === "success"
      ? (arenaPausedRowR.result as boolean)
      : undefined;

  const submitBuy = useCallback(async () => {
    setBuyError(null);
    const netErr = chainMismatchWriteMessage(chainId);
    if (netErr) {
      setBuyError(netErr);
      return;
    }
    if (!address || !tc || !acceptedAsset) {
      setBuyError("Connect a wallet and wait for sale state (indexer or contract reads).");
      return;
    }
    if (arenaPaused === true) {
      setBuyError("Time Arena is paused — buys and WarBow DOUB spend are disabled until operators unpause.");
      return;
    }
    if (payWith === "cred") {
      if (!playCredConfigured || !playCredAddress) {
        setBuyError("Play CRED is not configured on this arena.");
        return;
      }
      if (credCheckoutBoundsGate.kind === "insufficient_cred") {
        setBuyError("Not enough Play CRED in your wallet for this CHARM amount.");
        return;
      }
    }
    if (walletCooldownRemainingSec > 0) {
      setBuyError("TimeArena: buy cooldown");
      return;
    }
    if (charmWadSelected === undefined || charmWadSelected <= 0n) {
      setBuyError(`Pick a ${isArenaV2 ? "DOUB" : "CL8Y"} amount inside the live min–max band (and your balance).`);
      return;
    }
    if (
      charmBoundsR?.status !== "success" &&
      checkoutReadLatchRef.current.charmBounds === undefined
    ) {
      setBuyError("Waiting for onchain CHARM bounds.");
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

        if (payWith !== "cl8y") {
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
            try {
              codeHash = hashReferralCode(pendingReferralCode);
            } catch (e) {
              setBuyError(e instanceof Error ? e.message : String(e));
              return;
            }
          }
          const chainSec = await submitArenaKumbayaSingleTxBuy({
            wagmiConfig,
            writeContractAsync: writeContractAsync as WalletWriteAsync,
            userAddress: address as `0x${string}`,
            chainId,
            timeArenaBuyRouter: singleRes.router,
            timeArenaAddress: tc,
            doubAddress: acceptedAsset,
            payWith,
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
          try {
            codeHash = hashReferralCode(pendingReferralCode);
          } catch (e) {
            setBuyError(e instanceof Error ? e.message : String(e));
            return;
          }
        }
        const { hash: buyHash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
          address: tc,
          abi: timeArenaWriteAbi,
          functionName: "buy",
          args: codeHash ? ([cw, codeHash] as const) : ([cw] as const),
        });
        const receipt = await waitForWriteReceipt(wagmiConfig, { hash: buyHash });
        assertSuccessfulBuyReceipt(receipt);
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
    walletBalanceWei,
    useReferral,
    referralRegistryOn,
    referralRegistryAddr,
    pendingReferralCode,
    plantWarBowFlag,
    writeContractAsync,
    refetchAll,
    payWith,
    chainId,
    arenaPaused,
    onchainTimeArenaBuyRouter,
    buyCooldownSecResolved,
    isArenaV2,
    pricePerCharmR,
    plantWarBowFlag,
    referralRegistryOn,
    pendingReferralCode,
    useReferral,
    playCredAddress,
    playCredConfigured,
    credPerCharmWad,
    credCheckoutBoundsGate,
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

  const swapQuoteAwaitingFirstResult =
    quoteEnabled && quotedPayInWei === undefined && (quotePending || quoteFetching);

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
    walletConnected: Boolean(isConnected && address),
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
    spendSliderPermille,
    charmWadSelected,
    buyCheckoutCharmWeightWad,
    estimatedSpendWei,
    buyCharmBonusPreviewLines,
    preStartCountdownSec,
    saleCountdownSec,
    chainNowSec: heroChainNowSec,
    timerExtensionPreviewSec,
    buyPreviewPolicy,
    activeDefendedStreak,
    warbowPendingFlagOwner,
    warbowPendingFlagPlantAt,
    walletCooldownRemainingSec,
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
    isArenaV2,
    playCredAddress,
    credBalanceWei,
    requiredCredBurnWei,
    credCheckoutBoundsGate,
    kumbayaRoutingBlocker,
    quotedPayInWei,
    payTokenDecimals,
    swapQuoteLoading: swapQuoteAwaitingFirstResult,
    swapQuoteDisplayLoading: swapQuoteAwaitingFirstResult,
    swapQuoteFailed: quoteIsError,
    quotedPerCharmPayInWei,
    perCharmPayQuoteLoading,
    perCharmPayQuoteFailed,
    rateBoardKumbayaWarning,
    quotedBandMinPayInWei,
    quotedBandMaxPayInWei,
    bandBoundaryQuotesLoading,
    payWalletBalance,
    submitBuy,
    arenaPaused,
    onchainTimeArenaBuyRouter,
    refresh: refetchAll,
  };
}
