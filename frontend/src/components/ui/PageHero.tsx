// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageBadge, type PageBadgeTone } from "@/components/ui/PageBadge";

type Props = {
  title: string;
  lede: ReactNode;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  coinSrc?: string;
  coinAlt?: string;
  mascot?: {
    src: string;
    width: number;
    height: number;
    className?: string;
  };
  children?: ReactNode;
};

export function PageHero({
  title,
  lede,
  badgeLabel,
  badgeTone = "info",
  coinSrc = "/art/token-logo.png",
  coinAlt = "",
  mascot,
  children,
}: Props) {
  return (
    <header className="page-hero">
      <div className="page-hero__heading">
        {badgeLabel && <PageBadge label={badgeLabel} tone={badgeTone} />}
        <h1>{title}</h1>
      </div>
      <div className="arcade-banner arcade-banner--with-sidekick">
        <img
          className="arcade-banner__coin"
          src={coinSrc}
          alt={coinAlt}
          width={72}
          height={72}
          decoding="async"
        />
        <div className="arcade-banner__text">
          <p className="lede">{lede}</p>
          {children && <div className="page-hero__actions">{children}</div>}
        </div>
        {mascot && (
          <CutoutDecoration
            className={["arcade-banner__mascot", mascot.className].filter(Boolean).join(" ")}
            src={mascot.src}
            width={mascot.width}
            height={mascot.height}
          />
        )}
      </div>
    </header>
  );
}
