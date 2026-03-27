import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

type Cta = {
  to: string;
  title: string;
  blurb: string;
  image: string;
  badge: "live" | "soon";
  imageAlt: string;
};

const CTAS: Cta[] = [
  {
    to: "/timecurve",
    title: "TimeCurve",
    blurb: "DOUB sale, timer, charms, and prizes — the active launch surface.",
    image: "/art/hero-home.jpg",
    badge: "live",
    imageAlt: "Arcade fantasy scene with mascots and coins",
  },
  {
    to: "/rabbit-treasury",
    title: "Rabbit Treasury",
    blurb: "Burrow deposits and epochs — wiring returns after devnet E2E.",
    image: "/art/rabbit-treasury-card.jpg",
    badge: "soon",
    imageAlt: "Rabbit Treasury feature illustration",
  },
  {
    to: "/collection",
    title: "Collection",
    blurb: "Leprechaun NFTs, traits, and indexer-backed mint history.",
    image: "/art/collection-card.jpg",
    badge: "soon",
    imageAlt: "Collection feature illustration with mascot roster",
  },
  {
    to: "/referrals",
    title: "Referrals",
    blurb: "Share links and track referral-weighted buys.",
    image: "/art/referrals-card.jpg",
    badge: "soon",
    imageAlt: "Referral rewards feature illustration",
  },
  {
    to: "/kumbaya",
    title: "Kumbaya",
    blurb: "Third-party spot DEX snapshot + outbound link when configured.",
    image: "/art/kumbaya-card.jpg",
    badge: "soon",
    imageAlt: "Kumbaya liquidity feature illustration",
  },
  {
    to: "/sir",
    title: "Sir",
    blurb: "Third-party perps DEX snapshot + outbound link when configured.",
    image: "/art/sir-card.jpg",
    badge: "soon",
    imageAlt: "Sir trading arena feature illustration",
  },
];

export function HomePage() {
  return (
    <section className="page page--home">
      <div className="home-hero">
        <img
          className="home-hero__art"
          src="/art/hero-home-wide.jpg"
          alt="YieldOmega blocky arcade fantasy heroes, rainbow, and hat-token coins"
          width={1600}
          height={900}
          decoding="async"
        />
        <div className="home-hero__overlay">
          <h1>YieldOmega</h1>
          <p className="lede">
            This milestone is the <strong>TimeCurve Doubloon (DOUB)</strong> launch — charms, timer,
            and prizes per onchain rules. Connect a wallet and jump in.
          </p>
          <div className="home-hero__actions">
            <Link to="/timecurve" className="btn-primary btn-primary--xl">
              Open TimeCurve
            </Link>
            <img
              className="hat-coin-hero"
              src="/art/hat-coin-front.png"
              alt=""
              width={64}
              height={64}
              decoding="async"
            />
          </div>
        </div>
      </div>

      <h2 className="visually-hidden">Where to go</h2>
      <ul className="home-cta-grid">
        {CTAS.map((c) => (
          <li key={c.to}>
            <Link to={c.to} className="home-cta-card">
              <div className="home-cta-card__media">
                <img src={c.image} alt={c.imageAlt} width={320} height={240} loading="lazy" />
              </div>
              <span
                className={
                  c.badge === "live"
                    ? "home-cta-card__badge home-cta-card__badge--live"
                    : "home-cta-card__badge home-cta-card__badge--soon"
                }
              >
                {c.badge === "live" ? "Live" : "Soon"}
              </span>
              <h3 className="home-cta-card__title">{c.title}</h3>
              <p className="home-cta-card__blurb">{c.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
