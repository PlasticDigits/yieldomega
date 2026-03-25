import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

export function HomePage() {
  return (
    <section className="page">
      <h1>YieldOmega</h1>
      <p className="lede">
        Bright, wallet-native, and built to make TimeCurve, Rabbit Treasury, and the leprechaun
        collection feel like one coherent onchain world.
      </p>
      <ul className="card-list">
        <li>
          <Link to="/timecurve">TimeCurve</Link> — race the clock, read the floor buy,
          and watch the feed move in public
        </li>
        <li>
          <Link to="/rabbit-treasury">Rabbit Treasury</Link> — deposit into the burrow,
          track reserve health, and follow the epochs
        </li>
        <li>
          <Link to="/collection">Collection</Link> — browse minted leprechauns with onchain
          traits and metadata images when available
        </li>
        <li>
          <Link to="/referrals">Referrals</Link> — register a code, share links, track
          rewards
        </li>
      </ul>
    </section>
  );
}
