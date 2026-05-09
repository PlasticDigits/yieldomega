// SPDX-License-Identifier: AGPL-3.0-only

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
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
import { AmountDisplay } from "@/components/AmountDisplay";
import { AddressInline } from "@/components/AddressInline";
import { sameAddress, walletDisplayFromMap } from "@/lib/addressFormat";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { formatBpsAsPercent, formatLocaleInteger } from "@/lib/formatAmount";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import {
  erc20Abi,
  feeRouterReadAbi,
  kumbayaQuoterV2Abi,
  kumbayaSwapRouterAbi,
  linearCharmPriceReadAbi,
  timeCurveBuyEventAbi,
  timeCurveReadAbi,
  timeCurveWriteAbi,
  weth9Abi,
} from "@/lib/abis";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { writeContractWithGasBuffer, asWriteContractAsyncFn } from "@/lib/writeContractWithGasBuffer";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import {
  assertWalletBuySessionUnchanged,
  captureWalletBuySession,
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
} from "@/lib/walletBuySessionGuard";
import { simulateWriteContract } from "@/lib/simulateContractWrite";
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
import { submitKumbayaSingleTxBuy, type WalletWriteAsync } from "@/lib/timeCurveKumbayaSingleTx";
import {
  cl8yTimeCurveApprovalAmountWei,
  readCl8yTimeCurveUnlimitedApproval,
} from "@/lib/cl8yTimeCurveApprovalPreference";
import { finalizeCharmSpendForBuy } from "@/lib/timeCurveBuyAmount";
import { readFreshTimeCurveBuySizing } from "@/lib/timeCurveBuySubmitSizing";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeCurveMinSpendHeadroom";
import { sampleMinSpendCurve } from "@/lib/timeCurveMath";
import {
  buildBuyBattlePointBreakdown,
  buildBuyFeedNarrative,
  buildBuyHistoryPoints,
  buildWarbowFeedNarrative,
  describeStealPreflight,
  describeTimerPreview,
} from "@/lib/timeCurveUx";
import {
  derivePhase,
  ledgerSecIntForPhase,
  phaseBadge,
  phaseFlags,
  timecurveHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/timecurve/timeCurveSimplePhase";
import { formatCountdown } from "@/pages/timecurve/formatTimer";
import { PODIUM_HELP, PODIUM_LABELS } from "@/pages/timecurve/podiumCopy";
import { type RankingRow } from "@/pages/timecurve/timecurveUi";
import { usePodiumReads } from "@/pages/timecurve/usePodiumReads";
import {
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  participantLaunchValueCl8yWei,
  podiumCategorySlices,
  podiumPlacementShares,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { wagmiConfig } from "@/wagmi-config";
import { playGameSfxCoinHitBuySubmit } from "@/audio/playGameSfx";
import { useDotMegaNameMap } from "@/hooks/useDotMegaNameMap";
import { collectTimecurveWalletAddressesForDotMega } from "@/lib/dotMega";
import {
  buySpendEnvelopeFillRatio,
  envelopeCurveParamsFromWire,
  type EnvelopeCurveParamsWire,
} from "@/lib/timeCurveBuyDisplay";
import { buySizeColor } from "@/pages/timecurve/buySizeColor";
import { useTimecurveHeroTimer } from "@/pages/timecurve/useTimecurveHeroTimer";
import {
  fetchTimecurveCharmRedemptions,
  fetchTimecurveBuyerStats,
  fetchTimecurveBuys,
  fetchTimecurvePrizeDistributions,
  fetchTimecurvePrizePayouts,
  fetchReferralApplied,
  fetchTimecurveWarbowBattleFeed,
  fetchTimecurveWarbowLeaderboard,
  fetchWarbowPendingRevenge,
  type CharmRedemptionItem,
  type BuyItem,
  type PrizeDistributionItem,
  type PrizePayoutItem,
  type ReferralAppliedItem,
  type TimecurveBuyerStats,
  type WarbowBattleFeedItem,
  type WarbowLeaderboardItem,
  type WarbowPendingRevengeItem,
} from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import {
  CL8Y_USD_PRICE_PLACEHOLDER,
  clampBigint,
  describeBurstBand,
  formatPodiumLeaderboardValue,
  mergeBuysNewestFirst,
  type ContractReadRow,
} from "./arenaPageHelpers";
import { TimeCurveArenaWalletMono } from "./TimeCurveArenaWalletMono";
import type { WarbowStealCandidate } from "./WarbowHeroActions";
import { warbowLeaderboardForChasingPackDisplay } from "./warbowChasingPackLeaderboard";

const WAD_ONE_CHARM = 10n ** 18n;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export function useTimeCurveArenaModel() {
  const prefersReducedMotion = useReducedMotion();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const tc = addresses.timeCurve;
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [claims, setClaims] = useState<CharmRedemptionItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [claimsNote, setClaimsNote] = useState<string | null>(null);
  /** Gross CL8Y spend (wei) chosen in the buy panel; slider + input stay in sync. */
  const [spendWei, setSpendWei] = useState(0n);
  const [spendInputStr, setSpendInputStr] = useState("");
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [pvpErr, setPvpErr] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<PayWithAsset>("cl8y");
  const [displayTick, setDisplayTick] = useState(0);
  const [blockSyncWallMs, setBlockSyncWallMs] = useState(() => Date.now());
  const [useReferral, setUseReferral] = useState(true);
  const [plantWarBowFlag, setPlantWarBowFlag] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [warbowLb, setWarbowLb] = useState<WarbowLeaderboardItem[] | null>(null);
  const [warbowFeed, setWarbowFeed] = useState<WarbowBattleFeedItem[] | null>(null);
  const [stealVictimInput, setStealVictimInput] = useState("");
  const [stealBypass, setStealBypass] = useState(false);
  const [prizePayouts, setPrizePayouts] = useState<PrizePayoutItem[] | null>(null);
  const [prizeDist, setPrizeDist] = useState<PrizeDistributionItem[] | null>(null);
  const [refApplied, setRefApplied] = useState<ReferralAppliedItem[] | null>(null);
  const [buysNextOffset, setBuysNextOffset] = useState<number | null>(null);
  /** Total rows in idx_timecurve_buy (from indexer API); null if unknown or fetch failed. */
  const [buysTotal, setBuysTotal] = useState<number | null>(null);
  const [loadingMoreBuys, setLoadingMoreBuys] = useState(false);
  const [hasExpandedBuyPages, setHasExpandedBuyPages] = useState(false);
  const [buyListModalOpen, setBuyListModalOpen] = useState(false);
  const [detailBuy, setDetailBuy] = useState<BuyItem | null>(null);
  const [buyerStats, setBuyerStats] = useState<TimecurveBuyerStats | null>(null);
  const [gasBuy, setGasBuy] = useState<bigint | undefined>(undefined);
  const [gasBuyIssue, setGasBuyIssue] = useState<string | null>(null);
  const [gasClaim, setGasClaim] = useState<bigint | undefined>(undefined);
  const [gasDistribute, setGasDistribute] = useState<bigint | undefined>(undefined);
  const [gasWarbowSteal, setGasWarbowSteal] = useState<bigint | undefined>(undefined);
  const [gasWarbowGuard, setGasWarbowGuard] = useState<bigint | undefined>(undefined);
  const [gasWarbowFlag, setGasWarbowFlag] = useState<bigint | undefined>(undefined);
  const [gasWarbowRevenge, setGasWarbowRevenge] = useState<bigint | undefined>(undefined);
  const [warbowPreflightIssue, setWarbowPreflightIssue] = useState<string | null>(null);
  const [pendingRevengeRows, setPendingRevengeRows] = useState<WarbowPendingRevengeItem[]>([]);

  /** Drop stale parallel responses when unmounting or a newer refresh starts ([GitLab #182](https://gitlab.com/PlasticDigits/yieldomega/-/issues/182)). */
  const warbowIndexerFetchSeqRef = useRef(0);
  const refreshWarbowIndexerAggregates = useCallback(async () => {
    const seq = ++warbowIndexerFetchSeqRef.current;
    const [lb, fd] = await Promise.all([
      fetchTimecurveWarbowLeaderboard(12, 0),
      fetchTimecurveWarbowBattleFeed(20, 0),
    ]);
    if (seq !== warbowIndexerFetchSeqRef.current) {
      return;
    }
    const ok = lb != null && fd != null;
    if (indexerBaseUrl()) {
      reportIndexerFetchAttempt(ok);
    }
    setWarbowLb(lb?.items ?? null);
    setWarbowFeed(fd?.items ?? null);
  }, []);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { data: latestBlock } = useBlock({ watch: true });
  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;

  /**
   * Chain time for the countdown **(seconds)** and onchain-consistent checks (flags, streaks).
   * Must match `block.timestamp` — do **not** add wall-clock drift here.
   */
  const blockChainSec =
    blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000;

  /** Re-sync wall clock when a new head block arrives so we interpolate from fresh `block.timestamp`. */
  useEffect(() => {
    if (latestBlock?.timestamp !== undefined) {
      setBlockSyncWallMs(Date.now());
    }
  }, [latestBlock?.number, latestBlock?.timestamp]);

  /**
   * Smooth chain time: last `block.timestamp` plus wall elapsed since that block was observed.
   * Used for "now" display (e.g. Unix timestamps). Keep this tick coarse (100ms).
   */
  const effectiveLedgerSec = useMemo(() => {
    void displayTick;
    if (blockTimestampSec !== undefined) {
      return blockTimestampSec + (Date.now() - blockSyncWallMs) / 1000;
    }
    return Date.now() / 1000;
  }, [blockTimestampSec, blockSyncWallMs, displayTick]);

  const failIfWrongChainForWrites = useCallback((): boolean => {
    const msg = chainMismatchWriteMessage(chainId);
    if (!msg) return false;
    setBuyErr(msg);
    return true;
  }, [chainId]);
  const failIfWrongChainForPvpWrites = useCallback((): boolean => {
    const msg = chainMismatchWriteMessage(chainId);
    if (!msg) return false;
    setPvpErr(msg);
    return true;
  }, [chainId]);

  const ledgerSecInt = Math.floor(blockChainSec);
  const ledgerSecIntRef = useRef(ledgerSecInt);
  ledgerSecIntRef.current = ledgerSecInt;

  const {
    heroTimer,
    secondsRemaining: deadlineSecondsRemaining,
    chainNowSec: heroChainNowSec,
    isBusy: heroTimerBusy,
    refresh: loadHeroTimer,
  } = useTimecurveHeroTimer(tc);

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  useEffect(() => {
    const id = window.setInterval(() => setDisplayTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, []);

  const primaryButtonMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.02, y: -2 },
        whileTap: { scale: 0.98, y: 1 },
      };
  const secondaryButtonMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.015, y: -2 },
        whileTap: { scale: 0.985, y: 1 },
      };

  useEffect(() => {
    setPendingRef(getPendingReferralCode());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestSeq = 0;
    let timeoutId = 0;

    const loadBuys = async () => {
      const id = ++requestSeq;
      const data = await fetchTimecurveBuys(25, 0);
      if (cancelled || id !== requestSeq) {
        return;
      }
      const ok = data != null;
      if (indexerBaseUrl()) {
        reportIndexerFetchAttempt(ok);
      }
      if (!data) {
        setIndexerNote(
          indexerBaseUrl()
            ? "Could not load buys from the indexer (offline, CORS, or HTTP error). Check the indexer is running."
            : "Set VITE_INDEXER_URL to load recent buys from the indexer.",
        );
        setBuys([]);
        setBuysNextOffset(null);
        setBuysTotal(null);
        return;
      }
      setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
      if (!hasExpandedBuyPages) {
        setBuysNextOffset(data.next_offset);
      }
      setBuysTotal(typeof data.total === "number" ? data.total : null);
      setIndexerNote(null);
    };

    const scheduleLoop = () => {
      timeoutId = window.setTimeout(async () => {
        await loadBuys();
        if (!cancelled && indexerBaseUrl()) {
          scheduleLoop();
        }
      }, getIndexerBackoffPollMs(3000));
    };

    void (async () => {
      await loadBuys();
      if (!cancelled && indexerBaseUrl()) {
        scheduleLoop();
      }
    })();

    return () => {
      cancelled = true;
      requestSeq += 1;
      window.clearTimeout(timeoutId);
    };
  }, [hasExpandedBuyPages]);

  const selectBuy = useCallback((buy: BuyItem) => {
    setDetailBuy(buy);
  }, []);

  const openBuyListModal = useCallback(() => {
    setBuyListModalOpen(true);
  }, []);

  useEffect(() => {
    if (!buyListModalOpen && !detailBuy) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      e.preventDefault();
      if (detailBuy) {
        setDetailBuy(null);
      } else {
        setBuyListModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyListModalOpen, detailBuy]);

  useEffect(() => {
    if (!buyListModalOpen && !detailBuy) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [buyListModalOpen, detailBuy]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const scheduleLoop = () => {
      timeoutId = window.setTimeout(async () => {
        await refreshWarbowIndexerAggregates();
        if (!cancelled && indexerBaseUrl()) {
          scheduleLoop();
        }
      }, getIndexerBackoffPollMs(5000));
    };

    void (async () => {
      await refreshWarbowIndexerAggregates();
      if (!cancelled && indexerBaseUrl()) {
        scheduleLoop();
      }
    })();

    return () => {
      cancelled = true;
      warbowIndexerFetchSeqRef.current += 1;
      window.clearTimeout(timeoutId);
    };
  }, [refreshWarbowIndexerAggregates]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveCharmRedemptions(15);
      if (cancelled) {
        return;
      }
      if (!data) {
        setClaimsNote("Set VITE_INDEXER_URL to load charm redemptions.");
        setClaims([]);
        return;
      }
      setClaims(data.items);
      setClaimsNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [pp, pd, ra] = await Promise.all([
        fetchTimecurvePrizePayouts(20),
        fetchTimecurvePrizeDistributions(10),
        fetchReferralApplied(address, 15),
      ]);
      if (cancelled) {
        return;
      }
      setPrizePayouts(pp?.items ?? null);
      setPrizeDist(pd?.items ?? null);
      setRefApplied(ra?.items ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!address || !indexerBaseUrl()) {
      setBuyerStats(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const s = await fetchTimecurveBuyerStats(address);
      if (!cancelled) {
        setBuyerStats(s);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const coreTcContracts = tc
    ? [
        { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" },
        { address: tc, abi: timeCurveReadAbi, functionName: "deadline" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" },
        { address: tc, abi: timeCurveReadAbi, functionName: "ended" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentMaxBuyAmount" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentCharmBoundsWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "currentPricePerCharmWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "charmPrice" },
        { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
        { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" },
        { address: tc, abi: timeCurveReadAbi, functionName: "initialMinBuy" },
        { address: tc, abi: timeCurveReadAbi, functionName: "growthRateWad" },
        { address: tc, abi: timeCurveReadAbi, functionName: "timerExtensionSec" },
        { address: tc, abi: timeCurveReadAbi, functionName: "initialTimerSec" },
        { address: tc, abi: timeCurveReadAbi, functionName: "timerCapSec" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalTokensForSale" },
        { address: tc, abi: timeCurveReadAbi, functionName: "launchedToken" },
        { address: tc, abi: timeCurveReadAbi, functionName: "prizesDistributed" },
        { address: tc, abi: timeCurveReadAbi, functionName: "buyFeeRoutingEnabled" },
        { address: tc, abi: timeCurveReadAbi, functionName: "feeRouter" },
        { address: tc, abi: timeCurveReadAbi, functionName: "podiumPool" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalCharmWeight" },
        { address: tc, abi: timeCurveReadAbi, functionName: "buyCooldownSec" },
        { address: tc, abi: timeCurveReadAbi, functionName: "timeCurveBuyRouter" },
        { address: tc, abi: timeCurveReadAbi, functionName: "reservePodiumPayoutsEnabled" },
        { address: tc, abi: timeCurveReadAbi, functionName: "owner" },
      ]
    : [];
  const {
    data: coreTcDataRaw,
    isPending: coreTcPending,
    isError: coreTcError,
    refetch: refetchCoreTc,
  } = useReadContracts({
    contracts: coreTcContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc),
      refetchInterval: 1000,
    },
  });
  const coreTcData = coreTcDataRaw as readonly ContractReadRow[] | undefined;

  const warbowContracts = tc
    ? [
        { address: tc, abi: timeCurveReadAbi, functionName: "warbowPendingFlagOwner" },
        { address: tc, abi: timeCurveReadAbi, functionName: "warbowPendingFlagPlantAt" },
        { address: tc, abi: timeCurveReadAbi, functionName: "warbowLadderPodium" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_STEAL_BURN_WAD" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_GUARD_BURN_WAD" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_FLAG_SILENCE_SEC" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_FLAG_CLAIM_BP" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_MAX_STEALS_PER_DAY" },
        { address: tc, abi: timeCurveReadAbi, functionName: "SECONDS_PER_DAY" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_REVENGE_WINDOW_SEC" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_REVENGE_BURN_WAD" },
        { address: tc, abi: timeCurveReadAbi, functionName: "warbowPodiumFinalized" },
      ]
    : [];
  const {
    data: warbowPolicyDataRaw,
    isPending: warbowPolicyPending,
    isError: warbowPolicyError,
    refetch: refetchWarbowPolicy,
  } = useReadContracts({
    contracts: warbowContracts as readonly unknown[],
    query: { enabled: Boolean(tc), refetchInterval: 1000 },
  });
  const warbowPolicyData = warbowPolicyDataRaw as readonly ContractReadRow[] | undefined;

  const isPending = coreTcPending || warbowPolicyPending;
  const isError = coreTcError || warbowPolicyError;
  const refetch = useCallback(() => {
    void refetchCoreTc();
    void refetchWarbowPolicy();
  }, [refetchCoreTc, refetchWarbowPolicy]);

  useEffect(() => {
    if (tc && latestBlock?.number !== undefined) {
      void refetchCoreTc();
      void refetchWarbowPolicy();
    }
  }, [tc, latestBlock?.number, latestBlock?.timestamp, refetchCoreTc, refetchWarbowPolicy]);

  const userSaleContracts =
    tc && address
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "charmWeight", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "buyCount", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "charmsRedeemed", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalEffectiveTimerSecAdded", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "battlePoints", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "activeDefendedStreak", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "bestDefendedStreak", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "warbowGuardUntil", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "nextBuyAllowedAt", args: [address] },
        ]
      : [];
  const {
    data: userSaleDataRaw,
    refetch: refetchUserSale,
  } = useReadContracts({
    contracts: userSaleContracts as readonly unknown[],
    query: { enabled: Boolean(tc && address) },
  });
  const userSaleData = userSaleDataRaw as readonly ContractReadRow[] | undefined;

  useWatchContractEvent({
    address: tc,
    abi: timeCurveBuyEventAbi,
    eventName: "Buy",
    enabled: Boolean(tc),
    onLogs: () => {
      void refetchCoreTc();
      void refetchUserSale();
      void loadHeroTimer();
    },
  });

  const stealVictim =
    stealVictimInput.trim() && isAddress(stealVictimInput.trim() as `0x${string}`)
      ? (stealVictimInput.trim() as `0x${string}`)
      : undefined;

  const utcDayId = BigInt(Math.floor(ledgerSecInt / 86_400));

  const { data: victimStealsToday } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "stealsReceivedOnDay",
    args: stealVictim && tc ? [stealVictim, utcDayId] : undefined,
    query: { enabled: Boolean(tc && stealVictim) },
  });
  const { data: attackerStealsToday } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "stealsCommittedByAttackerOnDay",
    args: address && tc ? [address, utcDayId] : undefined,
    query: { enabled: Boolean(tc && address) },
  });
  const { data: victimBattlePoints } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "battlePoints",
    args: stealVictim && tc ? [stealVictim] : undefined,
    query: { enabled: Boolean(tc && stealVictim) },
  });

  const [
    saleStart,
    deadline,
    totalRaised,
    ended,
    minBuy,
    maxBuy,
    charmBoundsR,
    pricePerCharmR,
    charmPriceAddrR,
    acceptedAsset,
    refRegAddr,
    initialMinBuyR,
    growthRateWadR,
    timerExtensionSecR,
    initialTimerSecR,
    timerCapSecR,
    totalTokensForSaleR,
    launchedTokenR,
    prizesDistributedR,
    buyFeeRoutingEnabledR,
    feeRouterR,
    podiumPoolR,
    totalCharmWeightR,
    buyCooldownSecR,
    timeCurveBuyRouterR,
    reservePodiumPayoutsEnabledR,
    timeCurveOwnerR,
  ] = coreTcData ?? [];

  const [
    warbowFlagOwnerR,
    warbowFlagPlantR,
    warbowLadderPodiumR,
    warbowStealBurnR,
    warbowGuardBurnR,
    warbowBypassBurnR,
    warbowFlagSilenceR,
    warbowFlagClaimBpR,
    warbowMaxStealsR,
    secondsPerDayR,
    warbowRevengeWindowR,
    warbowRevengeBurnR,
    warbowPodiumFinalizedR,
  ] = warbowPolicyData ?? [];

  const timeCurveOwnerAddr =
    timeCurveOwnerR?.status === "success" ? (timeCurveOwnerR.result as HexAddress) : undefined;
  const canDistributePrizesAsOwner = Boolean(
    address && timeCurveOwnerAddr && sameAddress(address, timeCurveOwnerAddr),
  );

  const [
    charmWeightR,
    buyCountR,
    charmsRedeemedR,
    timerAddedR,
    battlePtsR,
    activeStreakR,
    bestStreakR,
    warbowGuardUntilR,
    nextBuyAllowedAtR,
  ] = userSaleData ?? [];
  const viewerBattlePoints =
    battlePtsR?.status === "success" ? (battlePtsR.result as bigint) : undefined;

  const warbowStealBurnWad =
    warbowStealBurnR?.status === "success" ? (warbowStealBurnR.result as bigint) : 10n ** 18n;
  const warbowGuardBurnWad =
    warbowGuardBurnR?.status === "success" ? (warbowGuardBurnR.result as bigint) : 10n * 10n ** 18n;
  const warbowBypassBurnWad =
    warbowBypassBurnR?.status === "success" ? (warbowBypassBurnR.result as bigint) : 50n * 10n ** 18n;
  const warbowFlagSilenceSec =
    warbowFlagSilenceR?.status === "success" ? (warbowFlagSilenceR.result as bigint) : 300n;
  const warbowFlagClaimBp =
    warbowFlagClaimBpR?.status === "success" ? (warbowFlagClaimBpR.result as bigint) : 1000n;
  const warbowMaxSteals =
    warbowMaxStealsR?.status === "success" ? Number(warbowMaxStealsR.result as number | bigint) : 3;
  const warbowRevengeBurnWad =
    warbowRevengeBurnR?.status === "success" ? (warbowRevengeBurnR.result as bigint) : 10n ** 18n;
  const warbowPodiumFinalized =
    warbowPodiumFinalizedR?.status === "success" ? (warbowPodiumFinalizedR.result as boolean) : undefined;

  void secondsPerDayR;
  void warbowRevengeWindowR;

  const tokenAddr =
    acceptedAsset?.status === "success" ? (acceptedAsset.result as `0x${string}`) : undefined;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

  const launchedAddr =
    launchedTokenR?.status === "success"
      ? (launchedTokenR.result as unknown as `0x${string}`)
      : undefined;

  const { data: launchedDecimals } = useReadContract({
    address: launchedAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(launchedAddr) },
  });

  const launchedDec = launchedDecimals !== undefined ? Number(launchedDecimals) : 18;

  const referralRegistryOn =
    refRegAddr?.status === "success" &&
    (refRegAddr.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000";

  const { data: referralEachBps } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "REFERRAL_EACH_BPS",
    query: { enabled: Boolean(tc) },
  });
  const referralEachSideLabel =
    referralEachBps !== undefined ? formatBpsAsPercent(Number(referralEachBps)) : "5.00%";

  const buyFeeRoutingEnabled =
    buyFeeRoutingEnabledR?.status === "success"
      ? (buyFeeRoutingEnabledR.result as boolean)
      : undefined;

  const feeRouterAddr =
    feeRouterR?.status === "success" ? (feeRouterR.result as `0x${string}`) : undefined;
  const podiumPoolAddr =
    podiumPoolR?.status === "success" ? (podiumPoolR.result as `0x${string}`) : undefined;

  const { data: sinkReadsRaw } = useReadContracts({
    contracts: (feeRouterAddr
      ? ([0, 1, 2, 3, 4] as const).map((i) => ({
          address: feeRouterAddr,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)],
        }))
      : []) as readonly unknown[],
    query: { enabled: Boolean(feeRouterAddr) },
  });
  const sinkReads = sinkReadsRaw as readonly ContractReadRow[] | undefined;

  const { data: podiumPoolBal } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: podiumPoolAddr ? [podiumPoolAddr] : undefined,
    query: { enabled: Boolean(tokenAddr && podiumPoolAddr) },
  });

  const { data: walletCl8yBal } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: tokenAddr && address ? [address] : undefined,
    query: { enabled: Boolean(tokenAddr && address && isConnected) },
  });

  const liquidityAnchors = useMemo(() => {
    if (totalRaised?.status !== "success" || totalTokensForSaleR?.status !== "success") {
      return null;
    }
    const tr = rawToBigIntForFormat(totalRaised.result as bigint);
    const tts = rawToBigIntForFormat(totalTokensForSaleR.result as bigint);
    const clearing = projectedReservePerDoubWad(tr, tts);
    if (clearing === null) {
      return null;
    }
    const launch = launchLiquidityAnchorWad(clearing);
    const kLo = kumbayaBandLowerWad(launch);
    return {
      clearing: clearing.toString(),
      launch: launch.toString(),
      kLo: kLo.toString(),
    };
  }, [totalRaised, totalTokensForSaleR]);

  const podiumPayoutPreview = useMemo(() => {
    const bal = typeof podiumPoolBal === "bigint" ? podiumPoolBal : 0n;
    const slices = podiumCategorySlices(bal);
    return slices.map((slice, cat) => {
      const [a, b, c] = podiumPlacementShares(slice);
      return { cat, slice, places: [a.toString(), b.toString(), c.toString()] as const };
    });
  }, [podiumPoolBal]);

  const podiumReads = usePodiumReads(tc);

  const linearCharmAddr =
    charmPriceAddrR?.status === "success" &&
    (charmPriceAddrR.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000"
      ? (charmPriceAddrR.result as `0x${string}`)
      : undefined;

  const { data: linearPriceReadsRaw } = useReadContracts({
    contracts: (linearCharmAddr
      ? [
          {
            address: linearCharmAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "basePriceWad",
          },
          {
            address: linearCharmAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad",
          },
        ]
      : []) as readonly unknown[],
    query: { enabled: Boolean(tc && linearCharmAddr) },
  });
  const linearPriceReads = linearPriceReadsRaw as readonly ContractReadRow[] | undefined;

  const [basePriceWadR, dailyIncWadR] = linearPriceReads ?? [];

  const arenaSaleStartSec =
    saleStart?.status === "success" ? Number(saleStart.result as bigint) : undefined;
  const arenaEnded =
    ended?.status === "success" ? (ended.result as boolean) : undefined;
  const arenaDeadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;
  const arenaPhase: SaleSessionPhase = useMemo(
    () =>
      derivePhase({
        hasCoreData: Boolean(coreTcData && coreTcData.length > 0),
        ended: arenaEnded,
        saleStartSec: arenaSaleStartSec,
        deadlineSec: arenaDeadlineSec,
        ledgerSecInt: phaseLedgerSecInt,
      }),
    [coreTcData, arenaEnded, arenaSaleStartSec, arenaDeadlineSec, phaseLedgerSecInt],
  );

  const heroDisplaySecondsRemaining = useMemo(
    () =>
      timecurveHeroDisplaySecondsRemaining({
        phase: arenaPhase,
        saleStartSec:
          heroTimer && heroTimer.saleStartSec > 0
            ? heroTimer.saleStartSec
            : arenaSaleStartSec,
        deadlineSec: heroTimer ? heroTimer.deadlineSec : arenaDeadlineSec,
        chainNowSec: heroChainNowSec,
      }),
    [arenaPhase, heroTimer, arenaSaleStartSec, arenaDeadlineSec, heroChainNowSec],
  );

  // Mutually-exclusive flags derived from `arenaPhase` — the Arena view shares
  // the Simple view's state machine so both pages cannot disagree about which
  // UX branch is live (issue #40 invariant; see
  // `docs/frontend/timecurve-views.md`).
  const arenaFlags = useMemo(() => phaseFlags(arenaPhase), [arenaPhase]);
  const saleActive = arenaFlags.saleActive;

  const flagOwnerAddr =
    warbowFlagOwnerR?.status === "success"
      ? (warbowFlagOwnerR.result as `0x${string}`)
      : undefined;
  const flagPlantAtSec =
    warbowFlagPlantR?.status === "success" ? BigInt(warbowFlagPlantR.result as bigint) : 0n;
  const iHoldPlantFlag =
    Boolean(address && flagOwnerAddr && address.toLowerCase() === flagOwnerAddr.toLowerCase());
  const flagSilenceEndSec = flagPlantAtSec + warbowFlagSilenceSec;
  const canClaimWarBowFlag =
    saleActive &&
    iHoldPlantFlag &&
    flagPlantAtSec > 0n &&
    BigInt(ledgerSecInt) >= flagSilenceEndSec;

  const loadPendingRevenge = useCallback(() => {
    if (!address || !indexerBaseUrl() || !saleActive) {
      setPendingRevengeRows([]);
      return;
    }
    const nowSec = ledgerSecIntRef.current;
    void fetchWarbowPendingRevenge(address, nowSec).then((page) => {
      if (page?.items) {
        setPendingRevengeRows(page.items);
        reportIndexerFetchAttempt(true);
      } else {
        setPendingRevengeRows([]);
        if (indexerBaseUrl()) {
          reportIndexerFetchAttempt(false);
        }
      }
    });
  }, [address, saleActive]);

  const pendingRevengeTargets = useMemo(() => {
    const now = BigInt(ledgerSecInt);
    const rows = pendingRevengeRows.filter((r) => BigInt(r.expiry_exclusive) > now);
    return [...rows].sort((a, b) => {
      const ea = BigInt(a.expiry_exclusive);
      const eb = BigInt(b.expiry_exclusive);
      if (ea < eb) return -1;
      if (ea > eb) return 1;
      return a.stealer.localeCompare(b.stealer);
    });
  }, [pendingRevengeRows, ledgerSecInt]);

  const pendingRevengeStealer =
    pendingRevengeTargets[0]?.stealer !== undefined
      ? (pendingRevengeTargets[0].stealer as `0x${string}`)
      : undefined;
  const revengeDeadlineSec = useMemo(() => {
    if (pendingRevengeTargets.length === 0) {
      return 0n;
    }
    return pendingRevengeTargets.reduce(
      (min, r) => {
        const e = BigInt(r.expiry_exclusive);
        return min === 0n || e < min ? e : min;
      },
      0n,
    );
  }, [pendingRevengeTargets]);
  const hasRevengeOpen = pendingRevengeTargets.length > 0;

  useEffect(() => {
    loadPendingRevenge();
  }, [loadPendingRevenge]);

  useEffect(() => {
    if (!address || !indexerBaseUrl() || !saleActive) {
      return undefined;
    }
    const id = window.setInterval(() => {
      loadPendingRevenge();
    }, 8000);
    return () => window.clearInterval(id);
  }, [address, saleActive, loadPendingRevenge]);

  const guardUntilSec =
    warbowGuardUntilR?.status === "success" ? BigInt(warbowGuardUntilR.result as bigint) : 0n;
  const guardedActive = BigInt(ledgerSecInt) < guardUntilSec;

  const deadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;
  const timerCapSec =
    timerCapSecR?.status === "success" ? Number(timerCapSecR.result as bigint) : undefined;

  const maxBuyAmount =
    maxBuy?.status === "success" ? (maxBuy.result as bigint) : undefined;

  const minSpendCurvePoints = useMemo(() => {
    if (
      initialMinBuyR?.status !== "success" ||
      growthRateWadR?.status !== "success" ||
      saleStart?.status !== "success" ||
      basePriceWadR?.status !== "success" ||
      dailyIncWadR?.status !== "success"
    ) {
      return [];
    }
    const start = Number(saleStart.result as bigint);
    if (start <= 0) {
      return [];
    }
    const elapsed = BigInt(Math.max(0, ledgerSecInt - start));
    if (elapsed === 0n) {
      return [];
    }
    return sampleMinSpendCurve(
      initialMinBuyR.result as bigint,
      growthRateWadR.result as bigint,
      basePriceWadR.result as bigint,
      dailyIncWadR.result as bigint,
      elapsed,
      40,
    );
  }, [initialMinBuyR, growthRateWadR, saleStart, ledgerSecInt, basePriceWadR, dailyIncWadR]);

  const buyEnvelopeParams = useMemo((): EnvelopeCurveParamsWire | null => {
    if (
      initialMinBuyR?.status !== "success" ||
      growthRateWadR?.status !== "success" ||
      saleStart?.status !== "success" ||
      basePriceWadR?.status !== "success" ||
      dailyIncWadR?.status !== "success"
    ) {
      return null;
    }
    const start = Number(saleStart.result as bigint);
    if (start <= 0) {
      return null;
    }
    return {
      saleStartSec: start,
      charmEnvelopeRefWad: (initialMinBuyR.result as bigint).toString(),
      growthRateWad: (growthRateWadR.result as bigint).toString(),
      basePriceWad: (basePriceWadR.result as bigint).toString(),
      dailyIncrementWad: (dailyIncWadR.result as bigint).toString(),
    };
  }, [initialMinBuyR, growthRateWadR, saleStart, basePriceWadR, dailyIncWadR]);

  const cl8ySpendBounds = useMemo(() => {
    if (minBuy?.status !== "success" || maxBuy?.status !== "success") {
      return null;
    }
    const minS = minCl8ySpendBroadcastHeadroom(minBuy.result as bigint);
    let maxS = maxBuy.result as bigint;
    if (payWith === "cl8y" && walletCl8yBal !== undefined) {
      const b = BigInt(walletCl8yBal as bigint);
      if (b < maxS) {
        maxS = b;
      }
    }
    if (minS > maxS) {
      return null;
    }
    return { minS, maxS };
  }, [minBuy, maxBuy, walletCl8yBal, payWith]);

  useEffect(() => {
    if (!cl8ySpendBounds) {
      return;
    }
    const { minS, maxS } = cl8ySpendBounds;
    setSpendWei((prev) => {
      if (prev === 0n || prev < minS || prev > maxS) {
        return clampBigint(minS + (maxS - minS) / 2n, minS, maxS);
      }
      return clampBigint(prev, minS, maxS);
    });
  }, [cl8ySpendBounds]);

  useEffect(() => {
    if (!cl8ySpendBounds) {
      return;
    }
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
  const estimatedSpend = buySizing?.spendWei;

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
    if (payWith === "cl8y" || !tokenAddr || !kumbayaResolved.ok) return null;
    return routingForPayAsset(payWith, tokenAddr, kumbayaResolved.config);
  }, [payWith, tokenAddr, kumbayaResolved]);

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
    saleActive &&
    pricePerCharmForQuote !== undefined &&
    pricePerCharmForQuote > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const launchPayQuoteEnabled =
    payWith !== "cl8y" &&
    saleActive &&
    launchCl8yPerCharmWei !== undefined &&
    launchCl8yPerCharmWei > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const quoteEnabled =
    payWith !== "cl8y" &&
    saleActive &&
    estimatedSpend !== undefined &&
    estimatedSpend > 0n &&
    swapRoute !== null &&
    swapRoute.ok &&
    kumbayaResolved.ok;

  const {
    data: swapQuoteTuple,
    isPending: swapQuotePending,
    isFetching: swapQuoteFetching,
    isError: swapQuoteIsError,
  } = useReadContract({
    address: kumbayaResolved.ok ? kumbayaResolved.config.quoter : undefined,
    abi: kumbayaQuoterV2Abi,
    functionName: "quoteExactOutput",
    args:
      quoteEnabled && swapRoute?.ok ? [swapRoute.path, estimatedSpend!] : undefined,
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
    swapQuoteTuple !== undefined ? (swapQuoteTuple as readonly [bigint, ...unknown[]])[0] : undefined;

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

  const launchPayQuoteLoading =
    launchPayQuoteEnabled && (launchPayQuotePending || launchPayQuoteFetching);

  const rateBoardKumbayaWarning =
    payWith !== "cl8y" &&
    saleActive &&
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
    saleActive &&
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
      return {
        raw: walletCl8yBal !== undefined ? BigInt(walletCl8yBal as bigint) : undefined,
        decimals,
        symbol: "CL8Y",
      };
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
  }, [payWith, walletCl8yBal, decimals, nativeEthBal, usdmWalletBal, payTokenDecimals]);

  const swapQuoteLoading = quoteEnabled && (swapQuotePending || swapQuoteFetching);
  const swapQuoteFailed = swapQuoteIsError;

  const nonCl8yBuyBlocked =
    payWith !== "cl8y" &&
    (kumbayaRoutingBlocker !== null ||
      swapQuoteFailed ||
      quotedPayInWei === undefined ||
      swapQuoteLoading);

  const spendSliderPermille = useMemo(() => {
    if (!cl8ySpendBounds) {
      return 0;
    }
    const { minS, maxS } = cl8ySpendBounds;
    const span = maxS - minS;
    if (span <= 0n) {
      return 0;
    }
    const sw = clampBigint(spendWei, minS, maxS);
    return Number(((sw - minS) * 10000n) / span);
  }, [cl8ySpendBounds, spendWei]);

  const onCl8ySpendSlider = useCallback(
    (permille: number) => {
      if (!cl8ySpendBounds) {
        return;
      }
      const { minS, maxS } = cl8ySpendBounds;
      const p = clampBigint(BigInt(Math.round(permille)), 0n, 10000n);
      const spend = minS + ((maxS - minS) * p) / 10000n;
      setSpendWei(spend);
      setSpendInputStr(formatUnits(spend, decimals));
    },
    [cl8ySpendBounds, decimals],
  );

  const onCl8ySpendInputBlur = useCallback(() => {
    if (!cl8ySpendBounds) {
      return;
    }
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
    heroChainNowSec !== undefined ? heroChainNowSec : Math.floor(blockChainSec);

  const walletCooldownRemainingSec = useMemo(() => {
    if (!saleActive || !isConnected || nextBuyAllowedAtR?.status !== "success") {
      return 0;
    }
    const nextAllowed = BigInt(nextBuyAllowedAtR.result as bigint);
    if (nextAllowed <= 0n) {
      return 0;
    }
    return Math.max(0, Math.ceil(Number(nextAllowed) - chainNowForCooldown));
  }, [saleActive, isConnected, nextBuyAllowedAtR, chainNowForCooldown]);

  const timerExtensionPreview =
    saleActive &&
    deadlineSecondsRemaining !== undefined &&
    timerExtensionSecR?.status === "success" &&
    timerCapSec !== undefined
      ? Math.max(
          0,
          Math.min(
            Number(timerExtensionSecR.result as bigint),
            Math.max(0, timerCapSec - deadlineSecondsRemaining),
          ),
        )
      : undefined;
  const { saleEnded, timerExpiredAwaitingEnd } = arenaFlags;
  // Single source of truth for the sale-phase badge: shared with the Simple
  // and Protocol views so wording / tones / icons never drift between pages.
  const arenaPhaseBadge = phaseBadge(arenaPhase);

  const warbowPodiumWalletList = useMemo((): readonly `0x${string}`[] | undefined => {
    if (warbowLadderPodiumR?.status !== "success") {
      return undefined;
    }
    const [wallets] = warbowLadderPodiumR.result as readonly [readonly `0x${string}`[], readonly bigint[]];
    return wallets;
  }, [warbowLadderPodiumR]);

  const dotMegaAddressList = useMemo(
    () =>
      collectTimecurveWalletAddressesForDotMega({
        connected: address,
        stealVictim,
        stealVictimInput,
        warbowLb,
        buys,
        claims,
        prizePayouts,
        refApplied,
        warbowFeed,
        podiumRows: podiumReads.data ?? [],
        warbowPodiumWallets: warbowPodiumWalletList,
        pendingRevengeStealer,
        pendingRevengeStealers: pendingRevengeTargets.map((t) => t.stealer),
      }),
    [
      address,
      stealVictim,
      stealVictimInput,
      warbowLb,
      buys,
      claims,
      prizePayouts,
      refApplied,
      warbowFeed,
      podiumReads.data,
      warbowPodiumWalletList,
      pendingRevengeStealer,
      pendingRevengeTargets,
    ],
  );

  const dotMegaNameByAddress = useDotMegaNameMap(dotMegaAddressList);
  const formatWallet = useMemo(() => walletDisplayFromMap(dotMegaNameByAddress), [dotMegaNameByAddress]);

  const warbowRank =
    address && warbowLb
      ? warbowLb.findIndex((row) => sameAddress(row.buyer, address)) + 1 || null
      : null;
  const warbowTopRows: RankingRow[] = useMemo(() => {
    if (warbowLadderPodiumR?.status !== "success") {
      return [];
    }
    const [wallets, values] = warbowLadderPodiumR.result as readonly [
      readonly `0x${string}`[],
      readonly bigint[],
    ];
    return [0, 1, 2].map((index) => ({
      key: `warbow-contract-${index}`,
      rank: index + 1,
      label: <TimeCurveArenaWalletMono addr={wallets[index]} formatWallet={formatWallet} />,
      meta: sameAddress(wallets[index], address) ? "Connected wallet" : "Contract snapshot",
      value: `${values[index] !== undefined ? formatLocaleInteger(values[index]) : "—"} BP`,
      highlight: sameAddress(wallets[index], address),
    }));
  }, [warbowLadderPodiumR, formatWallet, address]);

  const warbowLeaderboardRows: RankingRow[] = useMemo(
    () =>
      warbowLeaderboardForChasingPackDisplay(warbowLb).map((row, index) => ({
        key: `warbow-indexer-${row.buyer}`,
        rank: index + 1,
        label: <TimeCurveArenaWalletMono addr={row.buyer} formatWallet={formatWallet} />,
        meta: sameAddress(row.buyer, address)
          ? "Connected wallet"
          : `block ${formatLocaleInteger(row.block_number)}`,
        value: `${formatLocaleInteger(BigInt(row.battle_points_after))} BP`,
        highlight: sameAddress(row.buyer, address),
      })),
    [warbowLb, formatWallet, address],
  );
  const warbowStealCandidates: WarbowStealCandidate[] = useMemo(() => {
    const candidates = new Map<string, WarbowStealCandidate>();
    const viewerBp = viewerBattlePoints;

    function canSuggest(addr: string | undefined, battlePoints: bigint): addr is `0x${string}` {
      if (!addr || !isAddress(addr as `0x${string}`) || sameAddress(addr, ZERO_ADDR) || sameAddress(addr, address)) {
        return false;
      }
      if (battlePoints <= 0n) {
        return false;
      }
      if (viewerBp !== undefined && viewerBp === 0n) {
        return false;
      }
      return viewerBp === undefined || battlePoints >= viewerBp * 2n;
    }

    function addCandidate(candidate: WarbowStealCandidate) {
      const key = candidate.address.toLowerCase();
      const existing = candidates.get(key);
      if (!existing || existing.source !== "contract") {
        candidates.set(key, candidate);
      }
    }

    if (warbowLadderPodiumR?.status === "success") {
      const [wallets, values] = warbowLadderPodiumR.result as readonly [
        readonly `0x${string}`[],
        readonly bigint[],
      ];
      wallets.forEach((wallet, index) => {
        const bp = values[index] ?? 0n;
        if (canSuggest(wallet, bp)) {
          addCandidate({
            address: wallet,
            battlePoints: bp.toString(),
            rank: index + 1,
            source: "contract",
          });
        }
      });
    }

    (warbowLb ?? []).forEach((row, index) => {
      const bp = BigInt(row.battle_points_after);
      if (canSuggest(row.buyer, bp)) {
        addCandidate({
          address: row.buyer as `0x${string}`,
          battlePoints: bp.toString(),
          rank: index + 1,
          source: "indexer",
        });
      }
    });

    return [...candidates.values()]
      .sort((a, b) => {
        const bpA = BigInt(a.battlePoints);
        const bpB = BigInt(b.battlePoints);
        if (bpA === bpB) return a.rank - b.rank;
        return bpA > bpB ? -1 : 1;
      })
      .slice(0, 5);
  }, [address, viewerBattlePoints, warbowLadderPodiumR, warbowLb]);

  const refetchAll = useCallback(() => {
    void refetch();
    void refetchUserSale();
    loadPendingRevenge();
    void refreshWarbowIndexerAggregates();
    if (address && indexerBaseUrl()) {
      void fetchTimecurveBuyerStats(address).then(setBuyerStats);
    }
  }, [refetch, refetchUserSale, address, loadPendingRevenge, refreshWarbowIndexerAggregates]);

  const expectedTokenFromCharms = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return undefined;
    }
    if (totalTokensForSaleR?.status !== "success") {
      return undefined;
    }
    if (charmWeightR?.status !== "success") {
      return undefined;
    }
    const tcw = totalCharmWeightR?.status === "success" ? (totalCharmWeightR.result as bigint) : 0n;
    if (tcw === 0n) {
      return undefined;
    }
    const us = charmWeightR.result as bigint;
    const tts = totalTokensForSaleR.result as bigint;
    return (tts * us) / tcw;
  }, [ended, totalCharmWeightR, totalTokensForSaleR, charmWeightR]);

  const indexerMismatch = useMemo(() => {
    if (!buyerStats || charmWeightR?.status !== "success" || buyCountR?.status !== "success") {
      return null;
    }
    let idxSpend: bigint;
    let idxCount: bigint;
    try {
      idxSpend = BigInt(buyerStats.indexed_charm_weight);
      idxCount = BigInt(buyerStats.indexed_buy_count);
    } catch {
      return "Could not parse indexer stats.";
    }
    const chainSpend = charmWeightR.result as bigint;
    const chainBuys = buyCountR.result as bigint;
    if (idxSpend !== chainSpend || idxCount !== chainBuys) {
      return "Indexer totals differ from onchain charmWeight / buyCount (lag, reorg, or indexing bug). Trust the contract for execution.";
    }
    return null;
  }, [buyerStats, charmWeightR, buyCountR]);

  const claimHint = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return null;
    }
    if (charmWeightR?.status !== "success" || (charmWeightR.result as bigint) === 0n) {
      return "No charm weight.";
    }
    if (charmsRedeemedR?.status === "success" && charmsRedeemedR.result) {
      return "Already redeemed.";
    }
    if (expectedTokenFromCharms === undefined) {
      return undefined;
    }
    if (expectedTokenFromCharms === 0n) {
      return "Nothing to redeem at current totals (rounding).";
    }
    return null;
  }, [ended, charmWeightR, charmsRedeemedR, expectedTokenFromCharms]);

  const distributeHint = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return "End the sale first.";
    }
    if (prizesDistributedR?.status === "success" && prizesDistributedR.result) {
      return "Prizes already marked distributed.";
    }
    if (address && timeCurveOwnerAddr && !sameAddress(address, timeCurveOwnerAddr)) {
      return "Only the TimeCurve owner wallet can call distributePrizes onchain (issue #70).";
    }
    const reserveOn =
      reservePodiumPayoutsEnabledR?.status === "success" &&
      (reservePodiumPayoutsEnabledR.result as boolean);
    const podiumFinalized =
      warbowPodiumFinalizedR?.status === "success" && (warbowPodiumFinalizedR.result as boolean);
    if (
      reserveOn &&
      address &&
      timeCurveOwnerAddr &&
      sameAddress(address, timeCurveOwnerAddr) &&
      !podiumFinalized
    ) {
      return "Owner: call finalizeWarbowPodium(first, second, third) before distributePrizes when reserve podium payouts are on and the WarBow prize slice may be non-zero (GitLab #129 / #172). Empty pool paths still no-op.";
    }
    return "May return without changing state if the podium pool balance is too small; retry after fees accrue.";
  }, [
    ended,
    prizesDistributedR,
    address,
    timeCurveOwnerAddr,
    reservePodiumPayoutsEnabledR,
    warbowPodiumFinalizedR,
  ]);

  const timerNarrative = useMemo(
    () => describeTimerPreview(deadlineSecondsRemaining, timerExtensionPreview),
    [deadlineSecondsRemaining, timerExtensionPreview],
  );

  const totalRaiseDisplay = useMemo(() => {
    if (totalRaised?.status !== "success") {
      return { cl8y: "—" as const, usd: "—" as const };
    }
    const raw = totalRaised.result as bigint;
    const human = Number(formatUnits(raw, decimals));
    if (!Number.isFinite(human)) {
      return { cl8y: "—" as const, usd: "—" as const };
    }
    const cl8y = human.toLocaleString(undefined, { maximumFractionDigits: 6 });
    const usd = (human * CL8Y_USD_PRICE_PLACEHOLDER).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
    return { cl8y, usd };
  }, [totalRaised, decimals]);

  const confettiGuide = useMemo(() => {
    const latestBuy = buys?.[0];
    if (!latestBuy) {
      return null;
    }
    const envParsed = buyEnvelopeParams ? envelopeCurveParamsFromWire(buyEnvelopeParams) : null;
    const ratio = envParsed ? buySpendEnvelopeFillRatio(latestBuy, envParsed) : null;
    const amountLabel = `${formatCompactFromRaw(latestBuy.amount, decimals, { sigfigs: 3 })} CL8Y`;
    const color = ratio === null ? (timerNarrative.tone === "critical" ? "#ef4444" : "#fde68a") : buySizeColor(ratio);
    const eventDetail =
      latestBuy.timer_hard_reset === true
        ? "hard reset burst"
        : latestBuy.actual_seconds_added?.trim()
          ? `+${latestBuy.actual_seconds_added.trim()}s burst`
          : "new buy burst";
    return {
      color,
      bandLabel: describeBurstBand(ratio),
      latestLabel: `${amountLabel} · ${eventDetail}`,
      help: "Confetti color tracks buy size from blue min-band buys to red near-max buys.",
    };
  }, [buys, buyEnvelopeParams, decimals, timerNarrative.tone]);

  const warbowPlacementGap = useMemo(() => {
    if (
      battlePtsR?.status !== "success" ||
      warbowLadderPodiumR?.status !== "success" ||
      !address
    ) {
      return null;
    }
    const [, values] = warbowLadderPodiumR.result as readonly [readonly `0x${string}`[], readonly bigint[]];
    const currentBp = battlePtsR.result as bigint;
    const third = values[2] ?? 0n;
    if (third <= 0n || currentBp >= third) {
      return null;
    }
    return third - currentBp + 1n;
  }, [address, battlePtsR, warbowLadderPodiumR]);

  const whatMattersNowCards = useMemo(() => {
    if (saleEnded) {
      return [
        {
          label: "Round state",
          value: "Redeem and settle",
          meta: claimHint ?? "Charm holders can redeem launched tokens while podium payouts get finalized.",
        },
        {
          label: "Your claim",
          value:
            expectedTokenFromCharms !== undefined ? (
              <AmountDisplay raw={expectedTokenFromCharms.toString()} decimals={18} />
            ) : (
              "—"
            ),
          meta: "Projected launched-token redemption from your current charm weight.",
        },
        {
          label: "Podium pool",
          value:
            podiumPoolBal !== undefined ? (
              <AmountDisplay raw={(podiumPoolBal as bigint).toString()} decimals={decimals} />
            ) : (
              "—"
            ),
          meta: distributeHint,
        },
      ];
    }

    return [
      {
        label: "What matters now",
        value:
          canClaimWarBowFlag
            ? "Claim your flag"
            : hasRevengeOpen
              ? "Take revenge"
              : saleActive &&
                  deadlineSecondsRemaining !== undefined &&
                  deadlineSecondsRemaining < 780
                ? "Clutch reset window"
                : "Make the next move",
        meta:
          canClaimWarBowFlag
            ? "Silence has held long enough. Claiming now locks in a visible WarBow moment."
            : hasRevengeOpen
              ? "You have a live revenge window. Hit back before it expires."
              : saleActive &&
                  deadlineSecondsRemaining !== undefined &&
                  deadlineSecondsRemaining < 780
                ? "Buys now can hard-reset the timer toward 15 minutes and swing the room."
                : "A buy can move timer, podiums, and WarBow status in one shot.",
      },
      {
        label: "Timer pressure",
        value: timerNarrative.label,
        meta: timerNarrative.detail,
      },
      {
        label: "Visible chase",
        value:
          warbowPlacementGap !== null
            ? `${formatLocaleInteger(warbowPlacementGap)} BP to podium`
            : warbowRank
              ? `WarBow rank #${warbowRank}`
              : "Break into the ladder",
        meta:
          warbowPlacementGap !== null
            ? "A few good PvP swings can put you on the visible WarBow board."
            : warbowRank
              ? "Stay visible by defending your position or stealing momentum."
              : "Even a smaller buy can start your status climb.",
      },
      {
        label: "Why watch",
        value:
          saleActive &&
          deadlineSecondsRemaining !== undefined &&
          deadlineSecondsRemaining < 780
            ? "Every buy is a swing"
            : "Lurkers can still enjoy the race",
        meta:
          saleActive &&
          deadlineSecondsRemaining !== undefined &&
          deadlineSecondsRemaining < 780
            ? "Under 13 minutes, resets, streak breaks, and clutch buys become the whole show."
            : "Podiums, streaks, guards, and revenge make the page readable even before you buy.",
      },
    ];
  }, [
    saleEnded,
    claimHint,
    expectedTokenFromCharms,
    podiumPoolBal,
    decimals,
    distributeHint,
    canClaimWarBowFlag,
    hasRevengeOpen,
    deadlineSecondsRemaining,
    saleActive,
    timerNarrative,
    warbowPlacementGap,
    warbowRank,
  ]);

  const buyPanelHighlights = useMemo(() => {
    if (saleEnded) {
      return [];
    }
    const items: string[] = [];
    items.push(timerNarrative.detail);
    if (
      saleActive &&
      deadlineSecondsRemaining !== undefined &&
      deadlineSecondsRemaining < 780
    ) {
      items.push("You are inside the hard-reset band, so this buy can drag the timer back toward 15 minutes.");
    }
    if (referralRegistryOn && pendingRef && useReferral) {
      items.push(
        `Referral ${normalizeReferralCode(pendingRef)} gives both sides a ${referralEachSideLabel} CHARM weight bonus (buyer + referrer) if the buy lands.`,
      );
    }
    if (warbowPlacementGap !== null) {
      items.push(`You are ${formatLocaleInteger(warbowPlacementGap)} BP from visible WarBow placement.`);
    } else if (!warbowRank) {
      items.push("A first move here is enough to start building visible status, not just spend.");
    }
    return items.slice(0, 4);
  }, [
    saleEnded,
    timerNarrative,
    saleActive,
    deadlineSecondsRemaining,
    referralRegistryOn,
    pendingRef,
    useReferral,
    referralEachSideLabel,
    warbowPlacementGap,
    warbowRank,
  ]);

  const buyPanelRisk = useMemo(() => {
    if (!isConnected) {
      return "Connect a wallet to preview spend, timer impact, and eligibility before signing.";
    }
    if (saleEnded) {
      return "Buying is closed because the timer already expired.";
    }
    if (!saleActive) {
      return "Buys unlock once the live round starts.";
    }
    if (payWith !== "cl8y" && kumbayaRoutingBlocker) {
      return kumbayaRoutingBlocker;
    }
    if (payWith !== "cl8y" && swapQuoteLoading) {
      return "Refreshing DEX quote for your CL8Y spend…";
    }
    if (payWith !== "cl8y" && swapQuoteFailed) {
      return "Could not quote this route (no liquidity or misconfigured pools for this chain).";
    }
    if (payWith !== "cl8y" && quotedPayInWei === undefined) {
      return "Waiting for a quotable CL8Y spend (adjust slider if this persists).";
    }
    if (gasBuyIssue) {
      return gasBuyIssue;
    }
    if (walletCooldownRemainingSec > 0) {
      return `Wallet buy cooldown: ${formatCountdown(walletCooldownRemainingSec)} left (onchain pacing; timer uses the same wall-vs-chain skew as the hero countdown).`;
    }
    if (charmBoundsR?.status === "success" && charmWadSelected !== undefined) {
      const [minC, maxC] = charmBoundsR.result as readonly [bigint, bigint];
      if (charmWadSelected < minC || charmWadSelected > maxC) {
        return "This selection drifted outside the live onchain CHARM band. Refresh or choose another size.";
      }
    }
    return "Pre-sign preview looks healthy. Wallet confirmation is still the final source of truth.";
  }, [
    isConnected,
    saleEnded,
    saleActive,
    payWith,
    kumbayaRoutingBlocker,
    swapQuoteLoading,
    swapQuoteFailed,
    quotedPayInWei,
    gasBuyIssue,
    charmBoundsR,
    charmWadSelected,
    walletCooldownRemainingSec,
  ]);

  const victimStealsTodayBigInt =
    victimStealsToday !== undefined ? BigInt(victimStealsToday as bigint | number) : undefined;
  const victimBattlePointsBigInt =
    victimBattlePoints !== undefined ? BigInt(victimBattlePoints as bigint | number) : undefined;
  const attackerStealsTodayBigInt =
    attackerStealsToday !== undefined ? BigInt(attackerStealsToday as bigint | number) : undefined;
  const stealPreflight = useMemo(
    () =>
      describeStealPreflight(
        {
          connected: isConnected,
          saleActive,
          saleEnded,
          viewer: address,
          victim: stealVictim,
          viewerBattlePoints,
          victimBattlePoints: victimBattlePointsBigInt,
          victimStealsToday: victimStealsTodayBigInt,
          attackerStealsToday: attackerStealsTodayBigInt,
          maxStealsPerDay: BigInt(warbowMaxSteals),
          bypassSelected: stealBypass,
          guardActive: guardedActive,
        },
        formatWallet,
      ),
    [
      isConnected,
      saleActive,
      saleEnded,
      address,
      stealVictim,
      viewerBattlePoints,
      victimBattlePointsBigInt,
      victimStealsTodayBigInt,
      attackerStealsTodayBigInt,
      warbowMaxSteals,
      stealBypass,
      guardedActive,
      formatWallet,
    ],
  );

  const warbowActionHint = useMemo(() => {
    if (!isConnected) {
      return "Connect a wallet to see live WarBow eligibility before you press a PvP action.";
    }
    if (!saleActive) {
      return saleEnded
        ? "Steal, guard, and flag actions are locked once the live round ends. Revenge may still depend on onchain state."
        : "WarBow actions unlock when the sale is live.";
    }
    if (canClaimWarBowFlag) {
      return "Claim flag is live now. Taking it banks the silence streak into Battle Points.";
    }
    if (hasRevengeOpen) {
      return "Revenge is available right now. You get one clean answer window against the pending stealer.";
    }
    if (stealVictimInput.trim().length > 0 && !isAddress(stealVictimInput.trim())) {
      return "Enter a valid victim address to preview steal pressure.";
    }
    if (stealVictim) {
      return warbowPreflightIssue ?? `${stealPreflight.title}. ${stealPreflight.detail}`;
    }
    return guardedActive
      ? "Your guard is already up. Use the live window to defend, steal, or buy for momentum."
      : "Target rivals with at least 2× your Battle Points (you need positive BP yourself), or use guard to make yourself harder to drain.";
  }, [
    isConnected,
    saleActive,
    saleEnded,
    canClaimWarBowFlag,
    hasRevengeOpen,
    stealVictimInput,
    stealVictim,
    guardedActive,
    stealPreflight,
    warbowPreflightIssue,
  ]);

  const podiumSpotlights = useMemo(() => {
    const rows = podiumReads.data ?? [];
    return rows.map((row, index) => ({
      key: `podium-spotlight-${index}`,
      label: PODIUM_LABELS[index] ?? `Category ${index + 1}`,
      help: PODIUM_HELP[index] ?? "Current onchain race.",
      leader: (
        <AddressInline address={row.winners[0]} formatWallet={formatWallet} fallback="—" size={22} />
      ),
      value: formatPodiumLeaderboardValue(index, row.values[0] ?? "0"),
      highlight: sameAddress(row.winners[0], address),
    }));
  }, [podiumReads.data, address, formatWallet]);

  const warbowMomentumBars = useMemo(() => {
    if (warbowLadderPodiumR?.status !== "success") {
      return [];
    }
    const [wallets, values] = warbowLadderPodiumR.result as readonly [readonly `0x${string}`[], readonly bigint[]];
    const max = values.reduce((acc, value) => (value > acc ? value : acc), 0n);
    return [0, 1, 2].map((index) => ({
      key: `warbow-bar-${index}`,
      wallet: wallets[index],
      label: formatWallet(wallets[index], "—"),
      value: values[index] ?? 0n,
      width: max > 0n ? Number(((values[index] ?? 0n) * 100n) / max) : 0,
      highlight: sameAddress(wallets[index], address),
    }));
  }, [warbowLadderPodiumR, address, formatWallet]);

  const buyHistoryPoints = useMemo(() => buildBuyHistoryPoints(buys, 6, formatWallet), [buys, formatWallet]);

  const buildBuyNarrativeForFeed = useCallback(
    (buy: BuyItem, viewer: string | undefined) => buildBuyFeedNarrative(buy, viewer, formatWallet),
    [formatWallet],
  );
  const buildWarbowNarrativeForFeed = useCallback(
    (item: WarbowBattleFeedItem, viewer: string | undefined) => buildWarbowFeedNarrative(item, viewer, formatWallet),
    [formatWallet],
  );

  const latestBuyBpBreakdown = useMemo(
    () => (buys && buys.length > 0 ? buildBuyBattlePointBreakdown(buys[0]) : []),
    [buys],
  );

  useEffect(() => {
    if (!address || !tc || !saleActive) {
      setGasBuy(undefined);
      setGasBuyIssue(null);
      return;
    }
    if (payWith !== "cl8y") {
      setGasBuy(undefined);
      setGasBuyIssue(null);
      return;
    }
    const cw = charmWadSelected;
    if (cw === undefined || cw <= 0n) {
      setGasBuy(undefined);
      setGasBuyIssue(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        let codeHash: `0x${string}` | undefined;
        if (useReferral && referralRegistryOn && pendingRef) {
          try {
            codeHash = hashReferralCode(pendingRef);
          } catch {
            setGasBuy(undefined);
            setGasBuyIssue("Referral preview could not be prepared. Double-check the referral code before signing.");
            return;
          }
        }
        const args = codeHash
          ? ([cw, codeHash, plantWarBowFlag] as const)
          : plantWarBowFlag
            ? ([cw, plantWarBowFlag] as const)
            : ([cw] as const);
        const g = await estimateGasUnits({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args,
          account: address,
          chainId,
        });
        setGasBuy(g);
        setGasBuyIssue(
          g === undefined
            ? "Pre-sign simulation could not confirm the buy. Read wallet details carefully before approving."
            : null,
        );
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    address,
    tc,
    saleActive,
    payWith,
    charmWadSelected,
    useReferral,
    referralRegistryOn,
    pendingRef,
    plantWarBowFlag,
    chainId,
  ]);

  useEffect(() => {
    if (!address || !tc || !saleActive || !stealVictim || sameAddress(stealVictim, address)) {
      setGasWarbowSteal(undefined);
      setWarbowPreflightIssue(null);
      return;
    }
    if (stealPreflight.tone === "error") {
      setGasWarbowSteal(undefined);
      setWarbowPreflightIssue(null);
      return;
    }
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          await simulateWriteContract({
            address: tc,
            abi: timeCurveWriteAbi,
            functionName: "warbowSteal",
            args: [stealVictim, stealBypass],
            account: address,
            chainId,
          });
          const gas = await estimateGasUnits({
            address: tc,
            abi: timeCurveWriteAbi,
            functionName: "warbowSteal",
            args: [stealVictim, stealBypass],
            account: address,
            chainId,
          });
          setGasWarbowSteal(gas);
          setWarbowPreflightIssue(
            gas === undefined
              ? "Steal simulation passed but gas could not be estimated. Read the wallet prompt carefully before signing."
              : null,
          );
        } catch (error) {
          setGasWarbowSteal(undefined);
          setWarbowPreflightIssue(friendlyRevertFromUnknown(error));
        }
      })();
    }, 350);
    return () => clearTimeout(timeout);
  }, [address, tc, saleActive, stealVictim, stealBypass, chainId, stealPreflight.tone]);

  useEffect(() => {
    if (!address || !tc || !saleActive) {
      setGasWarbowGuard(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "warbowActivateGuard",
      account: address,
      chainId,
    }).then(setGasWarbowGuard);
  }, [address, tc, saleActive, chainId]);

  useEffect(() => {
    if (!address || !tc || !saleActive || !canClaimWarBowFlag) {
      setGasWarbowFlag(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "claimWarBowFlag",
      account: address,
      chainId,
    }).then(setGasWarbowFlag);
  }, [address, tc, saleActive, canClaimWarBowFlag, chainId]);

  useEffect(() => {
    if (!address || !tc || !saleActive || !hasRevengeOpen || !pendingRevengeStealer) {
      setGasWarbowRevenge(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "warbowRevenge",
      args: [pendingRevengeStealer],
      account: address,
      chainId,
    }).then(setGasWarbowRevenge);
  }, [address, tc, saleActive, hasRevengeOpen, pendingRevengeStealer, chainId]);

  useEffect(() => {
    if (!address || !tc || ended?.status !== "success" || !ended.result) {
      setGasClaim(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "redeemCharms",
      account: address,
      chainId,
    }).then(setGasClaim);
  }, [address, tc, ended, chainId]);

  useEffect(() => {
    if (!address || !tc || ended?.status !== "success" || !ended.result || !canDistributePrizesAsOwner) {
      setGasDistribute(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "distributePrizes",
      account: address,
      chainId,
    }).then(setGasDistribute);
  }, [address, tc, ended, canDistributePrizesAsOwner, chainId]);

  async function handleLoadMoreBuys() {
    if (buysNextOffset === null) {
      return;
    }
    setLoadingMoreBuys(true);
    const data = await fetchTimecurveBuys(25, buysNextOffset);
    setLoadingMoreBuys(false);
    if (!data) {
      return;
    }
    setHasExpandedBuyPages(true);
    setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
    setBuysNextOffset(data.next_offset);
    if (typeof data.total === "number") {
      setBuysTotal(data.total);
    }
  }

  const handleBuy = useCallback(async () => {
    setBuyErr(null);
    if (failIfWrongChainForWrites()) return;
    if (!address || !tc || !tokenAddr) {
      setBuyErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    if (buyFeeRoutingEnabled === false) {
      setBuyErr(
        "Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.",
      );
      return;
    }
    if (walletCooldownRemainingSec > 0) {
      setBuyErr("TimeCurve: buy cooldown");
      return;
    }
    if (charmWadSelected === undefined || charmWadSelected <= 0n) {
      setBuyErr("Choose a CL8Y amount inside the live min–max band (and your balance).");
      return;
    }
    if (charmBoundsR?.status !== "success") {
      setBuyErr("Waiting for onchain CHARM bounds.");
      return;
    }
    const freshSizing = await readFreshTimeCurveBuySizing({
      wagmiConfig,
      timeCurveAddress: tc,
      spendWeiIntent: spendWei,
      walletCl8yCapWei:
        payWith === "cl8y" && walletCl8yBal !== undefined
          ? BigInt(walletCl8yBal as bigint)
          : undefined,
    });
    if (!freshSizing.ok) {
      setBuyErr(freshSizing.message);
      return;
    }
    const buySessionSnapshot = captureWalletBuySession(wagmiConfig);
    if (
      !buySessionSnapshot ||
      buySessionSnapshot.address.toLowerCase() !== address.toLowerCase() ||
      buySessionSnapshot.chainId !== chainId
    ) {
      setBuyErr(WALLET_BUY_SESSION_DRIFT_MESSAGE);
      return;
    }
    const cw = freshSizing.charmWad;
    const amount = freshSizing.spendWei;

    let codeHash: `0x${string}` | undefined;
    if (useReferral && referralRegistryOn && pendingRef) {
      try {
        codeHash = hashReferralCode(pendingRef);
      } catch (e) {
        setBuyErr(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    const totalPull = amount;

    try {
      const guardBuySession = () =>
        assertWalletBuySessionUnchanged(wagmiConfig, buySessionSnapshot);

      if (payWith !== "cl8y") {
        const k = resolveKumbayaRouting(chainId, import.meta.env as unknown as KumbayaEnv);
        if (!k.ok) {
          setBuyErr(k.message);
          return;
        }
        const route = routingForPayAsset(payWith, tokenAddr, k.config);
        if (!route.ok) {
          setBuyErr(route.message);
          return;
        }
        const singleRes = resolveTimeCurveBuyRouterForKumbayaSingleTx(
          onchainTimeCurveBuyRouter,
          import.meta.env as unknown as KumbayaEnv,
        );
        if (singleRes.kind === "mismatch") {
          setBuyErr(singleRes.message);
          return;
        }
        if (singleRes.kind === "ok" && (payWith === "eth" || payWith === "usdm")) {
          guardBuySession();
          await submitKumbayaSingleTxBuy({
            wagmiConfig,
            writeContractAsync: writeContractAsync as WalletWriteAsync,
            userAddress: address,
            chainId,
            timeCurveBuyRouter: singleRes.router,
            payWith,
            kConfig: k.config,
            route,
            cl8yOut: amount,
            charmWad: cw,
            codeHash,
            plantWarBowFlag,
            sessionSnapshot: buySessionSnapshot,
          });
          if (codeHash) {
            clearPendingReferralCode();
            setPendingRef(null);
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
        guardBuySession();
        const qIn = (quote as readonly [bigint, ...unknown[]])[0];
        const maxIn = swapMaxInputFromQuoted(qIn, KUMBAYA_SWAP_SLIPPAGE_BPS);

        if (payWith === "eth") {
          const { hash: wrapHash } = await writeContractWithGasBuffer({
            wagmiConfig,
            writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
            account: address as `0x${string}`,
            chainId,
            address: k.config.weth,
            abi: weth9Abi,
            functionName: "deposit",
            value: maxIn,
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
          guardBuySession();
          const wAllow = await readContract(wagmiConfig, {
            address: k.config.weth,
            abi: weth9Abi,
            functionName: "allowance",
            args: [address, k.config.swapRouter],
          });
          guardBuySession();
          if (wAllow < maxIn) {
            const { hash: wAp } = await writeContractWithGasBuffer({
              wagmiConfig,
              writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
              account: address as `0x${string}`,
              chainId,
              address: k.config.weth,
              abi: weth9Abi,
              functionName: "approve",
              args: [k.config.swapRouter, maxIn],
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: wAp });
            guardBuySession();
          }
        } else if (payWith === "usdm") {
          const uAllow = await readContract(wagmiConfig, {
            address: route.tokenIn,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, k.config.swapRouter],
          });
          guardBuySession();
          if (uAllow < maxIn) {
            const { hash: uAp } = await writeContractWithGasBuffer({
              wagmiConfig,
              writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
              account: address as `0x${string}`,
              chainId,
              address: route.tokenIn,
              abi: erc20Abi,
              functionName: "approve",
              args: [k.config.swapRouter, maxIn],
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: uAp });
            guardBuySession();
          }
        }

        const deadline = await fetchSwapDeadlineUnixSec(wagmiConfig, 600);
        guardBuySession();
        const { hash: swapHash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
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
          onEstimateRevert: "rethrow",
          softCapGas: 6_000_000n,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: swapHash });
        guardBuySession();
      }

      const allow = await readContract(wagmiConfig, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, tc],
      });
      guardBuySession();
      const approveAmt = cl8yTimeCurveApprovalAmountWei(
        totalPull,
        readCl8yTimeCurveUnlimitedApproval(),
      );
      if (allow < totalPull) {
        const { hash: approveHash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address as `0x${string}`,
          chainId,
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [tc, approveAmt],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        guardBuySession();
      }
      const buyArgs = codeHash
        ? ([cw, codeHash, plantWarBowFlag] as const)
        : plantWarBowFlag
          ? ([cw, plantWarBowFlag] as const)
          : ([cw] as const);
      const { hash: buyHash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "buy",
        args: buyArgs,
      });
      guardBuySession();
      playGameSfxCoinHitBuySubmit();
      await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      if (codeHash) {
        clearPendingReferralCode();
        setPendingRef(null);
      }
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e, { buySubmit: true }));
    }
  }, [
    address,
    tc,
    tokenAddr,
    charmWadSelected,
    charmBoundsR,
    spendWei,
    walletCl8yBal,
    payWith,
    useReferral,
    referralRegistryOn,
    pendingRef,
    writeContractAsync,
    refetchAll,
    walletCooldownRemainingSec,
    buyFeeRoutingEnabled,
    chainId,
    onchainTimeCurveBuyRouter,
    plantWarBowFlag,
    failIfWrongChainForWrites,
  ]);

  async function ensureTcAllowance(need: bigint) {
    if (!address || !tokenAddr || !tc || need <= 0n) {
      return;
    }
    const allow = await readContract(wagmiConfig, {
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, tc],
    });
    if (allow < need) {
      const approveAmt = cl8yTimeCurveApprovalAmountWei(
        need,
        readCl8yTimeCurveUnlimitedApproval(),
      );
      const { hash: approveHash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [tc, approveAmt],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
    }
  }

  async function runWarBowClaimFlag() {
    setPvpErr(null);
    if (failIfWrongChainForPvpWrites()) return;
    if (buyFeeRoutingEnabled === false) {
      setPvpErr(
        "Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.",
      );
      return;
    }
    if (!tc || !address) {
      return;
    }
    try {
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "claimWarBowFlag",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowSteal() {
    setPvpErr(null);
    if (failIfWrongChainForPvpWrites()) return;
    if (buyFeeRoutingEnabled === false) {
      setPvpErr(
        "Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.",
      );
      return;
    }
    if (!tc || !address || !stealVictim) {
      setPvpErr("Enter a valid victim address.");
      return;
    }
    const need = warbowStealBurnWad + (stealBypass ? warbowBypassBurnWad : 0n);
    try {
      await ensureTcAllowance(need);
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowSteal",
        args: [stealVictim, stealBypass],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowGuard() {
    setPvpErr(null);
    if (failIfWrongChainForPvpWrites()) return;
    if (buyFeeRoutingEnabled === false) {
      setPvpErr(
        "Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.",
      );
      return;
    }
    if (!tc || !address) {
      return;
    }
    try {
      await ensureTcAllowance(warbowGuardBurnWad);
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowActivateGuard",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowRevenge(stealerArg?: `0x${string}`) {
    setPvpErr(null);
    if (failIfWrongChainForPvpWrites()) return;
    if (buyFeeRoutingEnabled === false) {
      setPvpErr(
        "Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.",
      );
      return;
    }
    const stealer = stealerArg ?? pendingRevengeStealer;
    if (!tc || !address || !stealer) {
      return;
    }
    try {
      await ensureTcAllowance(warbowRevengeBurnWad);
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowRevenge",
        args: [stealer],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runVoid(fn: "endSale" | "redeemCharms" | "distributePrizes") {
    setBuyErr(null);
    if (failIfWrongChainForWrites()) return;
    if (!tc) {
      return;
    }
    try {
      const isDistribute = fn === "distributePrizes";
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address as `0x${string}`,
        chainId,
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: fn,
        ...(isDistribute
          ? { onEstimateRevert: "rethrow" as const, softCapGas: 18_000_000n }
          : {}),
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }
  return {
    acceptedAsset,
    activeStreakR,
    address,
    arenaDeadlineSec,
    arenaEnded,
    arenaFlags,
    arenaPhase,
    arenaPhaseBadge,
    arenaSaleStartSec,
    basePriceWadR,
    battlePtsR,
    bestStreakR,
    blockChainSec,
    blockSyncWallMs,
    blockTimestampSec,
    buildBuyNarrativeForFeed,
    buildWarbowNarrativeForFeed,
    buyCooldownSecR,
    buyCountR,
    buyEnvelopeParams,
    buyErr,
    buyFeeRoutingEnabled,
    buyHistoryPoints,
    buyListModalOpen,
    buyPanelHighlights,
    buyPanelRisk,
    buySizing,
    buyerStats,
    buys,
    buysNextOffset,
    buysTotal,
    canClaimWarBowFlag,
    canDistributePrizesAsOwner,
    chainId,
    chainNowForCooldown,
    charmBoundsR,
    charmPriceAddrR,
    charmWadSelected,
    charmWeightR,
    charmsRedeemedR,
    cl8ySpendBounds,
    claimHint,
    claims,
    claimsNote,
    confettiGuide,
    coreTcContracts,
    coreTcData,
    coreTcDataRaw,
    coreTcError,
    coreTcPending,
    dailyIncWadR,
    deadline,
    deadlineSec,
    decimals,
    detailBuy,
    displayTick,
    distributeHint,
    dotMegaAddressList,
    dotMegaNameByAddress,
    effectiveLedgerSec,
    ended,
    ensureTcAllowance,
    estimatedSpend,
    expectedTokenFromCharms,
    feeRouterAddr,
    feeRouterR,
    flagOwnerAddr,
    flagPlantAtSec,
    flagSilenceEndSec,
    formatWallet,
    gasBuy,
    gasBuyIssue,
    gasClaim,
    gasDistribute,
    gasWarbowFlag,
    gasWarbowGuard,
    gasWarbowRevenge,
    gasWarbowSteal,
    growthRateWadR,
    guardUntilSec,
    guardedActive,
    handleBuy,
    handleLoadMoreBuys,
    hasExpandedBuyPages,
    hasRevengeOpen,
    heroChainNowSec,
    heroTimer,
    heroTimerBusy,
    iHoldPlantFlag,
    indexerMismatch,
    indexerNote,
    initialMinBuyR,
    kumbayaRoutingBlocker,
    initialTimerSecR,
    isConnected,
    isError,
    isPending,
    isWriting,
    latestBlock,
    latestBuyBpBreakdown,
    launchedAddr,
    launchedDec,
    launchedDecimals,
    launchedTokenR,
    ledgerSecInt,
    linearCharmAddr,
    linearPriceReads,
    linearPriceReadsRaw,
    liquidityAnchors,
    loadHeroTimer,
    loadingMoreBuys,
    maxBuy,
    maxBuyAmount,
    minBuy,
    minSpendCurvePoints,
    nextBuyAllowedAtR,
    nonCl8yBuyBlocked,
    onCl8ySpendInputBlur,
    onCl8ySpendSlider,
    openBuyListModal,
    bandBoundaryQuotesLoading,
    payTokenDecimals,
    payWalletBalance,
    payWith,
    pendingRef,
    pendingRevengeStealer,
    pendingRevengeTargets,
    perCharmPayQuoteLoading,
    phaseLedgerSecInt,
    podiumPayoutPreview,
    quotedBandMaxPayInWei,
    quotedBandMinPayInWei,
    quotedPayInWei,
    quotedPerCharmPayInWei,
    quotedLaunchPerCharmPayInWei,
    launchCl8yPerCharmWei,
    launchPayQuoteLoading,
    rateBoardKumbayaWarning,
    podiumPoolAddr,
    podiumPoolBal,
    podiumPoolR,
    podiumReads,
    podiumSpotlights,
    prefersReducedMotion,
    pricePerCharmR,
    primaryButtonMotion,
    prizeDist,
    prizePayouts,
    prizesDistributedR,
    pvpErr,
    refApplied,
    refRegAddr,
    referralEachBps,
    referralEachSideLabel,
    referralRegistryOn,
    refetch,
    refetchAll,
    refetchCoreTc,
    refetchUserSale,
    refetchWarbowPolicy,
    revengeDeadlineSec,
    revengeIndexerConfigured: Boolean(indexerBaseUrl()),
    reservePodiumPayoutsEnabledR,
    runVoid,
    runWarBowClaimFlag,
    runWarBowGuard,
    runWarBowRevenge,
    runWarBowSteal,
    saleActive,
    saleEnded,
    saleStart,
    secondaryButtonMotion,
    secondsPerDayR,
    secondsRemaining: heroDisplaySecondsRemaining,
    deadlineSecondsRemaining,
    selectBuy,
    setBlockSyncWallMs,
    setBuyErr,
    setBuyListModalOpen,
    setBuyerStats,
    setBuys,
    setBuysNextOffset,
    setBuysTotal,
    setClaims,
    setClaimsNote,
    setDetailBuy,
    setDisplayTick,
    setGasBuy,
    setGasBuyIssue,
    setGasClaim,
    setGasDistribute,
    setGasWarbowFlag,
    setGasWarbowGuard,
    setGasWarbowRevenge,
    setGasWarbowSteal,
    setHasExpandedBuyPages,
    setIndexerNote,
    setLoadingMoreBuys,
    setPayWith,
    setPendingRef,
    setPrizeDist,
    setPrizePayouts,
    setPvpErr,
    setRefApplied,
    setSpendInputStr,
    setSpendWei,
    setStealBypass,
    setStealVictimInput,
    setUseReferral,
    plantWarBowFlag,
    setPlantWarBowFlag,
    setWarbowFeed,
    setWarbowLb,
    setWarbowPreflightIssue,
    sinkReads,
    sinkReadsRaw,
    spendInputStr,
    spendSliderPermille,
    spendWei,
    stealBypass,
    stealPreflight,
    stealVictim,
    stealVictimInput,
    swapQuoteFailed,
    swapQuoteLoading,
    tc,
    timerAddedR,
    timerCapSec,
    timerCapSecR,
    timerExpiredAwaitingEnd,
    timerExtensionPreview,
    timerExtensionSecR,
    timerNarrative,
    tokenAddr,
    tokenDecimals,
    totalCharmWeightR,
    totalRaiseDisplay,
    totalRaised,
    totalTokensForSaleR,
    useReferral,
    userSaleContracts,
    userSaleData,
    userSaleDataRaw,
    utcDayId,
    victimBattlePoints,
    victimBattlePointsBigInt,
    victimStealsToday,
    victimStealsTodayBigInt,
    attackerStealsTodayBigInt,
    viewerBattlePoints,
    walletCl8yBal,
    walletCooldownRemainingSec,
    warbowActionHint,
    warbowBypassBurnR,
    warbowBypassBurnWad,
    warbowContracts,
    warbowFeed,
    warbowFlagClaimBp,
    warbowFlagClaimBpR,
    warbowFlagOwnerR,
    warbowFlagPlantR,
    warbowFlagSilenceR,
    warbowFlagSilenceSec,
    warbowGuardBurnR,
    warbowGuardBurnWad,
    warbowGuardUntilR,
    warbowLadderPodiumR,
    warbowLb,
    warbowLeaderboardRows,
    warbowMaxSteals,
    warbowMaxStealsR,
    warbowMomentumBars,
    warbowPlacementGap,
    warbowPodiumWalletList,
    warbowPolicyData,
    warbowPolicyDataRaw,
    warbowPolicyError,
    warbowPolicyPending,
    warbowPodiumFinalized,
    warbowPreflightIssue,
    warbowRank,
    warbowStealCandidates,
    warbowRevengeBurnR,
    warbowRevengeBurnWad,
    warbowRevengeWindowR,
    warbowStealBurnR,
    warbowStealBurnWad,
    warbowTopRows,
    whatMattersNowCards,
    writeContractAsync,
  };
}

export type TimeCurveArenaModel = ReturnType<typeof useTimeCurveArenaModel>;
