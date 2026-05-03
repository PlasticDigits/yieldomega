// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useBlock,
  useChainId,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import {
  erc20Abi,
  kumbayaQuoterV2Abi,
  kumbayaSwapRouterAbi,
  linearCharmPriceReadAbi,
  timeCurveBuyEventAbi,
  timeCurveReadAbi,
  timeCurveWriteAbi,
  weth9Abi,
} from "@/lib/abis";
import { submitKumbayaSingleTxBuy, type WalletWriteAsync } from "@/lib/timeCurveKumbayaSingleTx";
import { hashReferralCode } from "@/lib/referralCode";
import {
  type KumbayaEnv,
  type PayWithAsset,
  resolveKumbayaRouting,
  resolveTimeCurveBuyRouterForKumbayaSingleTx,
  routingForPayAsset,
} from "@/lib/kumbayaRoutes";
import {
  fetchSwapDeadlineUnixSec,
  KUMBAYA_SWAP_SLIPPAGE_BPS,
  swapMaxInputFromQuoted,
} from "@/lib/timeCurveKumbayaSwap";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { finalizeCharmSpendForBuy } from "@/lib/timeCurveBuyAmount";
import { readFreshTimeCurveBuySizing } from "@/lib/timeCurveBuySubmitSizing";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeCurveMinSpendHeadroom";
import { useTimecurveHeroTimer } from "@/pages/timecurve/useTimecurveHeroTimer";
import type { EnvelopeCurveParamsWire } from "@/lib/timeCurveBuyDisplay";
import {
  derivePhase,
  ledgerSecIntForPhase,
  timecurveHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/timecurve/timeCurveSimplePhase";
import { participantLaunchValueCl8yWei } from "@/lib/timeCurvePodiumMath";
import { wagmiConfig } from "@/wagmi-config";
import type { HexAddress } from "@/lib/addresses";
import { playGameSfxCoinHitBuySubmit } from "@/audio/playGameSfx";

const WAD_ONE_CHARM = 10n ** 18n;

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

/**
 * Minimal sale-session reads + buy handler tailored for the **simple** TimeCurve view.
 *
 * Invariants:
 * - Reads only public view functions on TimeCurve / accepted-asset ERC20.
 * - The buy handler calls the same `TimeCurve.buy(charmWad)` /
 *   `buy(charmWad, codeHash)` write paths used by the legacy/Arena page, or
 *   **`TimeCurveBuyRouter.buyViaKumbaya`** when `timeCurveBuyRouter` is set and pay mode is
 *   ETH/USDM (issue #66) — one tx replacing swap + `buy` while preserving sale semantics.
 * - This hook never speaks to the indexer; the simple view stays usable when
 *   only RPC is available.
 */
export type UseTimeCurveSaleSession = {
  ready: boolean;
  phase: SaleSessionPhase;
  isPending: boolean;
  isError: boolean;
  saleStartSec: number | undefined;
  deadlineSec: number | undefined;
  ended: boolean | undefined;
  /** Decimals of the accepted asset (CL8Y at launch). 18 until reads land. */
  decimals: number;
  /** Decimals of the launched token (DOUB at launch). 18 until reads land. */
  launchedDec: number;
  walletConnected: boolean;
  walletAddress: HexAddress | undefined;
  walletBalanceWei: bigint | undefined;
  cl8ySpendBounds: { minS: bigint; maxS: bigint } | null;
  spendWei: bigint;
  spendInputStr: string;
  setSpendFromInput: (raw: string) => void;
  setSpendFromInputBlur: () => void;
  setSpendFromSliderPermille: (permille: number) => void;
  spendSliderPermille: number;
  charmWadSelected: bigint | undefined;
  estimatedSpendWei: bigint | undefined;
  /** Pre-start countdown — uses chain time for `saleStart - now`. */
  preStartCountdownSec: number | undefined;
  /** Live sale countdown — uses the shared `useTimecurveHeroTimer` skew. */
  saleCountdownSec: number | undefined;
  /** Wall-vs-chain skewed `chain time` shared with the hero timer. */
  chainNowSec: number | undefined;
  /** Wallet buy cooldown remaining (seconds). 0 when not gated or not connected. */
  walletCooldownRemainingSec: number;
  totalRaisedWei: bigint | undefined;
  totalCharmWeightWad: bigint | undefined;
  /** Sale's `totalTokensForSale` (DOUB-WAD). Constant across the sale; used by the rate board to compute `1 CHARM → DOUB at launch`. */
  totalTokensForSaleWad: bigint | undefined;
  /** Connected wallet's onchain CHARM weight. */
  charmWeightWad: bigint | undefined;
  charmsRedeemed: boolean | undefined;
  /** Projected launched-token redemption from current charm weight (post-end only). */
  expectedTokenFromCharms: bigint | undefined;
  /**
   * Projected CL8Y value of the connected wallet's CHARM at launch — uses the
   * canonical **1.2× per-CHARM clearing price** anchor enforced by
   * `DoubLPIncentives` (see [`launch-anchor invariant`](../../../docs/testing/invariants-and-business-logic.md)).
   * Live and non-decreasing through the sale; `undefined` when reads are
   * pending; `0n` when the wallet holds no CHARM (so UI can render a clean
   * zero rather than "—").
   */
  launchCl8yValueWei: bigint | undefined;
  /** Live per-CHARM price in CL8Y wei — exposed so the UX can show "1 CHARM ≈ X CL8Y at launch". */
  pricePerCharmWad: bigint | undefined;
  /** Envelope parameters for recent-buy min/max position displays; mirrors the Arena ticker math. */
  buyEnvelopeParams: EnvelopeCurveParamsWire | null;
  /**
   * Projected CL8Y value of **one CHARM** at launch (1.2× clearing price anchor).
   * Used by the rate board DOUB = ? tile chain and for Kumbaya `quoteExactOutput` into ETH/USDM.
   */
  launchCl8yPerCharmWei: bigint | undefined;
  /**
   * Kumbaya `quoteExactOutput` for **one CHARM at launch** (amount out = `launchCl8yPerCharmWei` CL8Y).
   * Mirrors `quotedPerCharmPayInWei` but for the launch projection leg.
   */
  quotedLaunchPerCharmPayInWei: bigint | undefined;
  /** True while the launch per-CHARM quoter read is in flight. */
  launchPayQuoteLoading: boolean;
  referralRegistryOn: boolean;
  pendingReferralCode: string | null;
  useReferral: boolean;
  setUseReferral: (next: boolean) => void;
  /** Opt-in: this tx sets `warbowPendingFlag*` onchain ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). */
  plantWarBowFlag: boolean;
  setPlantWarBowFlag: (next: boolean) => void;
  isWriting: boolean;
  buyError: string | null;
  clearBuyError: () => void;
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
  kumbayaRoutingBlocker: string | null;
  quotedPayInWei: bigint | undefined;
  payTokenDecimals: number;
  /**
   * True while the Kumbaya quoter read is in flight for the current slider
   * target (`isPending` **or** `isFetching`). Background refetches set
   * `isFetching` without `isPending`; treating both as loading prevents a
   * stale quoted amount with an enabled Buy CTA ([issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56)).
   */
  swapQuoteLoading: boolean;
  swapQuoteFailed: boolean;
  /**
   * Kumbaya `quoteExactOutput` for **one CHARM** (amount out = `pricePerCharmWad` CL8Y), for the rate board.
   * Undefined while loading, on error, or when pay mode is CL8Y / routing unavailable.
   */
  quotedPerCharmPayInWei: bigint | undefined;
  /** True while the per-CHARM quoter read is in flight (rate board may show a placeholder). */
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
  /** Connected-wallet balance for the active pay asset (CL8Y / native ETH / USDM). */
  payWalletBalance: { raw: bigint | undefined; decimals: number; symbol: string };
  /** Submits optional Kumbaya `exactOutput` + approve + `buy(charmWad)` — same onchain buy as Arena. */
  submitBuy: () => Promise<void>;
  /** Submits `redeemCharms()` — only meaningful after `saleEnded`. */
  submitRedeem: () => Promise<void>;
  /** Issue #55: `buy` → FeeRouter + WarBow CL8Y actions; same flag (default true in `initialize`). */
  buyFeeRoutingEnabled: boolean | undefined;
  /** Issue #55: post-end `redeemCharms` (default false until owner signoff). */
  charmRedemptionEnabled: boolean | undefined;
  /** Issue #55: post-end `distributePrizes` with non-zero pool (default false). */
  reservePodiumPayoutsEnabled: boolean | undefined;
  refresh: () => void;
};

export function useTimeCurveSaleSession(
  timeCurveAddress: HexAddress | undefined,
): UseTimeCurveSaleSession {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { data: latestBlock } = useBlock({ watch: true });

  const [spendWei, setSpendWei] = useState(0n);
  const [spendInputStr, setSpendInputStr] = useState("");
  const [useReferral, setUseReferral] = useState(true);
  const [plantWarBowFlag, setPlantWarBowFlag] = useState(false);
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<PayWithAsset>("cl8y");

  useEffect(() => {
    setPendingReferralCode(getPendingReferralCode());
  }, []);

  const tc = timeCurveAddress;

  const coreContracts = tc
    ? [
        { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" },
        { address: tc, abi: timeCurveReadAbi, functionName: "deadline" },
        { address: tc, abi: timeCurveReadAbi, functionName: "ended" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentMaxBuyAmount" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentCharmBoundsWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentPricePerCharmWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "charmPrice" },
        { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
        { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalCharmWeight" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalTokensForSale" },
        { address: tc, abi: timeCurveReadAbi, functionName: "initialMinBuy" },
        { address: tc, abi: timeCurveReadAbi, functionName: "growthRateWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "buyCooldownSec" },
        { address: tc, abi: timeCurveReadAbi, functionName: "launchedToken" },
        { address: tc, abi: timeCurveReadAbi, functionName: "buyFeeRoutingEnabled" },
        { address: tc, abi: timeCurveReadAbi, functionName: "charmRedemptionEnabled" },
        { address: tc, abi: timeCurveReadAbi, functionName: "reservePodiumPayoutsEnabled" },
        { address: tc, abi: timeCurveReadAbi, functionName: "timeCurveBuyRouter" },
      ]
    : [];

  const {
    data: coreDataRaw,
    isPending,
    isError,
    refetch: refetchCore,
  } = useReadContracts({
    contracts: coreContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc),
      refetchInterval: 1000,
    },
  });
  const coreData = coreDataRaw as readonly ContractReadRow[] | undefined;

  useEffect(() => {
    if (tc && latestBlock?.number !== undefined) {
      void refetchCore();
    }
  }, [tc, latestBlock?.number, latestBlock?.timestamp, refetchCore]);

  const userContracts =
    tc && address
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "charmWeight", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "charmsRedeemed", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "nextBuyAllowedAt", args: [address] },
        ]
      : [];
  const {
    data: userDataRaw,
    refetch: refetchUser,
  } = useReadContracts({
    contracts: userContracts as readonly unknown[],
    query: { enabled: Boolean(tc && address) },
  });
  const userData = userDataRaw as readonly ContractReadRow[] | undefined;

  const {
    heroTimer,
    secondsRemaining: saleCountdownSec,
    chainNowSec: heroChainNowSec,
    refresh: refreshHeroTimer,
  } = useTimecurveHeroTimer(tc);

  useWatchContractEvent({
    address: tc,
    abi: timeCurveBuyEventAbi,
    eventName: "Buy",
    enabled: Boolean(tc),
    onLogs: () => {
      void refetchCore();
      void refetchUser();
      void refreshHeroTimer();
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
    charmPriceR,
    acceptedAssetR,
    referralRegistryR,
    totalRaisedR,
    totalCharmWeightR,
    totalTokensForSaleR,
    initialMinBuyR,
    growthRateWadR,
    buyCooldownSecR,
    launchedTokenR,
    buyFeeRoutingEnabledR,
    charmRedemptionEnabledR,
    reservePodiumPayoutsEnabledR,
    timeCurveBuyRouterR,
  ] = coreData ?? [];

  const [charmWeightR, charmsRedeemedR, nextBuyAllowedAtR] = userData ?? [];

  const acceptedAsset =
    acceptedAssetR?.status === "success" ? (acceptedAssetR.result as HexAddress) : undefined;
  const charmPriceAddress =
    charmPriceR?.status === "success" ? (charmPriceR.result as HexAddress) : undefined;
  const launchedToken =
    launchedTokenR?.status === "success" ? (launchedTokenR.result as HexAddress) : undefined;

  const { data: linearPriceReadsRaw } = useReadContracts({
    contracts: charmPriceAddress
      ? [
          {
            address: charmPriceAddress,
            abi: linearCharmPriceReadAbi,
            functionName: "basePriceWad",
          },
          {
            address: charmPriceAddress,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad",
          },
        ]
      : [],
    query: { enabled: Boolean(charmPriceAddress) },
  });
  const linearPriceReads = linearPriceReadsRaw as readonly ContractReadRow[] | undefined;
  const [basePriceWadR, dailyIncrementWadR] = linearPriceReads ?? [];

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

  const { data: walletBalance } = useReadContract({
    address: acceptedAsset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: acceptedAsset && address ? [address] : undefined,
    query: { enabled: Boolean(acceptedAsset && address && isConnected) },
  });
  const walletBalanceWei = walletBalance as bigint | undefined;

  const referralRegistryOn =
    referralRegistryR?.status === "success" &&
    (referralRegistryR.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000";

  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const ledgerSecInt = Math.floor(
    blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000,
  );

  const saleStartSec =
    saleStartR?.status === "success" ? Number(saleStartR.result as bigint) : undefined;
  const deadlineSec =
    deadlineR?.status === "success" ? Number(deadlineR.result as bigint) : undefined;
  const ended = endedR?.status === "success" ? (endedR.result as boolean) : undefined;

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
        ended,
        saleStartSec,
        deadlineSec,
        ledgerSecInt: phaseLedgerSecInt,
      }),
    [coreData, ended, saleStartSec, deadlineSec, phaseLedgerSecInt],
  );

  const buyEnvelopeParams = useMemo((): EnvelopeCurveParamsWire | null => {
    if (
      saleStartR?.status !== "success" ||
      initialMinBuyR?.status !== "success" ||
      growthRateWadR?.status !== "success" ||
      basePriceWadR?.status !== "success" ||
      dailyIncrementWadR?.status !== "success"
    ) {
      return null;
    }
    const start = Number(saleStartR.result as bigint);
    if (start <= 0) {
      return null;
    }
    return {
      saleStartSec: start,
      charmEnvelopeRefWad: (initialMinBuyR.result as bigint).toString(),
      growthRateWad: (growthRateWadR.result as bigint).toString(),
      basePriceWad: (basePriceWadR.result as bigint).toString(),
      dailyIncrementWad: (dailyIncrementWadR.result as bigint).toString(),
    };
  }, [saleStartR, initialMinBuyR, growthRateWadR, basePriceWadR, dailyIncrementWadR]);

  const preStartCountdownSec = useMemo(() => {
    if (phase !== "saleStartPending") {
      return undefined;
    }
    const saleStartForHero =
      heroTimer && heroTimer.saleStartSec > 0 ? heroTimer.saleStartSec : saleStartSec;
    return timecurveHeroDisplaySecondsRemaining({
      phase: "saleStartPending",
      saleStartSec: saleStartForHero,
      deadlineSec,
      chainNowSec: heroChainNowSec,
    });
  }, [phase, heroTimer, saleStartSec, deadlineSec, heroChainNowSec]);

  const cl8ySpendBounds = useMemo(() => {
    if (minBuyR?.status !== "success" || maxBuyR?.status !== "success") {
      return null;
    }
    const minS = minCl8ySpendBroadcastHeadroom(minBuyR.result as bigint);
    let maxS = maxBuyR.result as bigint;
    if (payWith === "cl8y" && walletBalanceWei !== undefined) {
      const b = BigInt(walletBalanceWei);
      if (b < maxS) maxS = b;
    }
    if (minS > maxS) return null;
    return { minS, maxS };
  }, [minBuyR, maxBuyR, walletBalanceWei, payWith]);

  useEffect(() => {
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;
    setSpendWei((prev) => {
      if (prev === 0n || prev < minS || prev > maxS) {
        return clampBigint(minS + (maxS - minS) / 2n, minS, maxS);
      }
      return clampBigint(prev, minS, maxS);
    });
  }, [cl8ySpendBounds]);

  useEffect(() => {
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;
    const c = clampBigint(spendWei, minS, maxS);
    setSpendInputStr(formatUnits(c, decimals));
  }, [cl8ySpendBounds, spendWei, decimals]);

  const buySizing = useMemo(() => {
    if (
      !cl8ySpendBounds ||
      pricePerCharmR?.status !== "success" ||
      charmBoundsR?.status !== "success"
    ) {
      return null;
    }
    const price = pricePerCharmR.result as bigint;
    const [minC, maxC] = charmBoundsR.result as readonly [bigint, bigint];
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

  const kumbayaResolved = useMemo(
    () => resolveKumbayaRouting(chainId, import.meta.env as unknown as KumbayaEnv),
    [chainId],
  );

  const onchainTimeCurveBuyRouter = useMemo((): HexAddress | undefined => {
    if (timeCurveBuyRouterR?.status === "success") {
      return timeCurveBuyRouterR.result as HexAddress;
    }
    return undefined;
  }, [timeCurveBuyRouterR]);

  const singleTxBuyRouterRes = useMemo(
    () =>
      resolveTimeCurveBuyRouterForKumbayaSingleTx(
        onchainTimeCurveBuyRouter,
        import.meta.env as unknown as KumbayaEnv,
      ),
    [onchainTimeCurveBuyRouter],
  );

  const swapRoute = useMemo(() => {
    if (payWith === "cl8y" || !acceptedAsset || !kumbayaResolved.ok) return null;
    return routingForPayAsset(payWith, acceptedAsset, kumbayaResolved.config);
  }, [payWith, acceptedAsset, kumbayaResolved]);

  const kumbayaRoutingBlocker =
    payWith !== "cl8y" && singleTxBuyRouterRes.kind === "mismatch"
      ? singleTxBuyRouterRes.message
      : payWith !== "cl8y" && !kumbayaResolved.ok
        ? kumbayaResolved.message
        : payWith !== "cl8y" && swapRoute !== null && !swapRoute.ok
          ? swapRoute.message
          : null;

  const pricePerCharmForQuote =
    pricePerCharmR?.status === "success" ? (pricePerCharmR.result as bigint) : undefined;

  const launchCl8yPerCharmWei = useMemo(
    () =>
      pricePerCharmForQuote !== undefined
        ? participantLaunchValueCl8yWei({
            charmWeightWad: WAD_ONE_CHARM,
            pricePerCharmWad: pricePerCharmForQuote,
          })
        : undefined,
    [pricePerCharmForQuote],
  );

  const charmPriceQuoteEnabled =
    payWith !== "cl8y" &&
    phase === "saleActive" &&
    pricePerCharmForQuote !== undefined &&
    pricePerCharmForQuote > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const launchPayQuoteEnabled =
    payWith !== "cl8y" &&
    phase === "saleActive" &&
    launchCl8yPerCharmWei !== undefined &&
    launchCl8yPerCharmWei > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const quoteEnabled =
    payWith !== "cl8y" &&
    phase === "saleActive" &&
    estimatedSpendWei !== undefined &&
    estimatedSpendWei > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const {
    data: quoteTuple,
    isPending: quotePending,
    isFetching: quoteFetching,
    isError: quoteIsError,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      quoteEnabled && swapRoute?.ok
        ? [swapRoute.path, estimatedSpendWei!]
        : undefined,
    query: { enabled: quoteEnabled },
  });

  const {
    data: charmPriceQuoteTuple,
    isPending: charmPriceQuotePending,
    isFetching: charmPriceQuoteFetching,
    isError: charmPriceQuoteIsError,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      charmPriceQuoteEnabled && swapRoute?.ok
        ? [swapRoute.path, pricePerCharmForQuote!]
        : undefined,
    query: { enabled: charmPriceQuoteEnabled },
  });

  const {
    data: launchPayQuoteTuple,
    isPending: launchPayQuotePending,
    isFetching: launchPayQuoteFetching,
    isError: launchPayQuoteIsError,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      launchPayQuoteEnabled && swapRoute?.ok
        ? [swapRoute.path, launchCl8yPerCharmWei!]
        : undefined,
    query: { enabled: launchPayQuoteEnabled },
  });

  const quotedPayInWei =
    quoteTuple !== undefined ? (quoteTuple as readonly [bigint, ...unknown[]])[0] : undefined;

  const quotedPerCharmPayInWei =
    charmPriceQuoteTuple !== undefined
      ? (charmPriceQuoteTuple as readonly [bigint, ...unknown[]])[0]
      : undefined;

  const quotedLaunchPerCharmPayInWei =
    launchPayQuoteTuple !== undefined
      ? (launchPayQuoteTuple as readonly [bigint, ...unknown[]])[0]
      : undefined;

  const perCharmPayQuoteLoading =
    charmPriceQuoteEnabled && (charmPriceQuotePending || charmPriceQuoteFetching);
  const perCharmPayQuoteFailed = charmPriceQuoteIsError;

  const launchPayQuoteLoading =
    launchPayQuoteEnabled && (launchPayQuotePending || launchPayQuoteFetching);

  const rateBoardKumbayaWarning =
    payWith !== "cl8y" &&
    phase === "saleActive" &&
    (kumbayaRoutingBlocker !== null ||
      swapRoute?.ok === false ||
      charmPriceQuoteIsError ||
      launchPayQuoteIsError ||
      (pricePerCharmForQuote !== undefined &&
        pricePerCharmForQuote > 0n &&
        !perCharmPayQuoteLoading &&
        charmPriceQuoteEnabled &&
        quotedPerCharmPayInWei === undefined) ||
      (launchCl8yPerCharmWei !== undefined &&
        launchCl8yPerCharmWei > 0n &&
        !launchPayQuoteLoading &&
        launchPayQuoteEnabled &&
        quotedLaunchPerCharmPayInWei === undefined));

  const payTokenInAddr =
    payWith !== "cl8y" && swapRoute !== null && swapRoute.ok ? swapRoute.tokenIn : undefined;

  const { data: payTokDec } = useReadContract({
    address: payTokenInAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(payTokenInAddr && payWith !== "cl8y") },
  });
  const payTokenDecimals = payTokDec !== undefined ? Number(payTokDec) : 18;

  const bandQuoteEnabled =
    payWith !== "cl8y" &&
    phase === "saleActive" &&
    cl8ySpendBounds !== null &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const {
    data: bandMinTuple,
    isPending: bandMinPending,
    isFetching: bandMinFetching,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      bandQuoteEnabled && swapRoute?.ok && cl8ySpendBounds
        ? [swapRoute.path, cl8ySpendBounds.minS]
        : undefined,
    query: { enabled: bandQuoteEnabled && Boolean(cl8ySpendBounds) },
  });

  const {
    data: bandMaxTuple,
    isPending: bandMaxPending,
    isFetching: bandMaxFetching,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      bandQuoteEnabled && swapRoute?.ok && cl8ySpendBounds
        ? [swapRoute.path, cl8ySpendBounds.maxS]
        : undefined,
    query: { enabled: bandQuoteEnabled && Boolean(cl8ySpendBounds) },
  });

  const quotedBandMinPayInWei =
    bandMinTuple !== undefined ? (bandMinTuple as readonly [bigint, ...unknown[]])[0] : undefined;
  const quotedBandMaxPayInWei =
    bandMaxTuple !== undefined ? (bandMaxTuple as readonly [bigint, ...unknown[]])[0] : undefined;
  const bandBoundaryQuotesLoading =
    bandQuoteEnabled &&
    (bandMinPending || bandMinFetching || bandMaxPending || bandMaxFetching);

  const { data: nativeEthBal } = useBalance({
    address: address as `0x${string}` | undefined,
    query: { enabled: Boolean(isConnected && address && payWith === "eth") },
  });

  const { data: usdmWalletBal } = useReadContract({
    address: payWith === "usdm" ? payTokenInAddr : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args:
      payWith === "usdm" && payTokenInAddr && address ? [address] : undefined,
    query: { enabled: Boolean(payWith === "usdm" && payTokenInAddr && address && isConnected) },
  });

  const payWalletBalance = useMemo(() => {
    if (payWith === "cl8y") {
      return { raw: walletBalanceWei, decimals, symbol: "CL8Y" };
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
  }, [payWith, walletBalanceWei, decimals, nativeEthBal, usdmWalletBal, payTokenDecimals]);

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
      const { minS, maxS } = cl8ySpendBounds;
      const p = clampBigint(BigInt(Math.round(permille)), 0n, 10000n);
      const spend = minS + ((maxS - minS) * p) / 10000n;
      setSpendWei(spend);
      setSpendInputStr(formatUnits(spend, decimals));
    },
    [cl8ySpendBounds, decimals],
  );

  const setSpendFromInput = useCallback((raw: string) => {
    setSpendInputStr(raw);
  }, []);

  const setSpendFromInputBlur = useCallback(() => {
    if (!cl8ySpendBounds) return;
    const { minS, maxS } = cl8ySpendBounds;
    try {
      const raw = spendInputStr.trim() === "" ? "0" : spendInputStr.trim();
      const p = parseUnits(raw, decimals);
      const c = clampBigint(p, minS, maxS);
      setSpendWei(c);
      setSpendInputStr(formatUnits(c, decimals));
    } catch {
      setSpendInputStr(formatUnits(clampBigint(spendWei, minS, maxS), decimals));
    }
  }, [cl8ySpendBounds, decimals, spendInputStr, spendWei]);

  const chainNowForCooldown =
    heroChainNowSec !== undefined ? heroChainNowSec : ledgerSecInt;
  const walletCooldownRemainingSec = useMemo(() => {
    if (
      phase !== "saleActive" ||
      !isConnected ||
      nextBuyAllowedAtR?.status !== "success"
    ) {
      return 0;
    }
    const nextAllowed = BigInt(nextBuyAllowedAtR.result as bigint);
    if (nextAllowed <= 0n) return 0;
    return Math.max(0, Math.ceil(Number(nextAllowed) - chainNowForCooldown));
  }, [phase, isConnected, nextBuyAllowedAtR, chainNowForCooldown]);

  const expectedTokenFromCharms = useMemo(() => {
    if (phase !== "saleEnded") return undefined;
    if (totalTokensForSaleR?.status !== "success") return undefined;
    if (charmWeightR?.status !== "success") return undefined;
    const tcw =
      totalCharmWeightR?.status === "success" ? (totalCharmWeightR.result as bigint) : 0n;
    if (tcw === 0n) return undefined;
    const us = charmWeightR.result as bigint;
    const tts = totalTokensForSaleR.result as bigint;
    return (tts * us) / tcw;
  }, [phase, totalCharmWeightR, totalTokensForSaleR, charmWeightR]);

  const pricePerCharmWad =
    pricePerCharmR?.status === "success" ? (pricePerCharmR.result as bigint) : undefined;

  // Launch-anchor invariant: see `participantLaunchValueCl8yWei` (1.2× × per-CHARM
  // price). Recompute reactively against the live `currentPricePerCharmWad` so the
  // value rises through the sale (UX prop: "what your CHARM is worth in CL8Y at
  // launch — only goes up").
  const launchCl8yValueWei = useMemo(
    () =>
      participantLaunchValueCl8yWei({
        charmWeightWad:
          charmWeightR?.status === "success" ? (charmWeightR.result as bigint) : undefined,
        pricePerCharmWad,
      }),
    [charmWeightR, pricePerCharmWad],
  );

  const refetchAll = useCallback(() => {
    void refetchCore();
    void refetchUser();
    void refreshHeroTimer();
  }, [refetchCore, refetchUser, refreshHeroTimer]);

  void buyCooldownSecR;

  const buyFeeRoutingEnabled =
    buyFeeRoutingEnabledR?.status === "success"
      ? (buyFeeRoutingEnabledR.result as boolean)
      : undefined;

  const submitBuy = useCallback(async () => {
    setBuyError(null);
    const netErr = chainMismatchWriteMessage(chainId);
    if (netErr) {
      setBuyError(netErr);
      return;
    }
    if (!address || !tc || !acceptedAsset) {
      setBuyError("Connect a wallet and wait for contract reads.");
      return;
    }
    if (buyFeeRoutingEnabled === false) {
      setBuyError(
        "TimeCurve: sale interactions are disabled — buys and WarBow CL8Y actions are paused (awaiting operator / governance).",
      );
      return;
    }
    if (walletCooldownRemainingSec > 0) {
      setBuyError("TimeCurve: buy cooldown");
      return;
    }
    if (charmWadSelected === undefined || charmWadSelected <= 0n) {
      setBuyError("Pick a CL8Y amount inside the live min–max band (and your balance).");
      return;
    }
    if (charmBoundsR?.status !== "success") {
      setBuyError("Waiting for onchain CHARM bounds.");
      return;
    }
    const freshSizing = await readFreshTimeCurveBuySizing({
      wagmiConfig,
      timeCurveAddress: tc,
      spendWeiIntent: spendWei,
      walletCl8yCapWei: payWith === "cl8y" ? walletBalanceWei : undefined,
    });
    if (!freshSizing.ok) {
      setBuyError(freshSizing.message);
      return;
    }
    const cw = freshSizing.charmWad;
    const amount = freshSizing.spendWei;

    let codeHash: `0x${string}` | undefined;
    if (useReferral && referralRegistryOn && pendingReferralCode) {
      try {
        codeHash = hashReferralCode(pendingReferralCode);
      } catch (e) {
        setBuyError(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    try {
      if (payWith !== "cl8y") {
        const k = resolveKumbayaRouting(chainId, import.meta.env as unknown as KumbayaEnv);
        if (!k.ok) {
          setBuyError(k.message);
          return;
        }
        const route = routingForPayAsset(payWith, acceptedAsset, k.config);
        if (!route.ok) {
          setBuyError(route.message);
          return;
        }
        const singleRes = resolveTimeCurveBuyRouterForKumbayaSingleTx(
          onchainTimeCurveBuyRouter,
          import.meta.env as unknown as KumbayaEnv,
        );
        if (singleRes.kind === "mismatch") {
          setBuyError(singleRes.message);
          return;
        }
        if (singleRes.kind === "ok" && (payWith === "eth" || payWith === "usdm")) {
          await submitKumbayaSingleTxBuy({
            wagmiConfig,
            writeContractAsync: writeContractAsync as WalletWriteAsync,
            userAddress: address,
            timeCurveBuyRouter: singleRes.router,
            payWith,
            kConfig: k.config,
            route,
            cl8yOut: amount,
            charmWad: cw,
            codeHash,
            plantWarBowFlag,
          });
          if (codeHash) {
            clearPendingReferralCode();
            setPendingReferralCode(null);
          }
          refetchAll();
          return;
        }
        const quote = await readContract(wagmiConfig, {
          address: k.config.quoter,
          abi: kumbayaQuoterV2Abi,
          functionName: "quoteExactOutput",
          args: [route.path, amount],
        });
        const qIn = (quote as readonly [bigint, ...unknown[]])[0];
        const maxIn = swapMaxInputFromQuoted(qIn, KUMBAYA_SWAP_SLIPPAGE_BPS);

        if (payWith === "eth") {
          const wrapHash = await writeContractAsync({
            address: k.config.weth,
            abi: weth9Abi,
            functionName: "deposit",
            value: maxIn,
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
          const wAllow = await readContract(wagmiConfig, {
            address: k.config.weth,
            abi: weth9Abi,
            functionName: "allowance",
            args: [address, k.config.swapRouter],
          });
          if (wAllow < maxIn) {
            const wAp = await writeContractAsync({
              address: k.config.weth,
              abi: weth9Abi,
              functionName: "approve",
              args: [k.config.swapRouter, maxUint256],
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: wAp });
          }
        } else if (payWith === "usdm") {
          const uAllow = await readContract(wagmiConfig, {
            address: route.tokenIn,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, k.config.swapRouter],
          });
          if (uAllow < maxIn) {
            const uAp = await writeContractAsync({
              address: route.tokenIn,
              abi: erc20Abi,
              functionName: "approve",
              args: [k.config.swapRouter, maxUint256],
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: uAp });
          }
        }

        const deadline = await fetchSwapDeadlineUnixSec(wagmiConfig, 600);
        const swapHash = await writeContractAsync({
          address: k.config.swapRouter,
          abi: kumbayaSwapRouterAbi,
          functionName: "exactOutput",
          args: [
            {
              path: route.path,
              recipient: address,
              deadline,
              amountOut: amount,
              amountInMaximum: maxIn,
            },
          ],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: swapHash });
      }

      const allow = await readContract(wagmiConfig, {
        address: acceptedAsset,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, tc],
      });
      if (allow < amount) {
        const approveHash = await writeContractAsync({
          address: acceptedAsset,
          abi: erc20Abi,
          functionName: "approve",
          args: [tc, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const buyArgs = codeHash
        ? ([cw, codeHash, plantWarBowFlag] as const)
        : plantWarBowFlag
          ? ([cw, plantWarBowFlag] as const)
          : ([cw] as const);
      const buyHash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "buy",
        args: buyArgs,
      });
      playGameSfxCoinHitBuySubmit();
      await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      if (codeHash) {
        clearPendingReferralCode();
        setPendingReferralCode(null);
      }
      refetchAll();
    } catch (e) {
      setBuyError(friendlyRevertFromUnknown(e, { buySubmit: true }));
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
    pendingReferralCode,
    plantWarBowFlag,
    writeContractAsync,
    refetchAll,
    payWith,
    chainId,
    buyFeeRoutingEnabled,
    onchainTimeCurveBuyRouter,
  ]);

  const submitRedeem = useCallback(async () => {
    setBuyError(null);
    const netErr = chainMismatchWriteMessage(chainId);
    if (netErr) {
      setBuyError(netErr);
      return;
    }
    if (!address || !tc) {
      setBuyError("Connect a wallet to redeem.");
      return;
    }
    if (charmRedemptionEnabledR?.status === "success" && !charmRedemptionEnabledR.result) {
      setBuyError(
        "TimeCurve: CHARM redemptions are not enabled yet (awaiting final signoff onchain).",
      );
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "redeemCharms",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyError(friendlyRevertFromUnknown(e));
    }
  }, [address, tc, chainId, writeContractAsync, refetchAll, charmRedemptionEnabledR]);

  const ready = Boolean(coreData && coreData.length > 0 && !isPending);

  return {
    ready,
    phase,
    isPending,
    isError,
    saleStartSec,
    deadlineSec,
    ended,
    decimals,
    launchedDec,
    walletConnected: Boolean(isConnected && address),
    walletAddress: (address as HexAddress | undefined) ?? undefined,
    walletBalanceWei,
    cl8ySpendBounds,
    spendWei,
    spendInputStr,
    setSpendFromInput,
    setSpendFromInputBlur,
    setSpendFromSliderPermille,
    spendSliderPermille,
    charmWadSelected,
    estimatedSpendWei,
    preStartCountdownSec,
    saleCountdownSec,
    chainNowSec: heroChainNowSec,
    walletCooldownRemainingSec,
    totalRaisedWei:
      totalRaisedR?.status === "success" ? (totalRaisedR.result as bigint) : undefined,
    totalCharmWeightWad:
      totalCharmWeightR?.status === "success"
        ? (totalCharmWeightR.result as bigint)
        : undefined,
    totalTokensForSaleWad:
      totalTokensForSaleR?.status === "success"
        ? (totalTokensForSaleR.result as bigint)
        : undefined,
    charmWeightWad:
      charmWeightR?.status === "success" ? (charmWeightR.result as bigint) : undefined,
    charmsRedeemed:
      charmsRedeemedR?.status === "success" ? (charmsRedeemedR.result as boolean) : undefined,
    expectedTokenFromCharms,
    launchCl8yValueWei,
    pricePerCharmWad,
    buyEnvelopeParams,
    launchCl8yPerCharmWei,
    referralRegistryOn,
    pendingReferralCode,
    useReferral,
    setUseReferral,
    plantWarBowFlag,
    setPlantWarBowFlag,
    isWriting,
    buyError,
    clearBuyError: () => setBuyError(null),
    payWith,
    setPayWith,
    kumbayaRoutingBlocker,
    quotedPayInWei,
    payTokenDecimals,
    swapQuoteLoading: quoteEnabled && (quotePending || quoteFetching),
    swapQuoteFailed: quoteIsError,
    quotedPerCharmPayInWei,
    quotedLaunchPerCharmPayInWei,
    perCharmPayQuoteLoading,
    perCharmPayQuoteFailed,
    launchPayQuoteLoading,
    rateBoardKumbayaWarning,
    quotedBandMinPayInWei,
    quotedBandMaxPayInWei,
    bandBoundaryQuotesLoading,
    payWalletBalance,
    submitBuy,
    submitRedeem,
    buyFeeRoutingEnabled,
    charmRedemptionEnabled:
      charmRedemptionEnabledR?.status === "success"
        ? (charmRedemptionEnabledR.result as boolean)
        : undefined,
    reservePodiumPayoutsEnabled:
      reservePodiumPayoutsEnabledR?.status === "success"
        ? (reservePodiumPayoutsEnabledR.result as boolean)
        : undefined,
    refresh: refetchAll,
  };
}
