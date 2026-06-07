import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageBadge } from "@/components/ui/PageBadge";
import { HOME_HERO_SIGNALS, HOME_SURFACE_CARDS } from "@/lib/surfaceContent";

// SPDX-License-Identifier: AGPL-3.0-only

export function HomePage() {
  const prefersReducedMotion = useReducedMotion();
  const ctaMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.03, y: -2 },
        whileTap: { scale: 0.98, y: 1 },
      };

  const cardMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -6, scale: 1.015, rotate: -0.4 },
        whileTap: { y: -1, scale: 0.99 },
      };

  return (
    <section className="page page--home yga-secondary-page">
      <div className="home-hero">
        <picture className="home-hero__picture">
          <source
            media="(max-width: 720px)"
            srcSet="/art/scenes/home-command-console.svg"
          />
          <img
            className="home-hero__art"
            src="/art/scenes/home-command-console.svg"
            alt="Yield Omega Time Arena operators and token coins in a dark command console"
            width={1600}
            height={900}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <CutoutDecoration
          className="home-hero__cutout home-hero__cutout--peek cutout-decoration--hoverable cutout-decoration--bob"
          src="/art/cutouts/cutout-bunny-girl-head.png"
          width={184}
          height={184}
          loading="eager"
        />
        <CutoutDecoration
          className="home-hero__cutout home-hero__cutout--heroine cutout-decoration--hoverable cutout-decoration--float"
          src="/art/cutouts/cutout-bunny-girl-full.png"
          width={332}
          height={412}
          loading="eager"
        />
        <div className="home-hero__overlay">
          <h1>Yield Omega</h1>
          <p className="lede">Buy CHARM. Move timers. Take the podium.</p>
          <ul className="home-hero__signals" aria-label="Time Arena mechanics">
            {HOME_HERO_SIGNALS.map((signal) => (
              <li key={signal.label} title={signal.tooltip}>
                {signal.label}
              </li>
            ))}
          </ul>
          <div className="home-hero__actions">
            <motion.div className="home-hero__cta-wrap" {...ctaMotion}>
              <Link to="/arena" className="btn-primary btn-primary--xl btn-primary--priority">
                PLAY TIME ARENA
              </Link>
            </motion.div>
            <Link
              to="/arena/protocol"
              className="btn-secondary home-hero__secondary"
              title="Open the AUDIT console for TimeArena state, vault routing, and indexed activity."
            >
              AUDIT
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
        {HOME_SURFACE_CARDS.map((c, index) => (
          <motion.li
            key={c.to}
            className="home-cta-grid__item"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.28, delay: index * 0.04 }}
            {...cardMotion}
          >
            <Link to={c.to} className="home-cta-card" title={c.tooltip}>
              <div className="home-cta-card__media">
                <img
                  src={c.image}
                  alt={c.imageAlt}
                  width={c.imageWidth ?? 320}
                  height={c.imageHeight ?? 240}
                  loading="lazy"
                />
              </div>
              <PageBadge
                label={c.badgeLabel}
                tone={c.badgeTone}
                className="home-cta-card__badge"
              />
              <h3 className="home-cta-card__title">{c.title}</h3>
              <p className="home-cta-card__blurb">{c.blurb}</p>
            </Link>
          </motion.li>
        ))}
      </ul>
      <div className="home-cutout-strip" aria-hidden="true">
        <CutoutDecoration
          className="home-cutout-strip__cutout home-cutout-strip__cutout--left cutout-decoration--sway"
          src="/art/cutouts/mascot-bunny-girl-wave-cutout.png"
          width={260}
          height={260}
        />
        <CutoutDecoration
          className="home-cutout-strip__cutout home-cutout-strip__cutout--right cutout-decoration--bounce"
          src="/art/cutouts/mascot-bunny-girl-jump-cutout.png"
          width={260}
          height={260}
        />
      </div>
    </section>
  );
}
