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

/** Fallback surface for routes that are not wired into live onchain reads yet. */
export function UnderConstruction({ title, slug, imageSrc = "/art/mascot-bunny-wave.jpg", children }: Props) {
  const cutouts = PLACEHOLDER_CUTOUTS_BY_SLUG[slug as keyof typeof PLACEHOLDER_CUTOUTS_BY_SLUG]
    ?? PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

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
            {children} Route not wired yet.
          </>
        }
        mascot={{
          src: cutouts.secondary,
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      >
        <Link to="/" className="btn-primary">
          Home
        </Link>
        <Link to="/audit" className="btn-secondary">
          AUDIT
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
          title="Arena Track"
          badgeLabel="What exists now"
          badgeTone="warning"
          lede={undefined}
        >
          <ul className="accent-list">
            <li title="TimeArena remains the live onchain surface for CHARM buys, podiums, CRED, and WarBow.">
              TimeArena is live.
            </li>
            <li title="Future route reads should reuse shared badges, panels, address rows, and state patterns.">
              Wire future reads into shared panels.
            </li>
          </ul>
        </PageSection>
      </div>
    </section>
  );
}
