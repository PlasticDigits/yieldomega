// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useBlock, useReadContract, useReadContracts } from "wagmi";
import { walletDisplayFromMap } from "@/lib/addressFormat";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { erc20Abi, feeRouterReadAbi, linearCharmPriceReadAbi, timeCurveReadAbi } from "@/lib/abis";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import {
  fetchTimecurveBuyerStats,
  fetchWarbowPendingRevenge,
  type TimecurveBuyerStats,
  type WarbowPendingRevengeItem,
} from "@/lib/indexerApi";
import { reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import {
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { sampleMinSpendCurve } from "@/lib/timeCurveMath";
import {
  derivePhase,
  ledgerSecIntForPhase,
  phaseFlags,
  timecurveHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/timecurve/timeCurveSimplePhase";
import { useTimecurveHeroTimer } from "@/pages/timecurve/useTimecurveHeroTimer";
import { serializeContractRead, type SerializableContractRead } from "@/lib/serializeContractRead";
import type { ContractReadRow } from "@/pages/timeCurveArena/arenaPageHelpers";

const coreTcContracts = (tc: HexAddress) =>
  [
    { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "deadline" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "ended" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "currentMaxBuyAmount" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "currentCharmBoundsWad" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "currentPricePerCharmWad" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "charmPrice" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "initialMinBuy" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "growthRateWad" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "timerExtensionSec" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "initialTimerSec" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "timerCapSec" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "totalTokensForSale" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "launchedToken" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "prizesDistributed" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "buyFeeRoutingEnabled" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "feeRouter" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "podiumPool" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "totalCharmWeight" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "buyCooldownSec" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "timeCurveBuyRouter" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "reservePodiumPayoutsEnabled" as const },
    { address: tc, abi: timeCurveReadAbi, functionName: "owner" as const },
  ] as const;

/**
 * Contract + indexer mirrors for {@link RawDataAccordion} on the protocol / audit page.
 * Keeps the same read bundle semantics as the former Arena placement.
 */
export function useTimecurveProtocolRawAccordion() {
  const tc = addresses.timeCurve;
  const { address, isConnected } = useAccount();
  const { data: latestBlock } = useBlock({ watch: true });
  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const blockChainSec = blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000;
  const ledgerSecInt = Math.floor(blockChainSec);
  const ledgerSecIntRef = useRef(ledgerSecInt);
  ledgerSecIntRef.current = ledgerSecInt;

  const { chainNowSec: heroChainNowSec, heroTimer } = useTimecurveHeroTimer(tc);

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  const { data: coreTcDataRaw } = useReadContracts({
    contracts: tc ? [...coreTcContracts(tc)] : [],
    query: {
      enabled: Boolean(tc),
      refetchInterval: 1000,
    },
  });
  const coreTcData = coreTcDataRaw as readonly ContractReadRow[] | undefined;

  const [
    saleStart,
    deadline,
    totalRaised,
    ended,
    _minBuy,
    maxBuy,
    _charmBoundsR,
    _pricePerCharmR,
    charmPriceAddrR,
    acceptedAsset,
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
    feeRouterR,
    _podiumPoolR,
    _totalCharmWeightR,
    _buyCooldownSecR,
    _timeCurveBuyRouterR,
    _reservePodiumPayoutsEnabledR,
    _timeCurveOwnerR,
  ] = coreTcData ?? [];

  const userSaleContracts =
    tc && address
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "charmWeight" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "buyCount" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "charmsRedeemed" as const, args: [address] },
          {
            address: tc,
            abi: timeCurveReadAbi,
            functionName: "totalEffectiveTimerSecAdded" as const,
            args: [address],
          },
          { address: tc, abi: timeCurveReadAbi, functionName: "battlePoints" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "activeDefendedStreak" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "bestDefendedStreak" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "warbowGuardUntil" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "nextBuyAllowedAt" as const, args: [address] },
        ]
      : [];
  const { data: userSaleDataRaw } = useReadContracts({
    contracts: userSaleContracts as readonly unknown[],
    query: { enabled: Boolean(tc && address) },
  });
  const userSaleData = userSaleDataRaw as readonly ContractReadRow[] | undefined;

  const [charmWeightR, buyCountR, _charmsRedeemedR, timerAddedR, battlePtsR, activeStreakR, bestStreakR] =
    userSaleData ?? [];

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
            functionName: "basePriceWad" as const,
          },
          {
            address: linearCharmAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad" as const,
          },
        ]
      : []) as readonly unknown[],
    query: { enabled: Boolean(tc && linearCharmAddr) },
  });
  const linearPriceReads = linearPriceReadsRaw as readonly ContractReadRow[] | undefined;
  const [basePriceWadR, dailyIncWadR] = linearPriceReads ?? [];

  const maxBuyAmount = maxBuy?.status === "success" ? (maxBuy.result as bigint) : undefined;

  const feeRouterAddr =
    feeRouterR?.status === "success" ? (feeRouterR.result as `0x${string}`) : undefined;

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

  const saleActive = phaseFlags(arenaPhase).saleActive;

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

  const [pendingRevengeRows, setPendingRevengeRows] = useState<WarbowPendingRevengeItem[]>([]);

  const loadPendingRevenge = useCallback(() => {
    if (!address || !indexerBaseUrl() || !saleActive) {
      setPendingRevengeRows([]);
      return;
    }
    void fetchWarbowPendingRevenge(address, ledgerSecIntRef.current).then((page) => {
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
