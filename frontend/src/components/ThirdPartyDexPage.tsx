import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  heroImage: string;
  /** Shown in the LP panel (e.g. spot pair vs perps product). */
  venueDescription: string;
  externalUrl: string | undefined;
  linkLabel: string;
  /** Shown when `externalUrl` is unset (must match Vite env name). */
  envVarName: "VITE_KUMBAYA_DEX_URL" | "VITE_SIR_DEX_URL";
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
}: Props) {
  return (
    <section className="page page--placeholder" data-testid={`third-party-dex-${slug}`}>
      <h1>{title}</h1>
      <div className="arcade-banner">
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
            {title} is a <strong>third-party</strong> decentralized exchange. YieldOmega does not
            operate or custody this venue; this page surfaces DOUB-related liquidity for convenience.
          </p>
        </div>
      </div>
      <div className="placeholder-figure placeholder-figure--wide">
        <img src={heroImage} alt="" width={768} height={512} loading="lazy" decoding="async" />
      </div>
      <div className="data-panel">
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
    </section>
  );
}
