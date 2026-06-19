// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from "react";
import {
  formatLaunchCountdown,
  timerUrgencyClass,
} from "@/pages/arena/formatTimer";

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
  /** Adjusts the default spoken label: **open** → “Arena Opens In” ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)). */
  countdownKind?: "open" | "round";
  /** Spoken summary for assistive tech; overrides `countdownKind` + built-in remainder when set. */
  countdownAriaLabel?: string;
  /** When set, shown instead of `—` while `secondsRemaining` is undefined. */
  countdownPlaceholder?: string;
  /** Inline copy shown directly under the countdown digits. */
  foot?: ReactNode;
};

const SPARK_COUNT = 8;

/**
 * Primary command-console countdown used by the BUY timer panel.
 *
 * This is the in-card sibling of the standalone `LaunchCountdownPage` hero —
 * it reuses the shared `formatLaunchCountdown` (so 24h+ durations render as
 * a separate `Nd` chip + `HH:MM:SS` clock instead of an awkward `48:13:07`),
 * the same `.timer-hero__fx-spark*` keyframes, and the same warning /
 * critical urgency states (yellow glow, red glow + pulse). Visual styling is
 * scoped to `.arena-simple__timer-hero*` so the component can sit inside
 * a `data-panel--spotlight` `PageSection` without leaking outwards.
 *
 * Why a dedicated component (and not just inline JSX in `ArenaSimplePage`):
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
 * (see `useArenaSaleSession`).
 */
export function ArenaTimerHero({
  secondsRemaining,
  eyebrow,
  countdownKind = "round",
  countdownAriaLabel,
  countdownPlaceholder,
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
        ? `Arena Opens In, ${spokenRemaining}`
        : `Time remaining, ${spokenRemaining}`;

  return (
    <div
      className={`timer-hero arena-simple__timer-hero ${urgency}`.trim()}
      aria-label={countdownAriaLabel ?? defaultAria}
      aria-live="polite"
      data-testid="arena-simple-timer-hero"
    >
      {/* Backplate scene: low-opacity command-console wash.
          Decorative only; alt text is empty + aria-hidden so screen readers
          skip straight to the countdown text below. */}
      <img
        className="arena-simple__timer-hero-scene"
        src="/art/scenes/arena-simple-command-console.svg"
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
            ? "timer-hero__fx-sparks timer-hero__fx-sparks--critical arena-simple__timer-hero-sparks"
            : "timer-hero__fx-sparks arena-simple__timer-hero-sparks"
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

      <div className="arena-simple__timer-hero-inner">
        {eyebrow !== undefined && eyebrow !== "" ? (
          <p className="arena-simple__timer-hero-eyebrow muted">{eyebrow}</p>
        ) : null}
        <div
          className="arena-simple__timer-clock"
          data-testid="arena-simple-timer"
        >
          {split === null ? (
            <span className="arena-simple__timer-digits">{countdownPlaceholder ?? "—"}</span>
          ) : (
            <>
              {split.days > 0 && (
                <span
                  className="arena-simple__timer-days"
                  data-testid="arena-simple-timer-days"
                >
                  <span className="arena-simple__timer-days-num">
                    {split.days}
                  </span>
                  <span className="arena-simple__timer-days-unit">d</span>
                </span>
              )}
              <span
                className="arena-simple__timer-digits"
                data-testid="arena-simple-timer-digits"
              >
                {split.clock}
              </span>
            </>
          )}
        </div>
        {foot && (
          <p className="arena-simple__timer-hero-foot muted">{foot}</p>
        )}
      </div>
    </div>
  );
}

export default ArenaTimerHero;
