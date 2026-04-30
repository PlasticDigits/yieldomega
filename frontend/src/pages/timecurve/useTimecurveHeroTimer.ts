// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTimecurveChainTimer, type TimecurveChainTimer } from "@/lib/indexerApi";
import { indexerBaseUrl } from "@/lib/addresses";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";

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
  /**
   * Same `wallClockSec - skewWallMinusChain` used for the primary hero countdown (not necessarily integer).
   * Use for wallet buy cooldown so it stays consistent with `secondsRemaining`.
   */
  chainNowSec: number | undefined;
  isBusy: boolean;
  refresh: () => void;
};

/**
 * TimeCurve hero countdown from indexer `/v1/timecurve/chain-timer`.
 * Wall-vs-chain skew is fixed on first load and on `refresh()`; polls only update deadline / display fields so the skew does not drift tick-to-tick.
 *
 * Poll cadence backs off when the shared indexer health streak is open ([issue #96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)).
 */
export function useTimecurveHeroTimer(timeCurveAddress: `0x${string}` | undefined): UseTimecurveHeroTimerResult {
  const [heroTimer, setHeroTimer] = useState<HeroTimerState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | undefined>(undefined);
  const [chainNowSec, setChainNowSec] = useState<number | undefined>(undefined);

  const skewWallMinusChainRef = useRef<number | null>(null);
  const heroTimerRef = useRef<HeroTimerState | null>(null);
  heroTimerRef.current = heroTimer;

  /** Recompute from latest indexer snapshot + wall clock (never rely on a separate "tick" state that can desync). */
  const recomputeCountdown = useCallback(() => {
    const ht = heroTimerRef.current;
    if (!ht || !Number.isFinite(ht.deadlineSec)) {
      setSecondsRemaining(undefined);
      setChainNowSec(undefined);
      return;
    }
    const skew = skewWallMinusChainRef.current;
    if (skew == null || !Number.isFinite(skew)) {
      setSecondsRemaining(undefined);
      setChainNowSec(undefined);
      return;
    }
    const wallSec = Math.floor(Date.now() / 1000);
    const chainNow = wallSec - skew;
    setChainNowSec(chainNow);
    setSecondsRemaining(Math.max(0, Math.floor(ht.deadlineSec - chainNow)));
  }, []);

  const loadSnapshot = useCallback(
    async (resetSkew: boolean) => {
      if (!timeCurveAddress) return;
      if (resetSkew) setIsBusy(true);
      try {
        const fetchedAtSec = Math.floor(Date.now() / 1000);
        const data = await fetchTimecurveChainTimer();
        const base = data ? snapshotFromIndexerChainTimer(data) : null;
        const ok = Boolean(base && isFiniteHeroBase(base));
        if (indexerBaseUrl()) {
          reportIndexerFetchAttempt(ok);
        }
        if (!ok || !base) {
          return;
        }

        if (resetSkew || skewWallMinusChainRef.current === null) {
          skewWallMinusChainRef.current = conservativeSkewWallMinusChainSec(fetchedAtSec, base.blockTimestampSec);
        }

        setHeroTimer({ ...base, fetchedAtSec });
      } catch {
        if (indexerBaseUrl()) {
          reportIndexerFetchAttempt(false);
        }
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
    let cancelled = false;
    let timeoutId = 0;

    const scheduleLoop = () => {
      timeoutId = window.setTimeout(async () => {
        await loadSnapshot(false);
        if (!cancelled) {
          scheduleLoop();
        }
      }, getIndexerBackoffPollMs(1000));
    };

    void (async () => {
      await loadSnapshot(true);
      if (!cancelled) {
        scheduleLoop();
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [timeCurveAddress, loadSnapshot]);

  useEffect(() => {
    recomputeCountdown();
  }, [heroTimer, recomputeCountdown]);

  useEffect(() => {
    if (!timeCurveAddress) {
      setSecondsRemaining(undefined);
      setChainNowSec(undefined);
      return;
    }
    const id = window.setInterval(recomputeCountdown, 1000);
    return () => window.clearInterval(id);
  }, [timeCurveAddress, recomputeCountdown]);

  return {
    heroTimer,
    secondsRemaining,
    chainNowSec,
    isBusy,
    refresh,
  };
}
