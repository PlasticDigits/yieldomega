// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { formatCountdown, timerUrgencyClass } from "@/pages/timecurve/formatTimer";

type Props = {
  secondsRemaining: number;
};

const SPARK_COUNT = 14;

const LAUNCH_LINKS = [
  { label: "Telegram", href: "https://t.me/yieldomega" },
  { label: "X.com", href: "https://x.com/yieldomega" },
  {
    label: "Docs",
    href: "https://github.com/PlasticDigits/yieldomega/tree/main/docs",
  },
  {
    label: "Agent Skills",
    href: "https://github.com/PlasticDigits/yieldomega/blob/main/skills/README.md",
  },
] as const;

function formatLaunchCountdown(totalSec: number): { days: number; clock: string } {
  const safe = Math.max(0, Math.floor(totalSec));
  const days = Math.floor(safe / 86400);
  const remainder = safe - days * 86400;
  return { days, clock: formatCountdown(remainder) };
}

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
            style={{ ["--fx-i" as string]: i } as React.CSSProperties}
          />
        ))}
      </div>

      <CutoutDecoration
        className="launch-countdown__cutout launch-countdown__cutout--left cutout-decoration--float"
        src="/art/cutouts/cutout-bunnyleprechaungirl-full.png"
        width={332}
        height={412}
        loading="eager"
      />
      <CutoutDecoration
        className="launch-countdown__cutout launch-countdown__cutout--right cutout-decoration--bounce"
        src="/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png"
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
          <h1 className="launch-countdown__wordmark">YieldOmega</h1>
        </div>

        <p className="launch-countdown__eyebrow">DOUB launches in</p>

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
          {clock} remaining until launch.
        </p>

        <p className="launch-countdown__supporting">
          TimeCurve goes live the moment this hits zero.
        </p>

        <nav
          className="launch-countdown__links"
          aria-label="YieldOmega community and documentation"
        >
          <ul className="launch-countdown__links-list">
            {LAUNCH_LINKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  className="launch-countdown__link"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
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
