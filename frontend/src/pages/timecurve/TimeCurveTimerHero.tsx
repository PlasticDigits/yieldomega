// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from "react";
import {
  formatLaunchCountdown,
  timerUrgencyClass,
} from "@/pages/timecurve/formatTimer";

type Props = {
  /**
   * Whole seconds remaining until the relevant deadline.
   *
   * `undefined` is rendered as a placeholder (`—`) so the component renders
   * cleanly during the loading phase before the contract reads land.
   */
  secondsRemaining: number | undefined;
  /** Line above the digits (e.g. extra emphasis); section titles often carry the primary label. */
  eyebrow?: string;
  /** Adjusts the default spoken label: **open** → “TimeCurve Opens In” ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)). */
  countdownKind?: "open" | "round";
  /** Spoken summary for assistive tech; overrides `countdownKind` + built-in remainder when set. */
  countdownAriaLabel?: string;
  /** Inline copy shown directly under the countdown digits. */
  foot?: ReactNode;
};

const SPARK_COUNT = 8;

/**
 * Big arcade-style countdown used by the Simple-view timer panel.
 *
 * This is the in-card sibling of the standalone `LaunchCountdownPage` hero —
 * it reuses the shared `formatLaunchCountdown` (so 24h+ durations render as
 * a separate `Nd` chip + `HH:MM:SS` clock instead of an awkward `48:13:07`),
 * the same `.timer-hero__fx-spark*` keyframes, and the same warning /
 * critical urgency states (yellow glow, red glow + pulse). Visual styling is
 * scoped to `.timecurve-simple__timer-hero*` so the component can sit inside
 * a `data-panel--spotlight` `PageSection` without leaking outwards.
 *
 * Why a dedicated component (and not just inline JSX in `TimeCurveSimplePage`):
 *
 * - The countdown is the **single most-glanced** element on the page; keeping
 *   its presentation in one place makes design iteration cheap.
 * - The launch-countdown view and the in-card timer must stay visually in
 *   sync (same digit rhythm, same urgency colours, same days chip). One
 *   component (this) + one helper (`formatLaunchCountdown`) keeps that
 *   contract from drifting per design pass.
 *
 * The component is presentation-only — it never reads chain state. The owner
 * page is responsible for clamping `secondsRemaining` against chain head time
 * (see `useTimeCurveSaleSession`).
 */
export function TimeCurveTimerHero({
  secondsRemaining,
  eyebrow,
  countdownKind = "round",
  countdownAriaLabel,
  foot,
}: Props) {
  const urgency = timerUrgencyClass(secondsRemaining);
  const isCritical = urgency.includes("critical");
  const split =
    secondsRemaining !== undefined ? formatLaunchCountdown(secondsRemaining) : null;
  const spokenRemaining =
    secondsRemaining !== undefined
      ? split && split.days > 0
        ? `${split.days} days ${split.clock}`
        : split?.clock ?? ""
      : "loading";
  const defaultAria =
    eyebrow !== undefined && eyebrow !== ""
      ? `${eyebrow}, ${spokenRemaining}`
      : countdownKind === "open"
        ? `TimeCurve Opens In, ${spokenRemaining}`
        : `Time remaining, ${spokenRemaining}`;

  return (
    <div
      className={`timer-hero timecurve-simple__timer-hero ${urgency}`.trim()}
      aria-label={countdownAriaLabel ?? defaultAria}
      aria-live="polite"
      data-testid="timecurve-simple-timer-hero"
    >
      {/* Backplate scene — low-opacity wash of the Simple-view hero art.
          Decorative only; alt text is empty + aria-hidden so screen readers
          skip straight to the countdown text below. */}
      <img
        className="timecurve-simple__timer-hero-scene"
        src="/art/scenes/timecurve-simple.jpg"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
      />

      {/* Sparks rise from the bottom edge — same keyframes as the standalone
          launch-countdown sparks. `--fx-i` staggers each spark's start so
          they don't pulse in lockstep. The critical variant swaps to a fast,
          red, larger spark. */}
      <div
        className={
          isCritical
            ? "timer-hero__fx-sparks timer-hero__fx-sparks--critical timecurve-simple__timer-hero-sparks"
            : "timer-hero__fx-sparks timecurve-simple__timer-hero-sparks"
        }
        aria-hidden="true"
      >
        {Array.from({ length: SPARK_COUNT }).map((_, i) => (
          <span
            key={i}
            className="timer-hero__fx-spark"
            style={{ ["--fx-i" as string]: i } as CSSProperties}
          />
        ))}
      </div>

      <div className="timecurve-simple__timer-hero-inner">
        {eyebrow !== undefined && eyebrow !== "" ? (
          <p className="timecurve-simple__timer-hero-eyebrow muted">{eyebrow}</p>
        ) : null}
        <div
          className="timecurve-simple__timer-clock"
          data-testid="timecurve-simple-timer"
        >
          {split === null ? (
            <span className="timecurve-simple__timer-digits">—</span>
          ) : (
            <>
              {split.days > 0 && (
                <span
                  className="timecurve-simple__timer-days"
                  data-testid="timecurve-simple-timer-days"
                >
                  <span className="timecurve-simple__timer-days-num">
                    {split.days}
                  </span>
                  <span className="timecurve-simple__timer-days-unit">d</span>
                </span>
              )}
              <span
                className="timecurve-simple__timer-digits"
                data-testid="timecurve-simple-timer-digits"
              >
                {split.clock}
              </span>
            </>
          )}
        </div>
        {foot && (
          <p className="timecurve-simple__timer-hero-foot muted">{foot}</p>
        )}
      </div>
    </div>
  );
}

export default TimeCurveTimerHero;
