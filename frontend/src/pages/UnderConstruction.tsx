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

/** Placeholder surface for routes that are not wired into live onchain reads yet. */
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
            {children} This route now uses the same Yield Omega shell, spacing, and mascot system as the live app so
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
        <Link to="/arena" className="btn-primary">
          Open Time Arena
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
          lede="The active onchain surface is Time Arena; adjacent routes share its command-console framing until their own reads are wired."
        >
          <ul className="accent-list">
            <li>Time Arena remains the active surface for onchain buys, CHARM, podiums, and WarBow PvP.</li>
            <li>This page is intentionally polished now so adjacent routes feel first-party while functionality catches up.</li>
            <li>When the next milestone lands, this route should plug into the same badges, panels, and state patterns instead of starting over visually.</li>
          </ul>
        </PageSection>
      </div>
    </section>
  );
}
