// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
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
import { useLatestBlock } from "@/providers/LatestBlockContext";
import {
  useArenaProtocolData,
  useArenaProtocolAccordionTokenDecimals,
} from "@/pages/arena/ArenaProtocolDataContext";

/**
 * Contract + indexer mirrors for {@link RawDataAccordion} on the protocol / audit page.
 */
export function useArenaProtocolRawAccordion() {
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
  } = useArenaProtocolData();

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
    _paused,
    _charmPriceWad,
    _doub,
    _refReg,
    timerExtensionSecR,
    timerCapSecR,
    _buyCooldownSecR,
    _buyRouter,
    _owner,
  ] = coreTcData ?? [];

  const [battlePtsR, _guardUntilR, timerAddedR] = userSaleDataRaw ?? [];

  const decimals = useArenaProtocolAccordionTokenDecimals();

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

  const pendingRevengeTargets = useMemo(() => [] as const, []);
  const formatWallet = useMemo(() => walletDisplayFromMap(new Map()), []);

  return {
    hasCoreContractReads: Boolean(coreTcData && coreTcData.length > 0),
    saleStart: serializeContractRead(saleStart),
    deadline: serializeContractRead(deadline),
    secondsRemaining: heroDisplaySecondsRemaining,
    countdownSecondsContext,
    totalRaised: serializeContractRead(totalRaised),
    ended: undefined,
    maxBuyAmount: undefined,
    prizesDistributedResult: undefined,
    isConnected,
    charmWeightResult: undefined,
    buyCountResult: undefined,
    timerAddedResult: serializeContractRead(timerAddedR),
    battlePointsResult: serializeContractRead(battlePtsR),
    activeStreakResult: undefined,
    bestStreakResult: undefined,
    pendingRevengeTargets,
    revengeIndexerConfigured: Boolean(indexerBaseUrl()),
    buyerStats: indexerBaseUrl() ? buyerStats : null,
    timerExtensionSecResult: serializeContractRead(timerExtensionSecR),
    initialTimerSecResult: undefined,
    timerCapSecResult: serializeContractRead(timerCapSecR),
    sinkReads: undefined,
    decimals,
    formatWallet,
  };
}
