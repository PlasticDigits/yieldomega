// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, type CSSProperties } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import {
  LAUNCH_COUNTDOWN_LINKS,
  LAUNCH_COUNTDOWN_SIGNALS,
} from "@/lib/surfaceContent";
import {
  formatLaunchCountdown,
  timerUrgencyClass,
} from "@/pages/arena/formatTimer";

type Props = {
  secondsRemaining: number;
};

const SPARK_COUNT = 10;

export function LaunchCountdownPage({ secondsRemaining }: Props) {
  const { days, clock } = useMemo(
    () => formatLaunchCountdown(secondsRemaining),
    [secondsRemaining],
  );
  const urgency = timerUrgencyClass(secondsRemaining);
  const isCritical = urgency.includes("critical");

  return (
    <section
      className={`launch-countdown ${urgency}`.trim()}
      data-testid="launch-countdown"
    >
      <img
        className="launch-countdown__scene"
        src="/art/scenes/launch-countdown-command-console.svg"
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
      />
      <div
        className={
          isCritical
            ? "timer-hero__fx-sparks timer-hero__fx-sparks--critical launch-countdown__sparks"
            : "timer-hero__fx-sparks launch-countdown__sparks"
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

      <CutoutDecoration
        className="launch-countdown__cutout launch-countdown__cutout--left cutout-decoration--float"
        src="/art/cutouts/cutout-bunny-girl-full.png"
        width={332}
        height={412}
        loading="eager"
      />
      <CutoutDecoration
        className="launch-countdown__cutout launch-countdown__cutout--right cutout-decoration--bounce"
        src="/art/cutouts/bunny-jump.png"
        width={260}
        height={260}
        loading="eager"
      />

      <div className="launch-countdown__inner">
        <div className="launch-countdown__brand">
          <img
            src="/art/token-logo.png"
            alt=""
            width={72}
            height={72}
            decoding="async"
          />
          <h1 className="launch-countdown__wordmark">Yield Omega</h1>
        </div>

        <p className="launch-countdown__eyebrow">Time Arena opens in</p>

        <div className="launch-countdown__clock" aria-hidden="true">
          {days > 0 && (
            <span className="launch-countdown__days">
              <span className="launch-countdown__days-num">{days}</span>
              <span className="launch-countdown__days-unit">d</span>
            </span>
          )}
          <span className="launch-countdown__digits">{clock}</span>
        </div>
        <p className="launch-countdown__sr" aria-live="polite">
          {days > 0 ? `${days} days ` : ""}
          {clock} remaining until Time Arena opens.
        </p>

        <p
          className="launch-countdown__supporting"
          title="TimeArena is always-live when unpaused; this build gate controls when the frontend routes open."
        >
          PvP console gate. Prepare to play.
        </p>

        <ul className="launch-countdown__signals" aria-label="Countdown handoff mechanics">
          {LAUNCH_COUNTDOWN_SIGNALS.map((signal) => (
            <li key={signal.label} title={signal.tooltip}>
              {signal.label}
            </li>
          ))}
        </ul>

        <nav
          className="launch-countdown__links"
          aria-label="Yield Omega community and documentation"
        >
          <ul className="launch-countdown__links-list">
            {LAUNCH_COUNTDOWN_LINKS.map(({ label, href, tooltip }) => (
              <li key={href}>
                <a
                  className="launch-countdown__link"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tooltip}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <img
          className="launch-countdown__hat-coin hat-coin-hero"
          src="/art/hat-coin-front.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
        />
      </div>
    </section>
  );
}

export default LaunchCountdownPage;
