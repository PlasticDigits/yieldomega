import { Link } from "react-router-dom";
import { CutoutDecoration } from "@/components/CutoutDecoration";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  heroImage: string;
  /** Shown in the LP panel (e.g. spot pair vs derivatives venue). */
  venueDescription: string;
  externalUrl: string | undefined;
  linkLabel: string;
  /** Shown when `externalUrl` is unset (must match Vite env name). */
  envVarName: "VITE_KUMBAYA_DEX_URL" | "VITE_SIR_DEX_URL";
  /** Noun phrase after "third-party" in the lede (e.g. spot DEX vs leverage venue). */
  venueKind?: string;
};

const CUTOUTS_BY_SLUG: Record<
  string,
  {
    banner: string;
    panel: string;
    footer: string;
  }
> = {
  kumbaya: {
    banner: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    panel: "/art/cutouts/mascot-bunnyleprechaungirl-wave-cutout.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
  sir: {
    banner: "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png",
    panel: "/art/cutouts/cutout-bunnyleprechaungirl-full.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
};

/** Third-party DEX: disclaimer, placeholder LP readout, outbound link. */
export function ThirdPartyDexPage({
  title,
  slug,
  heroImage,
  venueDescription,
  externalUrl,
  linkLabel,
  envVarName,
  venueKind = "decentralized exchange",
}: Props) {
  const cutouts = CUTOUTS_BY_SLUG[slug] ?? CUTOUTS_BY_SLUG.kumbaya;

  return (
    <section className="page page--placeholder" data-testid={`third-party-dex-${slug}`}>
      <h1>{title}</h1>
      <div className="arcade-banner arcade-banner--with-sidekick">
        <img
          className="arcade-banner__coin"
          src="/art/hat-coin-stack.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
        />
        <div className="arcade-banner__text">
          <p className="lede">
            {title} is a <strong>third-party</strong> {venueKind}. YieldOmega does not
            operate or custody this venue; this page surfaces DOUB-related liquidity for convenience.
          </p>
        </div>
        <CutoutDecoration
          className="arcade-banner__mascot cutout-decoration--sway"
          src={cutouts.banner}
          width={208}
          height={208}
        />
      </div>
      <div className="placeholder-figure placeholder-figure--wide">
        <img src={heroImage} alt="" width={768} height={512} loading="lazy" decoding="async" />
      </div>
      <div className="data-panel data-panel--spotlight">
        <CutoutDecoration
          className="panel-cutout panel-cutout--lower-right cutout-decoration--float"
          src={cutouts.panel}
          width={248}
          height={248}
        />
        <h2>Liquidity (placeholder)</h2>
        <dl className="kv">
          <dt>Pair / product</dt>
          <dd>{venueDescription}</dd>
          <dt>LP reported</dt>
          <dd>—</dd>
          <dt>Note</dt>
          <dd>
            <span className="muted">
              On-chain or DEX API readout TBD; values are not live yet.
            </span>
          </dd>
        </dl>
      </div>
      {externalUrl ? (
        <p>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wallet-action wallet-action--connect"
          >
            {linkLabel}
          </a>
        </p>
      ) : (
        <p className="muted">
          Set <code>{envVarName}</code> at build time to add an outbound link to this DEX.
        </p>
      )}
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
