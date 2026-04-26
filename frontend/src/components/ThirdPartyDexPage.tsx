import { Link } from "react-router-dom";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { THIRD_PARTY_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  heroImage: string;
  /** Intrinsic pixel size of `heroImage` (layout hint / CLS). */
  heroImageWidth?: number;
  heroImageHeight?: number;
  /** Shown in the LP panel (e.g. spot pair vs derivatives venue). */
  venueDescription: string;
  externalUrl: string | undefined;
  linkLabel: string;
  /** Shown when `externalUrl` is unset (must match Vite env name). */
  envVarName: "VITE_KUMBAYA_DEX_URL" | "VITE_SIR_DEX_URL";
  /** Noun phrase after "third-party" in the lede (e.g. spot DEX vs leverage venue). */
  venueKind?: string;
};

/** Third-party DEX: disclaimer, placeholder LP readout, outbound link. */
export function ThirdPartyDexPage({
  title,
  slug,
  heroImage,
  heroImageWidth = 768,
  heroImageHeight = 512,
  venueDescription,
  externalUrl,
  linkLabel,
  envVarName,
  venueKind = "decentralized exchange",
}: Props) {
  const cutouts = THIRD_PARTY_CUTOUTS_BY_SLUG[slug as keyof typeof THIRD_PARTY_CUTOUTS_BY_SLUG]
    ?? THIRD_PARTY_CUTOUTS_BY_SLUG.kumbaya;
  const outboundStatus = externalUrl ? (
    <p className="muted">Outbound link configured for this build.</p>
  ) : (
    <StatusMessage variant="muted">
      Set <code>{envVarName}</code> at build time to add the outbound venue link.
    </StatusMessage>
  );

  return (
    <section className="page page--placeholder" data-testid={`third-party-dex-${slug}`}>
      <PageHero
        title={title}
        badgeLabel="External venue"
        badgeTone="external"
        coinSrc="/art/hat-coin-stack.png"
        lede={
          <>
            {title} is a <strong>third-party</strong> {venueKind}. YieldOmega does not operate or
            custody this venue; this page keeps the art direction, hierarchy, and warnings aligned while pointing
            to the external market.
          </>
        }
        mascot={{
          src: cutouts.banner,
          width: 208,
          height: 208,
          className: "cutout-decoration--sway",
        }}
      >
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary cursor-external-link"
          >
            {linkLabel}
          </a>
        ) : (
          outboundStatus
        )}
      </PageHero>
      <div className="split-layout">
        <div className="placeholder-figure placeholder-figure--wide">
          <img
            src={heroImage}
            alt=""
            width={heroImageWidth}
            height={heroImageHeight}
            loading="lazy"
            decoding="async"
          />
        </div>
        <PageSection
          title="Venue Snapshot"
          badgeLabel="Read-only framing"
          badgeTone="info"
          spotlight
          cutout={{
            src: cutouts.panel,
            width: 248,
            height: 248,
            className: "panel-cutout panel-cutout--lower-right cutout-decoration--float",
          }}
          lede="This stays intentionally light until we wire a trustworthy onchain or venue-backed readout."
        >
          <dl className="kv">
            <dt>Venue type</dt>
            <dd>{venueKind}</dd>
            <dt>Pair / product</dt>
            <dd>{venueDescription}</dd>
            <dt>Status</dt>
            <dd>Outbound route ready, live depth readout not wired yet</dd>
            <dt>Trust boundary</dt>
            <dd>Third-party venue, linked from YieldOmega for convenience only</dd>
          </dl>
        </PageSection>
      </div>
      <PageSection
        title="How to read this page"
        badgeLabel="Clarity first"
        badgeTone="warning"
        lede="The goal is integration without pretending this venue is part of YieldOmega's authoritative onchain surface."
      >
        <ul className="accent-list">
          <li>Use this page to understand where DOUB liquidity or leverage may live, then jump out to the venue itself.</li>
          <li>TimeCurve remains the canonical launch surface for the sale, charms, podiums, and WarBow competition.</li>
          <li>When live venue reads are added, they should remain clearly marked as third-party data and never replace contract authority.</li>
        </ul>
      </PageSection>
      {externalUrl && outboundStatus}
      <p className="muted">
        <Link to="/timecurve">TimeCurve</Link> is the canonical DOUB launch surface.
      </p>
      <div className="third-party-cutout-row" aria-hidden="true">
        <CutoutDecoration
          className="third-party-cutout-row__item cutout-decoration--bob"
          src={cutouts.footer}
          width={148}
          height={148}
        />
      </div>
    </section>
  );
}
