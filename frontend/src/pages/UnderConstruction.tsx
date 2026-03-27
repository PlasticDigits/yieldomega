import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  title: string;
  slug: string;
  children: React.ReactNode;
};

/** Placeholder surface while TimeCurve is the active launch milestone. */
export function UnderConstruction({ title, slug, children }: Props) {
  return (
    <section className="page" data-testid={`under-construction-${slug}`}>
      <h1>{title}</h1>
      <p className="under-construction-banner" role="status">
        Under construction
      </p>
      <p className="lede">{children}</p>
      <p>
        <Link to="/timecurve">TimeCurve</Link> is the active launch surface for this milestone.
      </p>
    </section>
  );
}
