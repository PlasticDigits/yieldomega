// SPDX-License-Identifier: AGPL-3.0-only

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
import { CharmRedemptionCurve } from "@/components/CharmRedemptionCurve";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import {
  formatBpsAsPercent,
  formatLocaleInteger,
  formatUnixSecIsoUtc,
} from "@/lib/formatAmount";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import { TxHash } from "@/components/TxHash";
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
import { sampleMinSpendCurve, WAD } from "@/lib/timeCurveMath";
import {
  RESERVE_FEE_ROUTING_BPS,
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  podiumCategorySlices,
  podiumPlacementShares,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { wagmiConfig } from "@/wagmi-config";
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

const PODIUM_LABELS = [
  "Last buy (50% of podium pool)",
  "Time booster (25%)",
  "Defended streak (25%)",
] as const;

const PODIUM_HELP = [
  "Compete to be the last person to buy.",
  "Most actual time added to the timer (effective seconds per buy, after cap).",
  "Peak count of under-15-minute timer resets by the same wallet; interrupted when another wallet buys under the window.",
] as const;

function formatCountdown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerUrgencyClass(sec: number | undefined): string {
  if (sec === undefined) return "";
  if (sec <= 300) return "timer-hero--critical";
  if (sec <= 3600) return "timer-hero--warning";
  return "";
}

function formatPodiumLeaderboardValue(categoryIndex: number, raw: bigint): string {
  if (categoryIndex === 1) {
    return `${formatLocaleInteger(raw)} s`;
  }
  return formatLocaleInteger(raw);
}

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function shortAddress(value: string | undefined): string {
  if (!value) {
    return "—";
  }
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {meta && <div className="stat-card__meta">{meta}</div>}
    </div>
  );
}

type RankingRow = {
  key: string;
  rank: number;
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  highlight?: boolean;
};

function RankingList({ rows, emptyText }: { rows: RankingRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <StatusMessage variant="muted">{emptyText}</StatusMessage>;
  }

  return (
    <ol className="ranking-list">
      {rows.map((row) => {
        const classes = [
          "ranking-list__item",
          row.rank === 1 ? "ranking-list__item--first" : "",
          row.rank === 2 ? "ranking-list__item--second" : "",
          row.rank === 3 ? "ranking-list__item--third" : "",
          row.highlight ? "ranking-list__item--you" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={row.key} className={classes}>
            <span className="ranking-list__rank">{row.rank}</span>
            <div>
              <div>{row.label}</div>
              {row.meta && <div className="ranking-list__meta">{row.meta}</div>}
            </div>
            <strong>{row.value}</strong>
          </li>
        );
      })}
    </ol>
  );
}

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

function FeedCard({
  title,
  meta,
  tags = [],
}: {
  title: ReactNode;
  meta?: ReactNode;
  tags?: string[];
}) {
  return (
    <li className="feed-card">
      <div className="feed-card__title">{title}</div>
      {meta && <div className="feed-card__meta">{meta}</div>}
      {tags.length > 0 && (
        <div className="feed-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="feed-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

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
  const [gasClaim, setGasClaim] = useState<bigint | undefined>(undefined);
  const [gasDistribute, setGasDistribute] = useState<bigint | undefined>(undefined);

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
            label: <span className="mono">{shortAddress(wallets[index])}</span>,
            meta: sameAddress(wallets[index], address) ? "Connected wallet" : "Contract snapshot",
            value: `${values[index] !== undefined ? formatLocaleInteger(values[index]) : "—"} BP`,
            highlight: sameAddress(wallets[index], address),
          }));
        })()
      : [];
  const warbowLeaderboardRows: RankingRow[] = (warbowLb ?? []).slice(0, 6).map((row, index) => ({
    key: `warbow-indexer-${row.buyer}`,
    rank: index + 1,
    label: <span className="mono">{shortAddress(row.buyer)}</span>,
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

  useEffect(() => {
    if (!address || !tc || !saleActive) {
      setGasBuy(undefined);
      return;
    }
    const cw = BigInt(charmCount) * WAD;
    if (cw <= 0n) {
      setGasBuy(undefined);
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
            Charms give you weight in the sale. During the live round, buys add timer pressure, move podium races,
            and feed <strong>WarBow Ladder</strong> PvP. After the timer expires, the page pivots to redemption and
            prize settlement.
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
            {formatLocaleInteger(remaining)}s · deadline{" "}
            {deadlineSec ? new Date(deadlineSec * 1000).toLocaleString() : "—"}
          </div>
        )}
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
              <span>Next buy can add up to +{formatLocaleInteger(timerExtensionPreview)}s</span>
            </div>
          </div>
        )}

      <PageSection
        title="What matters now"
        badgeLabel={saleActive ? "Player view" : saleEnded ? "Settlement view" : "Live setup"}
        badgeTone={saleActive ? "live" : saleEnded ? "warning" : "info"}
        lede="The page now adapts to sale state so live pressure, after-sale settlement, and PvP alerts surface before protocol detail."
      >
        <div className="stats-grid">
          <StatCard
            label={saleActive ? "Current min buy" : "Minimum buy"}
            value={
              minBuy?.status === "success" ? (
                <AmountDisplay raw={minBuy.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )
            }
            meta="Human-readable reserve spend floor"
          />
          <StatCard
            label={saleEnded ? "Expected redemption" : "Your charm weight"}
            value={
              saleEnded ? (
                expectedTokenFromCharms !== undefined ? (
                  <AmountDisplay raw={expectedTokenFromCharms} decimals={18} />
                ) : (
                  "—"
                )
              ) : charmWeightR?.status === "success" ? (
                <AmountDisplay raw={charmWeightR.result as bigint} decimals={18} />
              ) : (
                "—"
              )
            }
            meta={saleEnded ? "Projected launched-token claim" : "Onchain charm weight for your wallet"}
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
            meta="Reserve pool for the three fixed podium categories"
          />
          <StatCard
            label={saleActive ? "Battle Points" : "Total raised"}
            value={
              saleActive ? (
                battlePtsR?.status === "success" ? (
                  formatLocaleInteger(battlePtsR.result as bigint)
                ) : (
                  "—"
                )
              ) : totalRaised?.status === "success" ? (
                <AmountDisplay raw={totalRaised.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )
            }
            meta={saleActive ? "Your live WarBow PvP score" : "Authoritative sale total from contract reads"}
          />
        </div>
        {isPending && <StatusMessage variant="loading">Loading contract reads...</StatusMessage>}
        {isError && <StatusMessage variant="error">Could not read contract (check RPC / network).</StatusMessage>}
        {indexerMismatch && <StatusMessage variant="error">{indexerMismatch}</StatusMessage>}
        {claimHint && <StatusMessage variant="muted">{claimHint}</StatusMessage>}
        {saleEnded && distributeHint && <StatusMessage variant="muted">{distributeHint}</StatusMessage>}
      </PageSection>

      <div className="split-layout">
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
                  label="Timer impact now"
                  value={
                    timerExtensionPreview !== undefined ? `+${formatLocaleInteger(timerExtensionPreview)} s` : "—"
                  }
                  meta={
                    timerCapSec !== undefined
                      ? `Countdown cap ${formatLocaleInteger(timerCapSec)} s`
                      : "Adds time until the cap is reached"
                  }
                />
                <StatCard
                  label="PvP pressure"
                  value={warbowRank ? `Rank #${warbowRank}` : "WarBow live"}
                  meta="Buys can earn BP, plant a flag, and pressure last-buy or time-booster races"
                />
              </div>
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
            </>
          )}
          {buyErr && <StatusMessage variant="error">{buyErr}</StatusMessage>}
        </PageSection>

        <PageSection
          title={saleEnded ? "After sale actions" : "Competition snapshot"}
          badgeLabel={saleEnded ? "Redeem and settle" : "What you are fighting for"}
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
              <div className="stats-grid">
                <StatCard
                  label="Contract top rank"
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
              <RankingList rows={warbowTopRows} emptyText="Waiting for WarBow contract snapshot." />
            </>
          )}
        </PageSection>
      </div>

      <PageSection
        title="WarBow Ladder (PvP)"
        badgeLabel={saleActive ? "Live PvP" : "PvP rules"}
        badgeTone={saleActive ? "live" : "info"}
        spotlight
        lede="WarBow is adversarial: steals require a 2x BP gap, guard cuts incoming steals to 1%, revenge is single-use within the onchain window, and flag claims only resolve after silence."
      >
        <div className="status-strip">
          <span className="status-pill status-pill--info">
            Steal cap: {formatLocaleInteger(warbowMaxSteals)} per victim per UTC day
          </span>
          <span className="status-pill status-pill--warning">
            Bypass burn <AmountDisplay raw={warbowBypassBurnWad} decimals={decimals} />
          </span>
          <span className="status-pill status-pill--info">
            Guard burn <AmountDisplay raw={warbowGuardBurnWad} decimals={decimals} />
          </span>
        </div>
        <details className="podium-block accordion-panel">
          <summary>
            <strong>Rules and eligibility</strong>
          </summary>
          <div className="accordion-panel__content">
            <StatusMessage variant="muted">
              Steals require the victim to have at least 2x your Battle Points. Each victim can be stolen from{" "}
              {formatLocaleInteger(warbowMaxSteals)} times per UTC day unless you pay the extra bypass burn. Guard
              lasts 6h and reduces the next incoming steal to 1%. Revenge lets the victim hit the pending stealer
              once within the configured window. After a buy, silence for {formatLocaleInteger(warbowFlagSilenceSec)}s
              lets the buyer claim +{formatLocaleInteger(warbowFlagClaimBp)} BP.
            </StatusMessage>
          </div>
        </details>
        {isConnected && saleActive && (
          <>
            <label className="form-label">
              Steal victim address
              <input
                type="text"
                className="form-input"
                placeholder="0x..."
                value={stealVictimInput}
                onChange={(e) => setStealVictimInput(e.target.value)}
                spellCheck={false}
              />
            </label>
            {stealVictim && victimStealsToday !== undefined && (
              <StatusMessage variant="muted">
                Victim steals received today:{" "}
                {formatLocaleInteger(BigInt(victimStealsToday as bigint | number))} / {warbowMaxSteals}
              </StatusMessage>
            )}
            <label className="form-label">
              <input
                type="checkbox"
                checked={stealBypass}
                onChange={(e) => setStealBypass(e.target.checked)}
              />{" "}
              Pay the bypass burn if the victim already hit the UTC-day steal cap
            </label>
            <div className="timecurve-action-row">
              <motion.button
                type="button"
                className="btn-secondary btn-secondary--critical"
                disabled={isWriting}
                onClick={() => void runWarBowSteal()}
                {...secondaryButtonMotion}
              >
                Attempt steal
              </motion.button>
              <motion.button
                type="button"
                className="btn-secondary"
                disabled={isWriting}
                onClick={() => void runWarBowGuard()}
                {...secondaryButtonMotion}
              >
                Activate guard
              </motion.button>
              <motion.button
                type="button"
                className="btn-secondary"
                disabled={isWriting || !canClaimWarBowFlag}
                onClick={() => void runWarBowClaimFlag()}
                {...secondaryButtonMotion}
              >
                Claim flag
              </motion.button>
              <motion.button
                type="button"
                className="btn-secondary btn-secondary--priority"
                disabled={isWriting || !hasRevengeOpen}
                onClick={() => void runWarBowRevenge()}
                {...secondaryButtonMotion}
              >
                Trigger revenge
              </motion.button>
            </div>
            {!canClaimWarBowFlag && iHoldPlantFlag && saleActive && (
              <StatusMessage variant="muted">
                Flag planted. Silence ends at <UnixTimestampDisplay raw={flagSilenceEndSec} />.
              </StatusMessage>
            )}
          </>
        )}
        <div className="split-layout">
          <div className="podium-block">
            <h3>Contract top 3</h3>
            <RankingList rows={warbowTopRows} emptyText="Waiting for WarBow contract snapshot." />
          </div>
          <div className="podium-block">
            <h3>Indexer leaderboard</h3>
            <RankingList rows={warbowLeaderboardRows} emptyText="Set the indexer URL or wait for indexed buys." />
          </div>
        </div>
        <div className="podium-block">
          <h3>Battle feed</h3>
          {warbowFeed && warbowFeed.length > 0 ? (
            <ul className="feed-grid">
              {warbowFeed.slice(0, 8).map((item) => (
                <FeedCard
                  key={`${item.tx_hash}-${item.kind}-${item.log_index}`}
                  title={
                    <>
                      <strong>{item.kind}</strong>
                    </>
                  }
                  meta={
                    <>
                      block {formatLocaleInteger(item.block_number)} · tx <TxHash hash={item.tx_hash} />
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <StatusMessage variant="muted">No WarBow feed rows yet.</StatusMessage>
          )}
        </div>
      </PageSection>

      <PageSection
        title="Podiums and prizes"
        badgeLabel="Three reserve categories"
        badgeTone="warning"
        lede="The reserve podium pool is fixed to three categories only: last buy, time booster, and defended streak. WarBow Battle Points are a separate PvP ladder."
      >
        <div className="podium-preview">
          {podiumPayoutPreview.map((row, idx) => (
            <div key={idx} className="podium-block">
              <h3>{PODIUM_LABELS[idx] ?? `Category ${idx}`}</h3>
              <p className="muted">{PODIUM_HELP[idx]}</p>
              <RankingList
                rows={(["1st", "2nd", "3rd"] as const).map((lab, placeIndex) => ({
                  key: `preview-${idx}-${lab}`,
                  rank: placeIndex + 1,
                  label: lab,
                  value: <AmountDisplay raw={row.places[placeIndex]} decimals={decimals} />,
                  meta: placeIndex === 0 ? "Largest reserve slice in category" : "Reserve payout preview",
                }))}
                emptyText="Waiting for podium pool balance."
              />
            </div>
          ))}
        </div>
        <details className="podium-block accordion-panel">
          <summary>
            <strong>Current winners and category rules</strong>
          </summary>
          <div className="accordion-panel__content">
            <div className="split-layout">
              <div>
                <h3>How categories work</h3>
                <ul className="accent-list">
                  {PODIUM_LABELS.map((title, index) => (
                    <li key={title}>
                      <strong>{title}</strong>
                      <div className="muted">{PODIUM_HELP[index]}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Onchain podiums</h3>
                {podiumReads.isLoading && <StatusMessage variant="loading">Loading podiums...</StatusMessage>}
                {!podiumReads.isLoading &&
                  podiumReads.data?.map((row, index) => (
                    <div key={index} className="podium-block">
                      <h3>{PODIUM_LABELS[index] ?? `Category ${index}`}</h3>
                      <RankingList
                        rows={row.winners.map((winner, placeIndex) => ({
                          key: `podium-${index}-${winner}-${placeIndex}`,
                          rank: placeIndex + 1,
                          label: <span className="mono">{shortAddress(winner)}</span>,
                          value: formatPodiumLeaderboardValue(index, row.values[placeIndex] ?? 0n),
                          meta: placeIndex === 0 ? "Current leader" : "Onchain snapshot",
                          highlight: sameAddress(winner, address),
                        }))}
                        emptyText="No onchain winners yet."
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </details>
      </PageSection>

      <PageSection
        title="Live battle feed"
        badgeLabel="Indexer mirror"
        badgeTone="info"
        lede="Recent buys now read like game events instead of flat rows, while slower-moving settlement mirrors stay collapsed below."
      >
        {indexerNote && <StatusMessage variant="placeholder">{indexerNote}</StatusMessage>}
        {!buys && !indexerNote && <StatusMessage variant="loading">Loading recent buys...</StatusMessage>}
        {buys && buys.length === 0 && !indexerNote && (
          <StatusMessage variant="muted">No buys indexed yet.</StatusMessage>
        )}
        {buys && buys.length > 0 && (
          <ul className="feed-grid">
            {buys.map((buy) => {
              const tags: string[] = [];
              if (buy.actual_seconds_added !== undefined) {
                tags.push(`+${formatLocaleInteger(BigInt(buy.actual_seconds_added))}s`);
              }
              if (buy.timer_hard_reset) {
                tags.push("reset");
              }
              if (buy.flag_planted) {
                tags.push("flag");
              }
              if (buy.bp_ambush_bonus !== undefined && BigInt(buy.bp_ambush_bonus) > 0n) {
                tags.push("ambush");
              }
              if (buy.bp_clutch_bonus !== undefined && BigInt(buy.bp_clutch_bonus) > 0n) {
                tags.push("clutch");
              }
              return (
                <FeedCard
                  key={`${buy.tx_hash}-${buy.log_index}`}
                  title={
                    <>
                      <strong>{sameAddress(buy.buyer, address) ? "You bought" : `${shortAddress(buy.buyer)} bought`}</strong>
                      <AmountDisplay raw={buy.amount} decimals={decimals} />
                    </>
                  }
                  meta={
                    <>
                      charms {formatCompactFromRaw(buy.charm_wad, 18)} ·
                      {" "}
                      {buy.battle_points_after !== undefined
                        ? `BP ${formatLocaleInteger(BigInt(buy.battle_points_after))}`
                        : "BP n/a"}
                      {" "}· block {formatLocaleInteger(buy.block_number)} · tx <TxHash hash={buy.tx_hash} />
                    </>
                  }
                  tags={tags}
                />
              );
            })}
          </ul>
        )}
        {buysNextOffset !== null && (
          <p>
            <button
              type="button"
              className="btn-secondary"
              disabled={loadingMoreBuys}
              onClick={() => void handleLoadMoreBuys()}
            >
              {loadingMoreBuys ? "Loading..." : "Load more events"}
            </button>
          </p>
        )}
        <details className="podium-block accordion-panel">
          <summary>
            <strong>Settlement mirrors and referral rows</strong>
          </summary>
          <div className="accordion-panel__content">
            <div className="split-layout">
              <div className="podium-block">
                <h3>Charm redemptions</h3>
                {claimsNote && <StatusMessage variant="placeholder">{claimsNote}</StatusMessage>}
                {claims && claims.length > 0 ? (
                  <ul className="event-list">
                    {claims.map((claim) => (
                      <li key={`${claim.tx_hash}-${claim.log_index}`}>
                        <span className="mono">{shortAddress(claim.buyer)}</span> redeemed{" "}
                        <AmountDisplay raw={claim.token_amount} decimals={18} /> · tx{" "}
                        <TxHash hash={claim.tx_hash} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  !claimsNote && <StatusMessage variant="muted">No charm redemptions indexed yet.</StatusMessage>
                )}
              </div>
              <div className="podium-block">
                <h3>Prize batch runs</h3>
                {prizeDist && prizeDist.length > 0 ? (
                  <ul className="event-list">
                    {prizeDist.map((item) => (
                      <li key={`${item.tx_hash}-${item.log_index}`}>
                        PrizesDistributed · block {formatLocaleInteger(item.block_number)} · tx{" "}
                        <TxHash hash={item.tx_hash} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StatusMessage variant="muted">No prize batch runs indexed yet.</StatusMessage>
                )}
              </div>
              <div className="podium-block">
                <h3>Podium payouts</h3>
                {prizePayouts && prizePayouts.length > 0 ? (
                  <ul className="event-list">
                    {prizePayouts.map((item) => (
                      <li key={`${item.tx_hash}-${item.log_index}`}>
                        <span className="mono">{shortAddress(item.winner)}</span> · category {item.category} · place{" "}
                        {item.placement} · <AmountDisplay raw={BigInt(item.amount)} decimals={decimals} /> · tx{" "}
                        <TxHash hash={item.tx_hash} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <StatusMessage variant="muted">No podium payout rows indexed yet.</StatusMessage>
                )}
              </div>
              <div className="podium-block">
                <h3>Referral buys</h3>
                {!address && <StatusMessage variant="placeholder">Connect a wallet to see your referral rows.</StatusMessage>}
                {address && refApplied && refApplied.length > 0 ? (
                  <ul className="event-list">
                    {refApplied.map((item) => (
                      <li key={`${item.tx_hash}-${item.log_index}`}>
                        buyer <span className="mono">{shortAddress(item.buyer)}</span> · referrer CHARM{" "}
                        <AmountDisplay raw={BigInt(item.referrer_amount)} decimals={18} /> · tx{" "}
                        <TxHash hash={item.tx_hash} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  address && <StatusMessage variant="muted">No referral rows indexed for this wallet.</StatusMessage>
                )}
              </div>
            </div>
          </div>
        </details>
      </PageSection>

      <details className="data-panel accordion-panel">
        <summary>
          <div className="section-heading__copy">
            <PageBadge label="Protocol detail" tone="info" />
            <h2>Raw contract and operator context</h2>
            <div className="section-heading__lede">
              Player-facing buy, timer, prizes, and PvP surfaces now come first. Open this for raw onchain mirrors,
              immutable parameters, and launch-routing context.
            </div>
          </div>
        </summary>
        <div className="accordion-panel__content">
          <div className="split-layout">
            <div className="podium-block">
              <h3>Onchain snapshot</h3>
              {coreTcData && (
                <dl className="kv">
                  <dt>saleStart</dt>
                  <dd>{saleStart?.status === "success" ? <UnixTimestampDisplay raw={saleStart.result as bigint} /> : "—"}</dd>
                  <dt>deadline</dt>
                  <dd>{deadline?.status === "success" ? <UnixTimestampDisplay raw={deadline.result as bigint} /> : "—"}</dd>
                  <dt>time remaining</dt>
                  <dd>{remaining !== undefined ? `${formatLocaleInteger(remaining)}s` : "—"}</dd>
                  <dt>totalRaised</dt>
                  <dd>{totalRaised?.status === "success" ? <AmountDisplay raw={totalRaised.result as bigint} decimals={decimals} /> : "—"}</dd>
                  <dt>ended</dt>
                  <dd>{ended?.status === "success" ? String(ended.result) : "—"}</dd>
                  <dt>max buy</dt>
                  <dd>{maxBuyAmount !== undefined ? <AmountDisplay raw={maxBuyAmount} decimals={decimals} /> : "—"}</dd>
                  <dt>prizesDistributed</dt>
                  <dd>{prizesDistributedR?.status === "success" ? String(prizesDistributedR.result) : "—"}</dd>
                </dl>
              )}
            </div>
            <div className="podium-block">
              <h3>Your participation</h3>
              {!isConnected && <StatusMessage variant="placeholder">Connect a wallet to see your deeper onchain stats.</StatusMessage>}
              {isConnected && address && (
                <>
                  <dl className="kv">
                    <dt>charmWeight</dt>
                    <dd>{charmWeightR?.status === "success" ? <AmountDisplay raw={charmWeightR.result as bigint} decimals={18} /> : "—"}</dd>
                    <dt>buyCount</dt>
                    <dd>{buyCountR?.status === "success" ? formatLocaleInteger(buyCountR.result as bigint) : "—"}</dd>
                    <dt>timer added</dt>
                    <dd>{timerAddedR?.status === "success" ? `${formatLocaleInteger(timerAddedR.result as bigint)} s` : "—"}</dd>
                    <dt>battlePoints</dt>
                    <dd>{battlePtsR?.status === "success" ? formatLocaleInteger(battlePtsR.result as bigint) : "—"}</dd>
                    <dt>active streak</dt>
                    <dd>{activeStreakR?.status === "success" ? formatLocaleInteger(activeStreakR.result as bigint) : "—"}</dd>
                    <dt>best streak</dt>
                    <dd>{bestStreakR?.status === "success" ? formatLocaleInteger(bestStreakR.result as bigint) : "—"}</dd>
                    <dt>revenge</dt>
                    <dd className="mono">
                      {pendingRevengeStealer &&
                      pendingRevengeStealer !== "0x0000000000000000000000000000000000000000"
                        ? `${shortAddress(pendingRevengeStealer)} · ${formatUnixSecIsoUtc(revengeDeadlineSec)}`
                        : "—"}
                    </dd>
                  </dl>
                  {indexerBaseUrl() && buyerStats && (
                    <StatusMessage variant="muted">
                      Indexer mirror: charm weight {formatCompactFromRaw(buyerStats.indexed_charm_weight, 18)} · buys{" "}
                      {formatLocaleInteger(buyerStats.indexed_buy_count)}
                    </StatusMessage>
                  )}
                </>
              )}
            </div>
            <div className="podium-block">
              <h3>Immutable sale parameters</h3>
              {coreTcData && (
                <dl className="kv">
                  <dt>envelope ref WAD</dt>
                  <dd>{initialMinBuyR?.status === "success" ? <AmountDisplay raw={initialMinBuyR.result as bigint} decimals={18} /> : "—"}</dd>
                  <dt>growthRateWad</dt>
                  <dd className="mono">{growthRateWadR?.status === "success" ? formatCompactFromRaw(growthRateWadR.result as bigint, 18) : "—"}</dd>
                  <dt>timerExtensionSec</dt>
                  <dd>{timerExtensionSecR?.status === "success" ? formatLocaleInteger(timerExtensionSecR.result as bigint) : "—"}</dd>
                  <dt>initialTimerSec</dt>
                  <dd>{initialTimerSecR?.status === "success" ? formatLocaleInteger(initialTimerSecR.result as bigint) : "—"}</dd>
                  <dt>timerCapSec</dt>
                  <dd>{timerCapSecR?.status === "success" ? formatLocaleInteger(timerCapSecR.result as bigint) : "—"}</dd>
                  <dt>totalTokensForSale</dt>
                  <dd>{totalTokensForSaleR?.status === "success" ? <AmountDisplay raw={totalTokensForSaleR.result as bigint} decimals={18} /> : "—"}</dd>
                </dl>
              )}
            </div>
            <div className="podium-block">
              <h3>Reserve routing and launch anchors</h3>
              <ul className="event-list">
                {(
                  [
                    ["DOUB LP (locked SIR / Kumbaya)", RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity],
                    ["CL8Y buy-and-burn", RESERVE_FEE_ROUTING_BPS.cl8yBuyAndBurn],
                    ["Podium pool", RESERVE_FEE_ROUTING_BPS.podiumPool],
                    ["Team / reserved", RESERVE_FEE_ROUTING_BPS.team],
                    ["Rabbit Treasury", RESERVE_FEE_ROUTING_BPS.rabbitTreasury],
                  ] as const
                ).map(([label, bps], index) => {
                  const row = sinkReads?.[index];
                  const onchain =
                    row?.status === "success" ? Number((row.result as readonly [unknown, number])[1]) : null;
                  return (
                    <li key={label}>
                      <strong>{label}</strong> · policy {formatBpsAsPercent(bps)}
                      {onchain !== null ? ` · onchain ${formatBpsAsPercent(onchain)}` : ""}
                    </li>
                  );
                })}
              </ul>
              {liquidityAnchors ? (
                <dl className="kv" style={{ marginTop: "0.85rem" }}>
                  <dt>Projected reserve / DOUB</dt>
                  <dd className="mono">{formatCompactFromRaw(liquidityAnchors.clearing, 18)}</dd>
                  <dt>Launch anchor</dt>
                  <dd className="mono">{formatCompactFromRaw(liquidityAnchors.launch, 18)}</dd>
                  <dt>Kumbaya lower band</dt>
                  <dd className="mono">{formatCompactFromRaw(liquidityAnchors.kLo, 18)}</dd>
                </dl>
              ) : (
                <StatusMessage variant="muted">Waiting for sale totals to project liquidity anchors.</StatusMessage>
              )}
            </div>
          </div>
          <div className="split-layout">
            <div className="podium-block">
              <h3>Charm redemption curve</h3>
              {coreTcData && totalRaised?.status === "success" && totalTokensForSaleR?.status === "success" && (
                <CharmRedemptionCurve
                  totalRaised={totalRaised.result as bigint}
                  totalTokensForSale={totalTokensForSaleR.result as bigint}
                  acceptedDecimals={decimals}
                  launchedDecimals={launchedDec}
                  userCharmWeight={charmWeightR?.status === "success" ? (charmWeightR.result as bigint) : undefined}
                  saleStarted={saleStart?.status === "success" && (saleStart.result as bigint) > 0n}
                />
              )}
            </div>
            <div className="podium-block">
              <h3>Min gross spend curve</h3>
              {minSpendCurvePoints.length > 1 ? (
                <svg className="epoch-chart" viewBox="0 0 400 120" role="img" aria-label="Min gross spend curve">
                  {(() => {
                    const vals = minSpendCurvePoints.map((point) => Number(point.minSpend));
                    const vmin = Math.min(...vals);
                    const vmax = Math.max(...vals);
                    const span = Math.max(vmax - vmin, 1);
                    return (
                      <polyline
                        fill="none"
                        stroke="var(--line)"
                        strokeWidth="3"
                        points={minSpendCurvePoints
                          .map((point, index) => {
                            const x = (index / (minSpendCurvePoints.length - 1)) * 380 + 10;
                            const y = 110 - ((Number(point.minSpend) - vmin) / span) * 100;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    );
                  })()}
                </svg>
              ) : (
                <StatusMessage variant="muted">Curve appears after the sale has started.</StatusMessage>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function usePodiumReads(tc: `0x${string}` | undefined) {
  const contracts = tc
    ? ([
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [0],
        },
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [1],
        },
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [2],
        },
      ] as const)
    : [];
  const { data: rawData, isPending } = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: { enabled: Boolean(tc) },
  });
  const data = rawData as readonly ContractReadRow[] | undefined;

  const rows =
    data?.map((r) => {
      if (r.status !== "success") {
        return { winners: ["0x0", "0x0", "0x0"] as const, values: [0n, 0n, 0n] as const };
      }
      const result = r.result as readonly [
        readonly `0x${string}`[],
        readonly (bigint | string)[],
      ];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const v = result[1];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [
          rawToBigIntForFormat(v[0]),
          rawToBigIntForFormat(v[1]),
          rawToBigIntForFormat(v[2]),
        ] as const,
      };
    }) ?? [];

  return { data: rows, isLoading: isPending };
}
