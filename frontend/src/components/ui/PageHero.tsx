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
  /** Omit for default token art; pass `null` to hide the coin. */
  coinSrc?: string | null;
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
  title?: string;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  badgeIconSrc?: string;
};

/** Badge and optional `<h1>`; use alone or above other sections (e.g. arena: badge first, then timer, then `PageHeroArcadeBanner`). */
export function PageHeroHeading({
  title,
  badgeLabel,
  badgeTone = "info",
  badgeIconSrc,
}: PageHeroHeadingProps) {
  return (
    <div className="page-hero__heading">
      {badgeLabel && <PageBadge label={badgeLabel} tone={badgeTone} iconSrc={badgeIconSrc} />}
      {title ? <h1>{title}</h1> : null}
    </div>
  );
}

type PageHeroArcadeBannerProps = {
  className?: string;
  lede?: ReactNode;
  /** Omit for default token art; pass `null` to hide the coin. */
  coinSrc?: string | null;
  coinAlt?: string;
  mascot?: {
    src: string;
    width: number;
    height: number;
    className?: string;
  };
  sceneSrc?: string;
  sceneAlt?: string;
  /** Decorative foreground particles. Use empty alt text; banner content remains the accessible source. */
  particleIcons?: Array<{
    src: string;
    alt?: string;
  }>;
  children?: ReactNode;
};

/**
 * Optional lede, optional scene and coin (omit coin with `coinSrc={null}`), optional mascot, and optional `children` in the action strip
 * (same layout as the lower half of a full `PageHero`).
 */
export function PageHeroArcadeBanner({
  className,
  lede,
  coinSrc,
  coinAlt = "",
  mascot,
  sceneSrc,
  sceneAlt = "",
  particleIcons,
  children,
}: PageHeroArcadeBannerProps) {
  const coinImageSrc = coinSrc === null ? null : (coinSrc ?? "/art/token-logo.png");
  const bannerClasses = ["arcade-banner"];
  if (mascot) bannerClasses.push("arcade-banner--with-sidekick");
  if (sceneSrc) bannerClasses.push("arcade-banner--with-scene");
  if (className) bannerClasses.push(className);
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
      {coinImageSrc != null && (
        <img
          className="arcade-banner__coin"
          src={coinImageSrc}
          alt={coinAlt}
          width={72}
          height={72}
          decoding="async"
        />
      )}
      {lede != null && lede !== "" ? <p className="lede">{lede}</p> : null}
      {particleIcons && particleIcons.length > 0 ? (
        <div className="arcade-banner__particles" aria-hidden="true">
          {particleIcons.map((icon, index) => (
            <img
              className="arcade-banner__particle"
              src={icon.src}
              alt={icon.alt ?? ""}
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              key={`${icon.src}-${index}`}
            />
          ))}
        </div>
      ) : null}
      {children ? <div className="page-hero__actions">{children}</div> : null}
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
  coinSrc,
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
