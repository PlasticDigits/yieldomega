// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTimecurveChainTimer, type TimecurveChainTimer } from "@/lib/indexerApi";

export type HeroTimerState = {
  deadlineSec: number;
  blockTimestampSec: number;
  timerCapSec: number;
  readBlockNumber: bigint;
  /** `Math.floor(Date.now() / 1000)` at the moment this snapshot was stored — not stale state. */
  fetchedAtSec: number;
};

function snapshotFromIndexerChainTimer(data: TimecurveChainTimer): Omit<HeroTimerState, "fetchedAtSec"> {
  return {
    deadlineSec: Number(data.deadline_sec),
    blockTimestampSec: Number(data.block_timestamp_sec),
    timerCapSec: Number(data.timer_cap_sec),
    readBlockNumber: BigInt(data.read_block_number),
  };
}

function isFiniteHeroBase(base: Omit<HeroTimerState, "fetchedAtSec">): boolean {
  return (
    Number.isFinite(base.deadlineSec) &&
    Number.isFinite(base.blockTimestampSec) &&
    Number.isFinite(base.timerCapSec)
  );
}

/** Wall clock minus chain head time (seconds), captured once per anchor; subtract 1 so we assume the round ends one second sooner. */
function conservativeSkewWallMinusChainSec(fetchedAtSec: number, blockTimestampSec: number): number {
  return fetchedAtSec - blockTimestampSec - 1;
}

export type UseTimecurveHeroTimerResult = {
  heroTimer: HeroTimerState | null;
  secondsRemaining: number | undefined;
  isBusy: boolean;
  refresh: () => void;
};

/**
 * TimeCurve hero countdown from indexer `/v1/timecurve/chain-timer`.
 * Wall-vs-chain skew is fixed on first load and on `refresh()`; polls only update deadline / display fields so the skew does not drift tick-to-tick.
 */
export function useTimecurveHeroTimer(timeCurveAddress: `0x${string}` | undefined): UseTimecurveHeroTimerResult {
  const [heroTimer, setHeroTimer] = useState<HeroTimerState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | undefined>(undefined);
  const [currentWallclockSec, setCurrentWallclockSec] = useState(Math.floor(Date.now() / 1000));

  const skewWallMinusChainRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWallclockSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSnapshot = useCallback(
    async (resetSkew: boolean) => {
      if (!timeCurveAddress) return;
      if (resetSkew) setIsBusy(true);
      try {
        const fetchedAtSec = Math.floor(Date.now() / 1000);
        const data = await fetchTimecurveChainTimer();
        if (!data) return;
        const base = snapshotFromIndexerChainTimer(data);
        if (!isFiniteHeroBase(base)) return;

        if (resetSkew || skewWallMinusChainRef.current === null) {
          skewWallMinusChainRef.current = conservativeSkewWallMinusChainSec(fetchedAtSec, base.blockTimestampSec);
        }

        setHeroTimer({ ...base, fetchedAtSec });
      } catch {
        /* ignore */
      } finally {
        if (resetSkew) setIsBusy(false);
      }
    },
    [timeCurveAddress],
  );

  const refresh = useCallback(() => void loadSnapshot(true), [loadSnapshot]);

  useEffect(() => {
    if (!timeCurveAddress) {
      setHeroTimer(null);
      skewWallMinusChainRef.current = null;
      return;
    }
    void loadSnapshot(true);
    const id = window.setInterval(() => void loadSnapshot(false), 1000);
    return () => window.clearInterval(id);
  }, [timeCurveAddress, loadSnapshot]);

  useEffect(() => {
    console.log("RUNNING");
    console.log(
      "deadline:",
      heroTimer?.deadlineSec,
      "blockTimestamp:",
      heroTimer?.blockTimestampSec,
      "fetchedAt:",
      heroTimer?.fetchedAtSec,
      "currentWallclock:",
      currentWallclockSec,
      "skewWallMinusChain:",
      skewWallMinusChainRef.current,
    );

    if (!heroTimer) {
      setSecondsRemaining(undefined);
      return;
    }

    const skew = skewWallMinusChainRef.current;
    if (skew == null || !Number.isFinite(skew)) {
      setSecondsRemaining(undefined);
      return;
    }

    if (!Number.isFinite(heroTimer.deadlineSec)) {
      return;
    }

    const chainNowSec = currentWallclockSec - skew;
    const next = Math.max(0, Math.floor(heroTimer.deadlineSec - chainNowSec));
    console.log("secondsRemaining:", next);
    setSecondsRemaining(next);
  }, [heroTimer, currentWallclockSec]);

  return {
    heroTimer,
    secondsRemaining,
    isBusy,
    refresh,
  };
}
