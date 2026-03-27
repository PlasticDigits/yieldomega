import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

export function HomePage() {
  return (
    <section className="page">
      <h1>YieldOmega</h1>
      <p className="lede">
        This milestone is the <strong>TimeCurve Doubloon (DOUB)</strong> launch. Other surfaces
        are placeholders until devnet E2E is green — see <code>launchplan-timecurve.md</code> in
        the repo.
      </p>
      <ul className="card-list">
        <li>
          <Link to="/timecurve">TimeCurve</Link> — <strong>active</strong>: DOUB sale, timer,
          charms, and prizes per onchain rules
        </li>
        <li>
          <Link to="/rabbit-treasury">Rabbit Treasury</Link> — under construction (Burrow deposits
          and epochs return later)
        </li>
        <li>
          <Link to="/collection">Collection</Link> — under construction (Leprechaun NFTs)
        </li>
        <li>
          <Link to="/referrals">Referrals</Link> — under construction
        </li>
        <li>
          <Link to="/kumbaya">Kumbaya</Link> — third-party spot DEX; LP snapshot (placeholder) + link
        </li>
        <li>
          <Link to="/sir">Sir</Link> — third-party perps DEX; LP snapshot (placeholder) + link
        </li>
      </ul>
    </section>
  );
}
