// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { walletDisplayFromMap } from "@/lib/addressFormat";
import { indexerBaseUrl } from "@/lib/addresses";
import { erc20Abi } from "@/lib/abis";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import {
  fetchTimecurveBuyerStats,
  type TimecurveBuyerStats,
} from "@/lib/indexerApi";
import {
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { sampleMinSpendCurve } from "@/lib/timeCurveMath";
import {
  derivePhase,
  ledgerSecIntForPhase,
  timecurveHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/timecurve/timeCurveSimplePhase";
import { serializeContractRead, type SerializableContractRead } from "@/lib/serializeContractRead";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import {
  useTimeCurveProtocolData,
  useTimecurveProtocolAccordionTokenDecimals,
} from "@/pages/timecurve/TimeCurveProtocolDataContext";

/**
 * Contract + indexer mirrors for {@link RawDataAccordion} on the protocol / audit page.
 * RPC slices come from {@link TimeCurveProtocolDataProvider} (single multicall + latch).
 */
export function useTimecurveProtocolRawAccordion() {
  const { address, isConnected } = useAccount();
  const { data: latestBlock } = useLatestBlock();
  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const blockChainSec = blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000;
  const ledgerSecInt = Math.floor(blockChainSec);
  const ledgerSecIntRef = useRef(ledgerSecInt);
  ledgerSecIntRef.current = ledgerSecInt;

  const {
    coreTcDataForAccordion: coreTcData,
    userSaleData: userSaleDataRaw,
    heroTimer,
    heroChainNowSec,
    charmPriceRows,
    sinksRows: sinkReads,
  } = useTimeCurveProtocolData();

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  const [
    saleStart,
    deadline,
    totalRaised,
    ended,
    _minBuy,
    maxBuy,
    _charmBoundsR,
    _pricePerCharmR,
    _charmPriceAddrR,
    _acceptedAsset,
    _refRegAddr,
    initialMinBuyR,
    growthRateWadR,
    timerExtensionSecR,
    initialTimerSecR,
    timerCapSecR,
    totalTokensForSaleR,
    launchedTokenR,
    prizesDistributedR,
    _buyFeeRoutingEnabledR,
    _feeRouterR,
    _podiumPoolR,
    _totalCharmWeightR,
    _buyCooldownSecR,
    _timeCurveBuyRouterR,
    _reservePodiumPayoutsEnabledR,
    _timeCurveOwnerR,
  ] = coreTcData ?? [];

  const [charmWeightR, buyCountR, _charmsRedeemedR, timerAddedR, battlePtsR, activeStreakR, bestStreakR] =
    userSaleDataRaw ?? [];

  const [basePriceWadR, dailyIncWadR] = charmPriceRows ?? [];

  const maxBuyAmount = maxBuy?.status === "success" ? (maxBuy.result as bigint) : undefined;

  const decimals = useTimecurveProtocolAccordionTokenDecimals();

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

  const arenaSaleStartSec =
    saleStart?.status === "success" ? Number(saleStart.result as bigint) : undefined;
  const arenaEnded = ended?.status === "success" ? (ended.result as boolean) : undefined;
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
          heroTimer && heroTimer.saleStartSec > 0 ? heroTimer.saleStartSec : arenaSaleStartSec,
        deadlineSec: heroTimer ? heroTimer.deadlineSec : arenaDeadlineSec,
        chainNowSec: heroChainNowSec,
      }),
    [arenaPhase, heroTimer, arenaSaleStartSec, arenaDeadlineSec, heroChainNowSec],
  );

  const countdownSecondsContext =
    arenaPhase === "saleStartPending"
      ? ("untilOpen" as const)
      : arenaPhase === "saleActive" || arenaPhase === "saleExpiredAwaitingEnd"
        ? ("untilRoundDeadline" as const)
        : ("generic" as const);

  const [buyerStats, setBuyerStats] = useState<TimecurveBuyerStats | null>(null);
  useEffect(() => {
    if (!address || !indexerBaseUrl()) {
      setBuyerStats(null);
      return;
    }
    let cancelled = false;
    void fetchTimecurveBuyerStats(address).then((s) => {
      if (!cancelled) {
        setBuyerStats(s);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const pendingRevengeTargets = useMemo(() => [] as const, []);

  const formatWallet = useMemo(() => walletDisplayFromMap(new Map()), []);

  return {
    hasCoreContractReads: Boolean(coreTcData && coreTcData.length > 0),
    saleStart: serializeContractRead(saleStart),
    deadline: serializeContractRead(deadline),
    secondsRemaining: heroDisplaySecondsRemaining,
    countdownSecondsContext,
    totalRaised: serializeContractRead(totalRaised),
    ended: serializeContractRead(ended),
    maxBuyAmount: maxBuyAmount?.toString(),
    prizesDistributedResult: serializeContractRead(prizesDistributedR),
    isConnected,
    charmWeightResult: serializeContractRead(charmWeightR),
    buyCountResult: serializeContractRead(buyCountR),
    timerAddedResult: serializeContractRead(timerAddedR),
    battlePointsResult: serializeContractRead(battlePtsR),
    activeStreakResult: serializeContractRead(activeStreakR),
    bestStreakResult: serializeContractRead(bestStreakR),
    pendingRevengeTargets,
    revengeIndexerConfigured: Boolean(indexerBaseUrl()),
    buyerStats: indexerBaseUrl() ? buyerStats : null,
    initialMinBuyResult: serializeContractRead(initialMinBuyR),
    growthRateWadResult: serializeContractRead(growthRateWadR),
    timerExtensionSecResult: serializeContractRead(timerExtensionSecR),
    initialTimerSecResult: serializeContractRead(initialTimerSecR),
    timerCapSecResult: serializeContractRead(timerCapSecR),
    totalTokensForSaleResult: serializeContractRead(totalTokensForSaleR),
    sinkReads: sinkReads?.map((r) => serializeContractRead(r) as SerializableContractRead),
    liquidityAnchors,
    minSpendCurvePoints: minSpendCurvePoints.map((p) => ({ minSpend: p.minSpend.toString() })),
    decimals,
    launchedDec,
    formatWallet,
  };
}
