// SPDX-License-Identifier: AGPL-3.0-only

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAddress, maxUint256 } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { sameAddress, walletDisplayFromMap } from "@/lib/addressFormat";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import {
  erc20Abi,
  feeRouterReadAbi,
  linearCharmPriceReadAbi,
  timeCurveReadAbi,
  timeCurveWriteAbi,
} from "@/lib/abis";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { simulateWriteContract } from "@/lib/simulateContractWrite";
import { sampleMinSpendCurve, WAD } from "@/lib/timeCurveMath";
import {
  buildBuyBattlePointBreakdown,
  buildBuyFeedNarrative,
  buildBuyHistoryPoints,
  buildWarbowFeedNarrative,
  describeStealPreflight,
  describeTimerPreview,
} from "@/lib/timeCurveUx";
import { formatCountdown, timerUrgencyClass } from "@/pages/timecurve/formatTimer";
import { PODIUM_HELP, PODIUM_LABELS } from "@/pages/timecurve/podiumCopy";
import {
  BattleFeedSection,
  PodiumsSection,
  RawDataAccordion,
  StandingsVisuals,
  WarbowSection,
  WhatMattersSection,
} from "@/pages/timecurve/TimeCurveSections";
import { RankingList, type RankingRow, StatCard } from "@/pages/timecurve/timecurveUi";
import { usePodiumReads } from "@/pages/timecurve/usePodiumReads";
import {
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  podiumCategorySlices,
  podiumPlacementShares,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { wagmiConfig } from "@/wagmi-config";
import { useDotMegaNameMap } from "@/hooks/useDotMegaNameMap";
import { collectTimecurveWalletAddressesForDotMega } from "@/lib/dotMega";
import {
  fetchTimecurveCharmRedemptions,
  fetchTimecurveBuyerStats,
  fetchTimecurveBuys,
  fetchTimecurvePrizeDistributions,
  fetchTimecurvePrizePayouts,
  fetchReferralApplied,
  fetchTimecurveWarbowBattleFeed,
  fetchTimecurveWarbowLeaderboard,
  type CharmRedemptionItem,
  type BuyItem,
  type PrizeDistributionItem,
  type PrizePayoutItem,
  type ReferralAppliedItem,
  type TimecurveBuyerStats,
  type WarbowBattleFeedItem,
  type WarbowLeaderboardItem,
} from "@/lib/indexerApi";

function walletMono(addr: string | undefined, formatWallet: (a: string | undefined, fb: string) => string) {
  if (!addr) {
    return <span className="mono">—</span>;
  }
  return (
    <span className="mono" title={addr}>
      {formatWallet(addr, "—")}
    </span>
  );
}

function formatPodiumLeaderboardValue(categoryIndex: number, raw: bigint): string {
  if (categoryIndex === 1) {
    return `${formatLocaleInteger(raw)} s`;
  }
  return formatLocaleInteger(raw);
}

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

export function TimeCurvePage() {
  const prefersReducedMotion = useReducedMotion();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const tc = addresses.timeCurve;
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [claims, setClaims] = useState<CharmRedemptionItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [claimsNote, setClaimsNote] = useState<string | null>(null);
  const [charmCount, setCharmCount] = useState(5);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [useReferral, setUseReferral] = useState(true);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [warbowLb, setWarbowLb] = useState<WarbowLeaderboardItem[] | null>(null);
  const [warbowFeed, setWarbowFeed] = useState<WarbowBattleFeedItem[] | null>(null);
  const [stealVictimInput, setStealVictimInput] = useState("");
  const [stealBypass, setStealBypass] = useState(false);
  const [prizePayouts, setPrizePayouts] = useState<PrizePayoutItem[] | null>(null);
  const [prizeDist, setPrizeDist] = useState<PrizeDistributionItem[] | null>(null);
  const [refApplied, setRefApplied] = useState<ReferralAppliedItem[] | null>(null);
  const [buysNextOffset, setBuysNextOffset] = useState<number | null>(null);
  const [loadingMoreBuys, setLoadingMoreBuys] = useState(false);
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

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
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
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveBuys(25, 0);
      if (cancelled) {
        return;
      }
      if (!data) {
        setIndexerNote("Set VITE_INDEXER_URL to load recent buys from the indexer.");
        setBuys([]);
        setBuysNextOffset(null);
        return;
      }
      setBuys(data.items);
      setBuysNextOffset(data.next_offset);
      setIndexerNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [lb, fd] = await Promise.all([
        fetchTimecurveWarbowLeaderboard(12, 0),
        fetchTimecurveWarbowBattleFeed(20, 0),
      ]);
      if (cancelled) {
        return;
      }
      setWarbowLb(lb?.items ?? null);
      setWarbowFeed(fd?.items ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        { address: tc, abi: timeCurveReadAbi, functionName: "feeRouter" },
        { address: tc, abi: timeCurveReadAbi, functionName: "podiumPool" },
        { address: tc, abi: timeCurveReadAbi, functionName: "totalCharmWeight" },
      ]
    : [];
  const {
    data: coreTcDataRaw,
    isPending: coreTcPending,
    isError: coreTcError,
    refetch: refetchCoreTc,
  } = useReadContracts({
    contracts: coreTcContracts as readonly unknown[],
    query: { enabled: Boolean(tc) },
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
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY" },
        { address: tc, abi: timeCurveReadAbi, functionName: "SECONDS_PER_DAY" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_REVENGE_WINDOW_SEC" },
        { address: tc, abi: timeCurveReadAbi, functionName: "WARBOW_REVENGE_BURN_WAD" },
      ]
    : [];
  const {
    data: warbowPolicyDataRaw,
    isPending: warbowPolicyPending,
    isError: warbowPolicyError,
    refetch: refetchWarbowPolicy,
  } = useReadContracts({
    contracts: warbowContracts as readonly unknown[],
    query: { enabled: Boolean(tc) },
  });
  const warbowPolicyData = warbowPolicyDataRaw as readonly ContractReadRow[] | undefined;

  const isPending = coreTcPending || warbowPolicyPending;
  const isError = coreTcError || warbowPolicyError;
  const refetch = useCallback(() => {
    void refetchCoreTc();
    void refetchWarbowPolicy();
  }, [refetchCoreTc, refetchWarbowPolicy]);

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
          { address: tc, abi: timeCurveReadAbi, functionName: "warbowPendingRevengeStealer", args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "warbowPendingRevengeExpiry", args: [address] },
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

  const stealVictim =
    stealVictimInput.trim() && isAddress(stealVictimInput.trim() as `0x${string}`)
      ? (stealVictimInput.trim() as `0x${string}`)
      : undefined;

  const utcDayId = BigInt(Math.floor(now / 86_400));

  const { data: victimStealsToday } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "stealsReceivedOnDay",
    args: stealVictim && tc ? [stealVictim, utcDayId] : undefined,
    query: { enabled: Boolean(tc && stealVictim) },
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
    feeRouterR,
    podiumPoolR,
    totalCharmWeightR,
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
  ] = warbowPolicyData ?? [];

  const [
    charmWeightR,
    buyCountR,
    charmsRedeemedR,
    timerAddedR,
    battlePtsR,
    activeStreakR,
    bestStreakR,
    warbowGuardUntilR,
    revengeStealerR,
    revengeExpiryR,
  ] = userSaleData ?? [];

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
    return { clearing, launch, kLo };
  }, [totalRaised, totalTokensForSaleR]);

  const podiumPayoutPreview = useMemo(() => {
    const bal = typeof podiumPoolBal === "bigint" ? podiumPoolBal : 0n;
    const slices = podiumCategorySlices(bal);
    return slices.map((slice, cat) => {
      const [a, b, c] = podiumPlacementShares(slice);
      return { cat, slice, places: [a, b, c] as const };
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

  const saleActive =
    !isPending &&
    saleStart?.status === "success" &&
    (saleStart.result as bigint) > 0n &&
    ended?.status === "success" &&
    ended.result === false;

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
    BigInt(now) >= flagSilenceEndSec;

  const pendingRevengeStealer =
    revengeStealerR?.status === "success"
      ? (revengeStealerR.result as `0x${string}`)
      : undefined;
  const revengeDeadlineSec =
    revengeExpiryR?.status === "success" ? BigInt(revengeExpiryR.result as bigint) : 0n;
  const hasRevengeOpen =
    Boolean(
      pendingRevengeStealer &&
        pendingRevengeStealer !== "0x0000000000000000000000000000000000000000" &&
        BigInt(now) < revengeDeadlineSec,
    );

  const guardUntilSec =
    warbowGuardUntilR?.status === "success" ? BigInt(warbowGuardUntilR.result as bigint) : 0n;
  const guardedActive = BigInt(now) < guardUntilSec;

  const deadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;
  const remaining =
    deadlineSec !== undefined ? Math.max(0, deadlineSec - now) : undefined;

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
    const elapsed = BigInt(Math.max(0, now - start));
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
  }, [initialMinBuyR, growthRateWadR, saleStart, now, basePriceWadR, dailyIncWadR]);

  const charmWadSelected = useMemo(() => BigInt(charmCount) * WAD, [charmCount]);

  const estimatedSpend = useMemo(() => {
    if (pricePerCharmR?.status !== "success") {
      return undefined;
    }
    const p = pricePerCharmR.result as bigint;
    return (charmWadSelected * p) / WAD;
  }, [charmWadSelected, pricePerCharmR]);

  const timerCapSec =
    timerCapSecR?.status === "success" ? Number(timerCapSecR.result as bigint) : undefined;
  const timerExtensionPreview =
    saleActive &&
    remaining !== undefined &&
    timerExtensionSecR?.status === "success" &&
    timerCapSec !== undefined
      ? Math.max(
          0,
          Math.min(
            Number(timerExtensionSecR.result as bigint),
            Math.max(0, timerCapSec - remaining),
          ),
        )
      : undefined;
  const timerFillPercent =
    remaining !== undefined && timerCapSec
      ? Math.max(0, Math.min(100, (remaining / Math.max(timerCapSec, 1)) * 100))
      : undefined;
  const timerPreviewPercent =
    timerExtensionPreview !== undefined && timerCapSec
      ? Math.max(0, Math.min(100, (timerExtensionPreview / Math.max(timerCapSec, 1)) * 100))
      : undefined;
  const saleEnded = ended?.status === "success" && ended.result === true;
  const saleStartPending =
    saleStart?.status === "success" && BigInt(now) < (saleStart.result as bigint);
  const stateBadgeLabel = saleActive
    ? "Sale live"
    : saleEnded
      ? "After sale"
      : saleStartPending
        ? "Starts soon"
        : "Waiting on chain";
  const stateBadgeTone = saleActive
    ? "live"
    : saleEnded
      ? "warning"
      : saleStartPending
        ? "info"
        : "warning";

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
    ],
  );

  const dotMegaNameByAddress = useDotMegaNameMap(dotMegaAddressList);
  const formatWallet = useMemo(() => walletDisplayFromMap(dotMegaNameByAddress), [dotMegaNameByAddress]);

  const warbowRank =
    address && warbowLb
      ? warbowLb.findIndex((row) => sameAddress(row.buyer, address)) + 1 || null
      : null;
  const warbowTopRows: RankingRow[] =
    warbowLadderPodiumR?.status === "success"
      ? (() => {
          const [wallets, values] = warbowLadderPodiumR.result as readonly [
            readonly `0x${string}`[],
            readonly bigint[],
          ];
          return [0, 1, 2].map((index) => ({
            key: `warbow-contract-${index}`,
            rank: index + 1,
            label: walletMono(wallets[index], formatWallet),
            meta: sameAddress(wallets[index], address) ? "Connected wallet" : "Contract snapshot",
            value: `${values[index] !== undefined ? formatLocaleInteger(values[index]) : "—"} BP`,
            highlight: sameAddress(wallets[index], address),
          }));
        })()
      : [];
  const warbowLeaderboardRows: RankingRow[] = (warbowLb ?? []).slice(0, 6).map((row, index) => ({
    key: `warbow-indexer-${row.buyer}`,
    rank: index + 1,
    label: walletMono(row.buyer, formatWallet),
    meta: sameAddress(row.buyer, address)
      ? "Connected wallet"
      : `block ${formatLocaleInteger(row.block_number)}`,
    value: `${formatLocaleInteger(BigInt(row.battle_points_after))} BP`,
    highlight: sameAddress(row.buyer, address),
  }));

  const refetchAll = useCallback(() => {
    void refetch();
    void refetchUserSale();
    if (address && indexerBaseUrl()) {
      void fetchTimecurveBuyerStats(address).then(setBuyerStats);
    }
  }, [refetch, refetchUserSale, address]);

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
    return "May return without changing state if the podium pool balance is too small; retry after fees accrue.";
  }, [ended, prizesDistributedR]);

  const timerNarrative = useMemo(
    () => describeTimerPreview(remaining, timerExtensionPreview),
    [remaining, timerExtensionPreview],
  );

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
              <AmountDisplay raw={expectedTokenFromCharms} decimals={18} />
            ) : (
              "—"
            ),
          meta: "Projected launched-token redemption from your current charm weight.",
        },
        {
          label: "Podium pool",
          value:
            podiumPoolBal !== undefined ? <AmountDisplay raw={podiumPoolBal as bigint} decimals={decimals} /> : "—",
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
              : remaining !== undefined && remaining < 780
                ? "Clutch reset window"
                : "Make the next move",
        meta:
          canClaimWarBowFlag
            ? "Silence has held long enough. Claiming now locks in a visible WarBow moment."
            : hasRevengeOpen
              ? "You have a live revenge window. Hit back before it expires."
              : remaining !== undefined && remaining < 780
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
        value: remaining !== undefined && remaining < 780 ? "Every buy is a swing" : "Lurkers can still enjoy the race",
        meta:
          remaining !== undefined && remaining < 780
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
    remaining,
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
    if (remaining !== undefined && remaining < 780) {
      items.push("You are inside the hard-reset band, so this buy can drag the timer back toward 15 minutes.");
    }
    if (referralRegistryOn && pendingRef && useReferral) {
      items.push(`Referral ${normalizeReferralCode(pendingRef)} gives both sides a 10% CHARM bonus if the buy lands.`);
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
    remaining,
    referralRegistryOn,
    pendingRef,
    useReferral,
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
    if (gasBuyIssue) {
      return gasBuyIssue;
    }
    if (charmBoundsR?.status === "success") {
      const [minC, maxC] = charmBoundsR.result as readonly [bigint, bigint];
      if (charmWadSelected < minC || charmWadSelected > maxC) {
        return "This selection drifted outside the live onchain CHARM band. Refresh or choose another size.";
      }
    }
    return "Pre-sign preview looks healthy. Wallet confirmation is still the final source of truth.";
  }, [isConnected, saleEnded, saleActive, gasBuyIssue, charmBoundsR, charmWadSelected]);

  const viewerBattlePoints =
    battlePtsR?.status === "success" ? (battlePtsR.result as bigint) : undefined;
  const victimStealsTodayBigInt =
    victimStealsToday !== undefined ? BigInt(victimStealsToday as bigint | number) : undefined;
  const victimBattlePointsBigInt =
    victimBattlePoints !== undefined ? BigInt(victimBattlePoints as bigint | number) : undefined;
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
      : "Target rivals with at least 2x your BP, or use guard to make yourself harder to drain.";
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
    const cards: {
      key: string;
      label: string;
      help: string;
      leader: ReactNode;
      value: string;
      highlight: boolean;
    }[] = rows.map((row, index) => ({
      key: `podium-spotlight-${index}`,
      label: PODIUM_LABELS[index] ?? `Category ${index + 1}`,
      help: PODIUM_HELP[index] ?? "Current onchain race.",
      leader: (
        <span className="mono" title={row.winners[0]}>
          {formatWallet(row.winners[0], "—")}
        </span>
      ),
      value: formatPodiumLeaderboardValue(index, row.values[0] ?? 0n),
      highlight: sameAddress(row.winners[0], address),
    }));
    const warbowLeader = warbowTopRows[0];
    const warbowLeaderDisplay: ReactNode =
      warbowLeader !== undefined && typeof warbowLeader.label !== "string"
        ? warbowLeader.label
        : (
            <span className="mono" title={warbowLb?.[0]?.buyer}>
              {formatWallet(warbowLb?.[0]?.buyer, "—")}
            </span>
          );
    cards.push({
      key: "warbow-spotlight",
      label: "WarBow Ladder",
      help: "Battle Points PvP status surface, separate from reserve prizes.",
      leader: warbowLeaderDisplay,
      value: typeof warbowLeader?.value === "string" ? warbowLeader.value : "—",
      highlight: warbowLeader?.highlight ?? false,
    });
    return cards;
  }, [podiumReads.data, warbowTopRows, warbowLb, address, formatWallet]);

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
    const cw = BigInt(charmCount) * WAD;
    if (cw <= 0n) {
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
        const args = codeHash ? [cw, codeHash] : [cw];
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
    charmCount,
    useReferral,
    referralRegistryOn,
    pendingRef,
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
    if (!address || !tc || ended?.status !== "success" || !ended.result) {
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
  }, [address, tc, ended, chainId]);

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
    setBuys((prev) => (prev ? [...prev, ...data.items] : data.items));
    setBuysNextOffset(data.next_offset);
  }

  const handleBuy = useCallback(async () => {
    setBuyErr(null);
    if (!address || !tc || !tokenAddr) {
      setBuyErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    const cw = BigInt(charmCount) * WAD;
    if (charmBoundsR?.status !== "success") {
      setBuyErr("Waiting for onchain CHARM bounds.");
      return;
    }
    const [minC, maxC] = charmBoundsR.result as readonly [bigint, bigint];
    if (cw < minC || cw > maxC) {
      setBuyErr(
        "Selected charm count is outside the onchain band for this moment (envelope moved). Refresh reads or pick another size.",
      );
      return;
    }
    const amount = estimatedSpend;
    if (amount === undefined || amount <= 0n) {
      setBuyErr("Could not compute spend from onchain price; wait for contract reads.");
      return;
    }

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
      const allow = await readContract(wagmiConfig, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, tc],
      });
      if (allow < totalPull) {
        const approveHash = await writeContractAsync({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [tc, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      const buyArgs = codeHash ? [cw, codeHash] : [cw];
      const buyHash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "buy",
        args: buyArgs as [bigint] | [bigint, `0x${string}`],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      if (codeHash) {
        clearPendingReferralCode();
        setPendingRef(null);
      }
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }, [
    address,
    tc,
    tokenAddr,
    charmCount,
    charmBoundsR,
    estimatedSpend,
    useReferral,
    referralRegistryOn,
    pendingRef,
    writeContractAsync,
    refetchAll,
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
      const approveHash = await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [tc, maxUint256],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
    }
  }

  async function runWarBowClaimFlag() {
    setBuyErr(null);
    if (!tc || !address) {
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "claimWarBowFlag",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowSteal() {
    setBuyErr(null);
    if (!tc || !address || !stealVictim) {
      setBuyErr("Enter a valid victim address.");
      return;
    }
    const need = warbowStealBurnWad + (stealBypass ? warbowBypassBurnWad : 0n);
    try {
      await ensureTcAllowance(need);
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowSteal",
        args: [stealVictim, stealBypass],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowGuard() {
    setBuyErr(null);
    if (!tc || !address) {
      return;
    }
    try {
      await ensureTcAllowance(warbowGuardBurnWad);
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowActivateGuard",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runWarBowRevenge() {
    setBuyErr(null);
    if (!tc || !address || !pendingRevengeStealer) {
      return;
    }
    try {
      await ensureTcAllowance(warbowRevengeBurnWad);
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: "warbowRevenge",
        args: [pendingRevengeStealer],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  async function runVoid(fn: "endSale" | "redeemCharms" | "distributePrizes") {
    setBuyErr(null);
    if (!tc) {
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: fn,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  if (!tc) {
    return (
      <section className="page page--timecurve">
        <PageHero
          title="TimeCurve"
          badgeLabel="Config needed"
          badgeTone="warning"
          lede={
            <>
              Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see <code>.env.example</code>) to
              read live onchain sale state.
            </>
          }
          mascot={{
            src: "/art/cutouts/loading-mascot-circle.png",
            width: 192,
            height: 192,
            className: "cutout-decoration--sway",
          }}
        />
      </section>
    );
  }

  return (
    <section className="page page--timecurve">
      <PageHero
        title="TimeCurve"
        badgeLabel={stateBadgeLabel}
        badgeTone={stateBadgeTone}
        lede={
          <>
            Buy for more than price exposure: each move can extend the clock, steal the spotlight, climb a prize podium,
            or set up a <strong>WarBow Ladder</strong> rivalry. After the timer expires, the page pivots to redemption
            and prize settlement.
          </>
        }
        mascot={{
          src: "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png",
          width: 220,
          height: 220,
          className: "cutout-decoration--float",
        }}
      >
        <div className="status-strip" aria-label="Current TimeCurve status">
          <PageBadge
            label={saleActive ? "Buy + defend + steal" : saleEnded ? "Redeem + settle" : "Waiting for start"}
            tone={saleActive ? "live" : saleEnded ? "warning" : "info"}
          />
          {guardedActive && <PageBadge label="Guard active" tone="info" />}
          {hasRevengeOpen && <PageBadge label="Revenge open" tone="warning" />}
          {canClaimWarBowFlag && <PageBadge label="Flag claim ready" tone="warning" />}
        </div>
      </PageHero>

      <div className={`timer-hero ${timerUrgencyClass(remaining)}`}>
        <div className="status-strip">
          <span className={`status-pill status-pill--${saleActive ? "success" : saleEnded ? "warning" : "info"}`}>
            {saleActive ? "Live round" : saleEnded ? "Timer expired" : "Pre-start"}
          </span>
          {saleActive && (
            <span
              className={`status-pill status-pill--${
                timerNarrative.tone === "critical" ? "danger" : timerNarrative.tone === "warning" ? "warning" : "success"
              }`}
            >
              {timerNarrative.label}
            </span>
          )}
          {guardedActive && (
            <span className="status-pill status-pill--info">
              Guard until <UnixTimestampDisplay raw={guardUntilSec} />
            </span>
          )}
          {hasRevengeOpen && (
            <span className="status-pill status-pill--warning">
              Revenge window until <UnixTimestampDisplay raw={revengeDeadlineSec} />
            </span>
          )}
          {canClaimWarBowFlag && <span className="status-pill status-pill--warning">Claim your WarBow flag now</span>}
        </div>
        <div className="timer-hero__label">
          {saleActive ? "Time Remaining" : saleEnded ? "Sale Ended" : "Starts In"}
        </div>
        <div className="timer-hero__countdown">
          {remaining !== undefined ? formatCountdown(remaining) : "—"}
        </div>
        {remaining !== undefined && remaining > 0 && (
          <div className="timer-hero__subtext">
            {formatLocaleInteger(remaining)}s left · deadline{" "}
            {deadlineSec ? new Date(deadlineSec * 1000).toLocaleString() : "—"}
          </div>
        )}
        {saleActive && <div className="timer-hero__narrative">{timerNarrative.detail}</div>}
      </div>
      {saleActive &&
        timerFillPercent !== undefined &&
        timerPreviewPercent !== undefined &&
        timerExtensionPreview !== undefined && (
          <div className="progress-meter" aria-label="Timer pressure preview">
            <div className="progress-meter__track">
              <div className="progress-meter__current" style={{ width: `${timerFillPercent}%` }} />
              <div
                className="progress-meter__preview"
                style={{
                  left: `${timerFillPercent}%`,
                  width: `${Math.max(0, Math.min(timerPreviewPercent, 100 - timerFillPercent))}%`,
                }}
              />
            </div>
            <div className="progress-meter__labels">
              <span>Current timer fill</span>
              <span>
                {remaining !== undefined && remaining < 780
                  ? "Next buy can hard-reset the clock toward 15 minutes"
                  : `Next buy can add up to +${formatLocaleInteger(timerExtensionPreview)}s`}
              </span>
            </div>
          </div>
        )}

      <div className="split-layout split-layout--hero">
        <PageSection
          title="Buy charms"
          badgeLabel={saleActive ? "Primary action" : "Buy window"}
          badgeTone={saleActive ? "live" : "warning"}
          spotlight
          cutout={{
            src: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
            width: 196,
            height: 196,
            className: "panel-cutout panel-cutout--mid-right cutout-decoration--sway",
          }}
          lede="Preview the emotional payoff before you sign: spend, charm weight, timer pressure, and how the move can affect the live race."
        >
          {!isConnected && <StatusMessage variant="placeholder">Connect a wallet to preview and buy charms.</StatusMessage>}
          {isConnected && isPending && <StatusMessage variant="loading">Loading contract...</StatusMessage>}
          {isConnected && !saleActive && !isPending && (
            <StatusMessage variant="placeholder">
              {saleEnded
                ? "The round is over. Buying is closed, so the surface pivots to redemption and prize settlement."
                : "The sale has not started yet. When it opens, this panel becomes the primary action surface."}
            </StatusMessage>
          )}
          {isConnected && saleActive && (
            <>
              <ul className="accent-list timecurve-action-highlights">
                {buyPanelHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="stats-grid">
                <StatCard
                  label="Projected spend"
                  value={
                    estimatedSpend !== undefined ? (
                      <AmountDisplay raw={estimatedSpend} decimals={decimals} />
                    ) : (
                      "—"
                    )
                  }
                  meta="Gross reserve spend for the selected charm count"
                />
                <StatCard
                  label="Charm weight"
                  value={`${charmCount} charm${charmCount === 1 ? "" : "s"}`}
                  meta={
                    referralRegistryOn && pendingRef && useReferral
                      ? `Referral active: ${normalizeReferralCode(pendingRef)}`
                      : "Whole charms only in this UI"
                  }
                />
                <StatCard
                  label="Timer swing"
                  value={
                    timerExtensionPreview !== undefined ? `+${formatLocaleInteger(timerExtensionPreview)} s` : "—"
                  }
                  meta={
                    remaining !== undefined && remaining < 780
                      ? "You are in the hard-reset band, so this buy can yank the clock back toward 15 minutes."
                      : timerCapSec !== undefined
                        ? `Countdown cap ${formatLocaleInteger(timerCapSec)} s`
                        : "Adds time until the cap is reached"
                  }
                />
                <StatCard
                  label="Battle swing"
                  value={warbowRank ? `Rank #${warbowRank}` : "Build BP"}
                  meta="Qualifying buys feed WarBow status. Clutch timing, resets, and streak breaks can stack more."
                />
                <StatCard
                  label="What this can chase"
                  value={remaining !== undefined && remaining < 780 ? "Reset + defend + steal" : "Timer + podium + ladder"}
                  meta="Every buy affects more than ROI: last-buy pressure, time-booster race, streak defense, and WarBow status."
                />
              </div>
              {latestBuyBpBreakdown.length > 0 && (
                <div className="history-card">
                  <h3>Latest indexed BP bonus stack</h3>
                  <div className="bp-breakdown-list" aria-label="Latest indexed Battle Points breakdown">
                    {latestBuyBpBreakdown.map((row) => (
                      <div key={row.key} className="bp-breakdown-list__item">
                        <span>{row.label}</span>
                        <strong>{row.value > 0n ? `+${formatLocaleInteger(row.value)} BP` : formatLocaleInteger(row.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label className="form-label">
                Charms (1-10 whole units)
                <input
                  type="range"
                  className="form-input"
                  min={1}
                  max={10}
                  step={1}
                  value={charmCount}
                  onChange={(e) => setCharmCount(Number(e.target.value))}
                />
                <span className="muted">
                  {charmCount} charm{charmCount === 1 ? "" : "s"} selected
                </span>
              </label>
              {referralRegistryOn && pendingRef && (
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={useReferral}
                    onChange={(e) => setUseReferral(e.target.checked)}
                  />{" "}
                  Apply referral <code>{normalizeReferralCode(pendingRef)}</code> from the current <code>?ref=</code>{" "}
                  link
                </label>
              )}
              {referralRegistryOn && !pendingRef && (
                <StatusMessage variant="muted">
                  Open a referral link with <code>?ref=CODE</code> to enable the 10% each-side CHARM bonus.
                </StatusMessage>
              )}
              <p>
                <motion.button
                  type="button"
                  className="btn-primary btn-primary--priority"
                  disabled={isWriting}
                  onClick={handleBuy}
                  {...primaryButtonMotion}
                >
                  {isWriting ? "Confirm in wallet..." : "Approve (if needed) and buy"}
                </motion.button>
              </p>
              {gasBuy !== undefined && (
                <StatusMessage variant="muted">
                  Estimated gas for buy: ~{formatLocaleInteger(gasBuy)} units
                </StatusMessage>
              )}
              <StatusMessage variant={gasBuyIssue ? "error" : "muted"}>{buyPanelRisk}</StatusMessage>
            </>
          )}
          {buyErr && <StatusMessage variant="error">{buyErr}</StatusMessage>}
        </PageSection>

        <PageSection
          title={saleEnded ? "After sale actions" : "Prize chase and standings"}
          badgeLabel={saleEnded ? "Redeem and settle" : "Status surface"}
          badgeTone={saleEnded ? "warning" : "live"}
          spotlight
          cutout={{
            src: "/art/cutouts/mascot-leprechaun-with-bag-cutout.png",
            width: 228,
            height: 228,
            className: "panel-cutout panel-cutout--lower-right cutout-decoration--float",
          }}
          lede={
            saleEnded
              ? "When the timer expires, finalize the sale, redeem charms for launched tokens, and distribute the reserve podium pool."
              : "TimeCurve stays readable by putting the current competitive stakes next to the primary action surface."
          }
        >
          {saleEnded ? (
            <>
              <div className="timecurve-action-row">
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--critical"
                  disabled={isWriting}
                  onClick={() => runVoid("endSale")}
                  {...secondaryButtonMotion}
                >
                  End sale
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting}
                  onClick={() => runVoid("redeemCharms")}
                  {...secondaryButtonMotion}
                >
                  Redeem charms
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting}
                  onClick={() => runVoid("distributePrizes")}
                  {...secondaryButtonMotion}
                >
                  Distribute prizes
                </motion.button>
              </div>
              {(gasClaim !== undefined || gasDistribute !== undefined) && (
                <StatusMessage variant="muted">
                  {gasClaim !== undefined && <>Estimated gas for redeem: ~{formatLocaleInteger(gasClaim)} units</>}
                  {gasClaim !== undefined && gasDistribute !== undefined && <> · </>}
                  {gasDistribute !== undefined && (
                    <>Estimated gas for prize distribution: ~{formatLocaleInteger(gasDistribute)} units</>
                  )}
                </StatusMessage>
              )}
            </>
          ) : (
            <>
              <div className="status-strip">
                <span className={`status-pill status-pill--${timerNarrative.tone === "critical" ? "danger" : timerNarrative.tone === "warning" ? "warning" : "success"}`}>
                  {timerNarrative.label}
                </span>
                {warbowPlacementGap !== null && (
                  <span className="status-pill status-pill--info">
                    {formatLocaleInteger(warbowPlacementGap)} BP to visible placement
                  </span>
                )}
                {guardedActive && <span className="status-pill status-pill--info">Your guard is live</span>}
              </div>
              <div className="stats-grid">
                <StatCard
                  label="WarBow leader"
                  value={warbowTopRows[0]?.value ?? "—"}
                  meta={warbowTopRows[0]?.label ?? "Waiting for contract snapshot"}
                />
                <StatCard
                  label="Your WarBow rank"
                  value={warbowRank ? `#${warbowRank}` : "Unranked"}
                  meta={warbowRank ? "From latest indexed leaderboard" : "Make a move to enter the race"}
                />
                <StatCard
                  label="Podium pool"
                  value={
                    podiumPoolBal !== undefined ? (
                      <AmountDisplay raw={podiumPoolBal as bigint} decimals={decimals} />
                    ) : (
                      "—"
                    )
                  }
                  meta="Reserve payout pool shared by the three fixed podium categories"
                />
                <StatCard
                  label="Your best defended streak"
                  value={
                    bestStreakR?.status === "success"
                      ? formatLocaleInteger(bestStreakR.result as bigint)
                      : "—"
                  }
                  meta="Peak under-15-minute defended streak"
                />
              </div>
              {warbowMomentumBars.length > 0 && (
                <div className="momentum-strip" aria-label="WarBow momentum strip">
                  {warbowMomentumBars.map((bar, index) => (
                    <div
                      key={bar.key}
                      className={[
                        "momentum-strip__item",
                        index === 0 ? "momentum-strip__item--first" : "",
                        bar.highlight ? "momentum-strip__item--you" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="momentum-strip__meta">
                        <span className="mono" title={bar.wallet}>
                          {bar.label}
                        </span>
                        <strong>{formatLocaleInteger(bar.value)} BP</strong>
                      </div>
                      <div className="momentum-strip__track">
                        <div className="momentum-strip__fill" style={{ width: `${Math.max(bar.width, 8)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <StandingsVisuals buyHistoryPoints={buyHistoryPoints} decimals={decimals} />
              <div className="spotlight-grid">
                {podiumSpotlights.map((card) => (
                  <article
                    key={card.key}
                    className={[
                      "spotlight-card",
                      card.highlight ? "spotlight-card--you" : "",
                      card.label === "WarBow Ladder" ? "spotlight-card--warbow" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="spotlight-card__eyebrow">{card.label}</div>
                    <div className="spotlight-card__value">{card.leader}</div>
                    <div className="spotlight-card__meta">
                      {card.value} · {card.help}
                    </div>
                  </article>
                ))}
              </div>
              <RankingList rows={warbowTopRows} emptyText="Waiting for WarBow contract snapshot." />
            </>
          )}
        </PageSection>
      </div>

      <WhatMattersSection
        saleActive={saleActive}
        saleEnded={saleEnded}
        whatMattersNowCards={whatMattersNowCards}
        minBuy={minBuy}
        decimals={decimals}
        expectedTokenFromCharms={expectedTokenFromCharms}
        charmWeightResult={charmWeightR}
        podiumPoolBal={podiumPoolBal as bigint | undefined}
        battlePointsResult={battlePtsR}
        totalRaisedResult={totalRaised}
        isPending={isPending}
        isError={isError}
        indexerMismatch={indexerMismatch}
        claimHint={claimHint ?? null}
        distributeHint={distributeHint}
      />

      <WarbowSection
        saleActive={saleActive}
        warbowMaxSteals={warbowMaxSteals}
        warbowBypassBurnWad={warbowBypassBurnWad}
        warbowGuardBurnWad={warbowGuardBurnWad}
        warbowActionHint={warbowActionHint}
        warbowFlagSilenceSec={warbowFlagSilenceSec}
        warbowFlagClaimBp={warbowFlagClaimBp}
        isConnected={isConnected}
        stealVictimInput={stealVictimInput}
        setStealVictimInput={setStealVictimInput}
        stealVictim={stealVictim}
        victimStealsTodayBigInt={victimStealsTodayBigInt}
        warbowTopRows={warbowTopRows}
        warbowLeaderboardRows={warbowLeaderboardRows}
        warbowFeed={warbowFeed}
        address={address}
        buildWarbowNarrative={buildWarbowNarrativeForFeed}
        stealBypass={stealBypass}
        setStealBypass={setStealBypass}
        runWarBowSteal={runWarBowSteal}
        runWarBowGuard={runWarBowGuard}
        runWarBowClaimFlag={runWarBowClaimFlag}
        runWarBowRevenge={runWarBowRevenge}
        isWriting={isWriting}
        canClaimWarBowFlag={canClaimWarBowFlag}
        iHoldPlantFlag={iHoldPlantFlag}
        flagSilenceEndSec={flagSilenceEndSec}
        hasRevengeOpen={hasRevengeOpen}
        secondaryButtonMotion={secondaryButtonMotion as Record<string, unknown>}
        stealPreflight={stealPreflight}
        warbowPreflightIssue={warbowPreflightIssue}
        viewerBattlePoints={viewerBattlePoints}
        victimBattlePointsBigInt={victimBattlePointsBigInt}
        gasWarbowSteal={gasWarbowSteal}
        gasWarbowGuard={gasWarbowGuard}
        gasWarbowFlag={gasWarbowFlag}
        gasWarbowRevenge={gasWarbowRevenge}
      />

      <PodiumsSection
        podiumPayoutPreview={podiumPayoutPreview}
        decimals={decimals}
        podiumLoading={podiumReads.isLoading}
        podiumRows={podiumReads.data ?? []}
        address={address}
        formatPodiumLeaderboardValue={formatPodiumLeaderboardValue}
        formatWallet={formatWallet}
      />

      <BattleFeedSection
        indexerNote={indexerNote}
        buys={buys}
        address={address}
        decimals={decimals}
        buysNextOffset={buysNextOffset}
        loadingMoreBuys={loadingMoreBuys}
        handleLoadMoreBuys={handleLoadMoreBuys}
        buildBuyNarrative={buildBuyNarrativeForFeed}
        buildBuyBattlePointBreakdown={buildBuyBattlePointBreakdown}
        formatWallet={formatWallet}
        claimsNote={claimsNote}
        claims={claims}
        prizeDist={prizeDist}
        prizePayouts={prizePayouts}
        refApplied={refApplied}
      />

      <RawDataAccordion
        coreTcData={coreTcData}
        saleStart={saleStart}
        deadline={deadline}
        remaining={remaining}
        totalRaised={totalRaised}
        ended={ended}
        maxBuyAmount={maxBuyAmount}
        prizesDistributedResult={prizesDistributedR}
        isConnected={isConnected}
        charmWeightResult={charmWeightR}
        buyCountResult={buyCountR}
        timerAddedResult={timerAddedR}
        battlePointsResult={battlePtsR}
        activeStreakResult={activeStreakR}
        bestStreakResult={bestStreakR}
        pendingRevengeStealer={pendingRevengeStealer}
        revengeDeadlineSec={revengeDeadlineSec}
        buyerStats={indexerBaseUrl() ? buyerStats : null}
        initialMinBuyResult={initialMinBuyR}
        growthRateWadResult={growthRateWadR}
        timerExtensionSecResult={timerExtensionSecR}
        initialTimerSecResult={initialTimerSecR}
        timerCapSecResult={timerCapSecR}
        totalTokensForSaleResult={totalTokensForSaleR}
        sinkReads={sinkReads}
        liquidityAnchors={liquidityAnchors}
        minSpendCurvePoints={minSpendCurvePoints}
        decimals={decimals}
        launchedDec={launchedDec}
        formatWallet={formatWallet}
      />
    </section>
  );
}
