import { Link } from "react-router-dom";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  imageSrc?: string;
  children: React.ReactNode;
};

/** Placeholder surface while TimeCurve is the active launch milestone. */
export function UnderConstruction({ title, slug, imageSrc = "/art/mascot-bunny-leprechaun-wave.png", children }: Props) {
  const cutouts = PLACEHOLDER_CUTOUTS_BY_SLUG[slug as keyof typeof PLACEHOLDER_CUTOUTS_BY_SLUG]
    ?? PLACEHOLDER_CUTOUTS_BY_SLUG.collection;

  return (
    <section className="page page--placeholder" data-testid={`under-construction-${slug}`}>
      <div className="placeholder-cutout-layer" aria-hidden="true">
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--left cutout-decoration--float"
          src={cutouts.primary}
          width={300}
          height={320}
        />
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--right cutout-decoration--peek"
          src={cutouts.secondary}
          width={208}
          height={208}
        />
        <CutoutDecoration
          className="placeholder-cutout placeholder-cutout--orbit cutout-decoration--bob"
          src={cutouts.tertiary}
          width={144}
          height={144}
        />
      </div>
      <PageHero
        title={title}
        badgeLabel="Coming soon"
        badgeTone="soon"
        coinSrc="/art/hat-coin-stack.png"
        lede={
          <>
            {children} This route now uses the same YieldOmega shell, spacing, and mascot system as the live app so
            it reads like part of one product instead of a generic stub.
          </>
        }
        mascot={{
          src: cutouts.secondary,
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      >
        <Link to="/timecurve" className="btn-primary">
          Open TimeCurve
        </Link>
      </PageHero>
      <div className="split-layout">
        <div className="placeholder-figure">
          <img
            src={imageSrc}
            alt=""
            width={512}
            height={640}
            loading="lazy"
            decoding="async"
          />
        </div>
        <PageSection
          title="Launch Track"
          badgeLabel="What exists now"
          badgeTone="warning"
          lede="The launch track is still centered on the live TimeCurve surface, but the rest of the product now shares its framing and design language."
        >
          <ul className="accent-list">
            <li>TimeCurve remains the active launch surface for onchain buying, charms, podiums, and WarBow PvP.</li>
            <li>This page is intentionally polished now so Rabbit Treasury, Collection, and Referrals still feel first-party while functionality catches up.</li>
            <li>When the next milestone lands, this route should plug into the same badges, panels, and state patterns instead of starting over visually.</li>
          </ul>
        </PageSection>
      </div>
    </section>
  );
}
