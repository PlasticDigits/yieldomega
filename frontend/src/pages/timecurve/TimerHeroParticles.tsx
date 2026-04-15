// SPDX-License-Identifier: AGPL-3.0-only

import confetti from "canvas-confetti";
import { useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { BuyItem } from "@/lib/indexerApi";

type TimerTone = "calm" | "warning" | "critical";

const GOLD = ["#fde68a", "#f5c842", "#fffef5"];
const GREEN_GOLD = ["#1fb86a", "#5ee89a", "#fde68a", "#ffffff"];
const HEAT = ["#f97316", "#fde68a", "#ef4444", "#fca5a5"];

function parseSecondsAdded(raw: string | undefined): bigint | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  try {
    return BigInt(raw.trim());
  } catch {
    return null;
  }
}

type Props = {
  saleActive: boolean;
  remainingSec: number | undefined;
  timerTone: TimerTone;
  buys: BuyItem[] | null;
};

export function TimerHeroParticles({ saleActive, remainingSec, timerTone, buys }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<ReturnType<typeof confetti.create> | null>(null);
  const prevRemainingRef = useRef<number | undefined>(undefined);
  const prevTopBuyKeyRef = useRef<string | null>(null);
  const lastBurstMsRef = useRef(0);

  const fire = useCallback((opts: confetti.Options) => {
    apiRef.current?.({ disableForReducedMotion: true, ...opts });
  }, []);

  const burst = useCallback(
    (fn: () => void) => {
      if (prefersReducedMotion) {
        return;
      }
      const now = Date.now();
      if (now - lastBurstMsRef.current < 450) {
        return;
      }
      lastBurstMsRef.current = now;
      fn();
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    apiRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });
  }, []);

  /** Large timer extension / hard reset toward ~15m */
  useEffect(() => {
    if (!saleActive || remainingSec === undefined) {
      prevRemainingRef.current = remainingSec;
      return;
    }
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remainingSec;
    if (prev === undefined) {
      return;
    }
    const delta = remainingSec - prev;
    if (delta > 120) {
      burst(() => {
        fire({
          particleCount: 160,
          spread: 88,
          startVelocity: 38,
          ticks: 320,
          scalar: 1.05,
          colors: GREEN_GOLD,
          origin: { x: 0.5, y: 0.42 },
        });
        fire({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.65 },
          colors: GOLD,
        });
        fire({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.65 },
          colors: GOLD,
        });
      });
    }
  }, [remainingSec, saleActive, burst, fire]);

  /** New indexed buy: hard reset vs small timer add (+2s style) */
  useEffect(() => {
    if (!saleActive || !buys?.length) {
      return;
    }
    const top = buys[0];
    const key = `${top.tx_hash}-${top.log_index}`;
    if (prevTopBuyKeyRef.current === null) {
      prevTopBuyKeyRef.current = key;
      return;
    }
    if (key === prevTopBuyKeyRef.current) {
      return;
    }
    prevTopBuyKeyRef.current = key;

    if (top.timer_hard_reset === true) {
      burst(() => {
        fire({
          particleCount: 140,
          spread: 80,
          ticks: 300,
          colors: GREEN_GOLD,
          origin: { x: 0.5, y: 0.38 },
        });
      });
      return;
    }

    const sec = parseSecondsAdded(top.actual_seconds_added);
    if (sec === null || sec <= 0n) {
      return;
    }

    if (sec <= 5n) {
      burst(() => {
        fire({
          particleCount: sec <= 2n ? 22 : 38,
          spread: 58,
          startVelocity: 22,
          ticks: 180,
          scalar: 0.75,
          colors: GOLD,
          origin: { x: 0.18, y: 0.55 },
        });
      });
      return;
    }

    if (sec <= 35n) {
      burst(() => {
        fire({
          particleCount: 55,
          spread: 64,
          ticks: 220,
          colors: GREEN_GOLD,
          origin: { x: 0.22, y: 0.52 },
        });
      });
    }
  }, [buys, saleActive, burst, fire]);

  /** Ambient sparks while “Race is heating up” / clutch — stronger near 0 */
  useEffect(() => {
    if (prefersReducedMotion || !saleActive) {
      return;
    }
    if (timerTone === "calm") {
      return;
    }
    const isCritical = timerTone === "critical";
    const tick = () => {
      const x = 0.35 + Math.random() * 0.3;
      if (isCritical) {
        fire({
          particleCount: 14,
          spread: 70,
          startVelocity: 32,
          ticks: 120,
          gravity: 0.65,
          colors: HEAT,
          origin: { x, y: 0.08 + Math.random() * 0.06 },
        });
      } else {
        fire({
          particleCount: 7,
          spread: 48,
          startVelocity: 18,
          ticks: 100,
          gravity: 0.55,
          colors: GOLD,
          origin: { x: 0.25 + Math.random() * 0.5, y: 0.12 },
        });
      }
    };
    const ms = isCritical ? 1100 : 2400;
    const id = window.setInterval(tick, ms);
    tick();
    return () => window.clearInterval(id);
  }, [timerTone, saleActive, prefersReducedMotion, fire]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="timer-hero__fx-canvas"
        aria-hidden
      />
      {saleActive && (
        <div className={`timer-hero__fx-sparks timer-hero__fx-sparks--${timerTone}`} aria-hidden>
          {Array.from({ length: timerTone === "critical" ? 18 : timerTone === "warning" ? 12 : 0 }, (_, i) => (
            <span
              key={i}
              className="timer-hero__fx-spark"
              style={{ "--fx-i": i } as CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}
