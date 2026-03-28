import { Link } from "react-router-dom";
import { CutoutDecoration } from "@/components/CutoutDecoration";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  imageSrc?: string;
  children: React.ReactNode;
};

const CUTOUTS_BY_SLUG: Record<
  string,
  {
    primary: string;
    secondary: string;
    tertiary: string;
  }
> = {
  "rabbit-treasury": {
    primary: "/art/cutouts/mascot-leprechaun-with-bag-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/loading-mascot-circle.png",
  },
  collection: {
    primary: "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/bunny-cutout.png",
  },
  referrals: {
    primary: "/art/cutouts/mascot-bunnyleprechaungirl-wave-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/loading-mascot-circle.png",
  },
};

/** Placeholder surface while TimeCurve is the active launch milestone. */
export function UnderConstruction({ title, slug, imageSrc = "/art/mascot-bunny-leprechaun-wave.jpg", children }: Props) {
  const cutouts = CUTOUTS_BY_SLUG[slug] ?? CUTOUTS_BY_SLUG.collection;

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
      <h1>{title}</h1>
      <p className="under-construction-banner" role="status">
        Under construction
      </p>
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
      <p className="lede">{children}</p>
      <p>
        <Link to="/timecurve">TimeCurve</Link> is the active launch surface for this milestone.
      </p>
    </section>
  );
}
