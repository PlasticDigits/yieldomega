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
    <p className="muted" title="The external venue URL is supplied by this build's Vite env.">
      External link configured.
    </p>
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
        lede="Third-party venue. Verify off-site."
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
        <Link to="/arena" className="btn-secondary">
          Time Arena
        </Link>
        <Link to="/arena/protocol" className="btn-secondary">
          AUDIT
        </Link>
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
          lede={undefined}
        >
          <dl className="kv">
            <dt title="Classified by the route configuration, not by Yield Omega custody.">Venue</dt>
            <dd>{venueKind}</dd>
            <dt title="External market or product surfaced for quick orientation.">Market</dt>
            <dd>{venueDescription}</dd>
            <dt title="Yield Omega does not operate or custody third-party venue flows.">Boundary</dt>
            <dd>External custody and execution</dd>
            <dt title="Live venue reads must be explicitly sourced before this field changes.">Reads</dt>
            <dd>Outbound only</dd>
          </dl>
        </PageSection>
      </div>
      <PageSection
        title="Arena handoff"
        badgeLabel="Canonical"
        badgeTone="warning"
        lede={undefined}
      >
        <ul className="accent-list">
          <li title="TimeArena contracts remain authoritative for CHARM buys, podiums, CRED, and WarBow.">
            Arena contracts remain the source of truth.
          </li>
          <li title="Third-party reads, when added, must stay labeled as external data and never replace onchain authority.">
            Venue reads stay labeled external.
          </li>
        </ul>
      </PageSection>
      {externalUrl && outboundStatus}
      <p className="muted">
        <Link to="/arena">Time Arena</Link> is the canonical DOUB arena surface.
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
