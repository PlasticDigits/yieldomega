// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageBadge, type PageBadgeTone } from "@/components/ui/PageBadge";

type Props = {
  title: string;
  lede: ReactNode;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  /**
   * Optional issue-#45 status pictogram for the hero badge. Forwarded to
   * `PageBadge` so the badge stays the visible source of truth (icon is
   * `aria-hidden`). See [`frontend/public/art/icons/`](../../../public/art/icons/).
   */
  badgeIconSrc?: string;
  coinSrc?: string;
  coinAlt?: string;
  mascot?: {
    src: string;
    width: number;
    height: number;
    className?: string;
  };
  /**
   * Optional issue-#45 wide JPG scene used as a soft backplate for the hero
   * banner. See [`frontend/public/art/scenes/`](../../../public/art/scenes/)
   * and the asset map in [`frontend/public/art/README.md`](../../../public/art/README.md).
   * Pages opt-in (e.g. TimeCurve Simple uses
   * `/art/scenes/timecurve-simple.jpg`); cards remain crisp via the
   * `arcade-banner--with-scene` overlay defined in `index.css`.
   */
  sceneSrc?: string;
  sceneAlt?: string;
  children?: ReactNode;
};

export type PageHeroHeadingProps = {
  title: string;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  badgeIconSrc?: string;
};

/** Badge + `<h1>`; use alone or above other sections (e.g. arena: heading first, then timer, then `PageHeroArcadeBanner`). */
export function PageHeroHeading({
  title,
  badgeLabel,
  badgeTone = "info",
  badgeIconSrc,
}: PageHeroHeadingProps) {
  return (
    <div className="page-hero__heading">
      {badgeLabel && <PageBadge label={badgeLabel} tone={badgeTone} iconSrc={badgeIconSrc} />}
      <h1>{title}</h1>
    </div>
  );
}

type PageHeroArcadeBannerProps = {
  lede: ReactNode;
  coinSrc?: string;
  coinAlt?: string;
  mascot?: {
    src: string;
    width: number;
    height: number;
    className?: string;
  };
  sceneSrc?: string;
  sceneAlt?: string;
  children?: ReactNode;
};

/**
 * Lede, optional scene/coin/mascot, and optional `children` in the action strip
 * (same layout as the lower half of a full `PageHero`).
 */
export function PageHeroArcadeBanner({
  lede,
  coinSrc = "/art/token-logo.png",
  coinAlt = "",
  mascot,
  sceneSrc,
  sceneAlt = "",
  children,
}: PageHeroArcadeBannerProps) {
  const bannerClasses = ["arcade-banner", "arcade-banner--with-sidekick"];
  if (sceneSrc) bannerClasses.push("arcade-banner--with-scene");
  const bannerStyle: CSSProperties | undefined = sceneSrc
    ? ({ ["--scene-image" as string]: `url(${sceneSrc})` } as CSSProperties)
    : undefined;
  return (
    <div className={bannerClasses.join(" ")} style={bannerStyle}>
      {sceneSrc && (
        <img
          className="arcade-banner__scene"
          src={sceneSrc}
          alt={sceneAlt}
          aria-hidden={sceneAlt ? undefined : true}
          loading="lazy"
          decoding="async"
        />
      )}
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
  );
}

export function PageHero({
  title,
  lede,
  badgeLabel,
  badgeTone = "info",
  badgeIconSrc,
  coinSrc = "/art/token-logo.png",
  coinAlt = "",
  mascot,
  sceneSrc,
  sceneAlt = "",
  children,
}: Props) {
  return (
    <header className="page-hero">
      <PageHeroHeading
        title={title}
        badgeLabel={badgeLabel}
        badgeTone={badgeTone}
        badgeIconSrc={badgeIconSrc}
      />
      <PageHeroArcadeBanner
        lede={lede}
        coinSrc={coinSrc}
        coinAlt={coinAlt}
        mascot={mascot}
        sceneSrc={sceneSrc}
        sceneAlt={sceneAlt}
      >
        {children}
      </PageHeroArcadeBanner>
    </header>
  );
}
