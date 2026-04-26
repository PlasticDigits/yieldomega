// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import { playGameSfx } from "@/audio/playGameSfx";
import { resolveArenaHeroCountdownSecondSfx } from "@/pages/timeCurveArena/arenaHeroCountdownSecondSfx";

const GAIN_CALM = 0.36;
const GAIN_URGENT = 0.42;

/**
 * Arena hero `timer-hero__countdown`: one SFX each time remaining seconds drop
 * while under two minutes; switches to the urgent asset for the last 30s.
 */
export function useArenaHeroCountdownSecondSfx(opts: {
  saleActive: boolean;
  secondsRemaining: number | undefined;
  reduceMotion: boolean;
}): void {
  const { saleActive, secondsRemaining, reduceMotion } = opts;
  const prevSec = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!saleActive || reduceMotion) {
      prevSec.current = undefined;
      return;
    }
    const r = secondsRemaining;
    if (r === undefined || r <= 0) {
      prevSec.current = r;
      return;
    }
    const p = prevSec.current;
    prevSec.current = r;
    const kind = resolveArenaHeroCountdownSecondSfx({
      prevRemainingSec: p,
      nextRemainingSec: r,
      saleActive,
      reduceMotion,
    });
    if (kind === "urgent") void playGameSfx("timer_heartbeat_urgent", { gainMul: GAIN_URGENT });
    else if (kind === "calm") void playGameSfx("timer_heartbeat_calm", { gainMul: GAIN_CALM });
  }, [saleActive, secondsRemaining, reduceMotion]);
}
