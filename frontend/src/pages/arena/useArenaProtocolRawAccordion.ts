// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ARENA_V2_ADVANCED_CORE_ROW_INDICES as CORE } from "@/pages/arena/arenaV2AdvancedSessionBridge";
import { walletDisplayFromMap } from "@/lib/addressFormat";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchArenaBuyerStats,
  type ArenaBuyerStats,
} from "@/lib/indexerApi";
import {
  derivePhase,
  ledgerSecIntForPhase,
  arenaHeroDisplaySecondsRemaining,
  type SaleSessionPhase,
} from "@/pages/arena/arenaSimplePhase";
import { serializeContractRead } from "@/lib/serializeContractRead";
import {
  useArenaProtocolData,
  useArenaProtocolAccordionTokenDecimals,
} from "@/pages/arena/ArenaProtocolDataContext";
import { useArenaPendingRevengeTargets } from "@/hooks/useArenaPendingRevengeTargets";

/**
 * Contract + indexer mirrors for {@link RawDataAccordion} on the protocol / audit page.
 */
export function useArenaProtocolRawAccordion() {
  const { address, isConnected } = useAccount();
  const ledgerSecInt = Math.floor(Date.now() / 1000);
  const ledgerSecIntRef = useRef(ledgerSecInt);
  ledgerSecIntRef.current = ledgerSecInt;

  const {
    coreTcDataForAccordion: coreTcData,
    userSaleData: userSaleDataRaw,
    heroTimer,
    heroChainNowSec,
  } = useArenaProtocolData();

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: Math.floor(heroChainNowSec ?? Date.now() / 1000),
        heroChainNowSec: heroChainNowSec,
      }),
    [heroChainNowSec],
  );

  const saleStart = coreTcData?.[CORE.arenaStart];
  const deadline = coreTcData?.[CORE.deadline];
  const totalRaised = coreTcData?.[CORE.totalDoubRaised];

  const [
    battlePtsR,
    _guardUntilR,
    charmWeightR,
    buyCountR,
    timerAddedR,
    activeStreakR,
    bestStreakR,
  ] = userSaleDataRaw ?? [];

  const decimals = useArenaProtocolAccordionTokenDecimals();

  const { pendingRevengeTargets, revengeIndexerConfigured, pendingRevengeLoadFailed } =
    useArenaPendingRevengeTargets(address, { pollMs: false });

  const arenaSaleStartSec =
    saleStart?.status === "success" ? Number(saleStart.result as bigint) : undefined;
  const arenaDeadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;

  const arenaPhase: SaleSessionPhase = useMemo(
    () =>
      derivePhase({
        hasCoreData: Boolean(coreTcData && coreTcData.length > 0),
        saleStartSec: arenaSaleStartSec,
        deadlineSec: arenaDeadlineSec,
        ledgerSecInt: phaseLedgerSecInt,
      }),
    [coreTcData, arenaSaleStartSec, arenaDeadlineSec, phaseLedgerSecInt],
  );

  const heroDisplaySecondsRemaining = useMemo(
    () =>
      arenaHeroDisplaySecondsRemaining({
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
      : arenaPhase === "saleActive"
        ? ("untilRoundDeadline" as const)
        : ("generic" as const);

  const [buyerStats, setBuyerStats] = useState<ArenaBuyerStats | null>(null);
  useEffect(() => {
    if (!address || !indexerBaseUrl()) {
      setBuyerStats(null);
      return;
    }
    let cancelled = false;
    void fetchArenaBuyerStats(address).then((s) => {
      if (!cancelled) {
        setBuyerStats(s);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const formatWallet = useMemo(() => walletDisplayFromMap(new Map()), []);

  return {
    hasCoreContractReads: Boolean(coreTcData && coreTcData.length > 0),
    saleStart: serializeContractRead(saleStart),
    deadline: serializeContractRead(deadline),
    secondsRemaining: heroDisplaySecondsRemaining,
    countdownSecondsContext,
    totalRaised: serializeContractRead(totalRaised),
    isConnected,
    charmWeightResult: serializeContractRead(charmWeightR),
    buyCountResult: serializeContractRead(buyCountR),
    timerAddedResult: serializeContractRead(timerAddedR),
    battlePointsResult: serializeContractRead(battlePtsR),
    activeStreakResult: serializeContractRead(activeStreakR),
    bestStreakResult: serializeContractRead(bestStreakR),
    pendingRevengeTargets,
    revengeIndexerConfigured,
    pendingRevengeLoadFailed,
    buyerStats: indexerBaseUrl() ? buyerStats : null,
    decimals,
    formatWallet,
  };
}
