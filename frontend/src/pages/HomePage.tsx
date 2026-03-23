import { Link } from "react-router-dom";

// SPDX-License-Identifier: AGPL-3.0-only

export function HomePage() {
  return (
    <section className="page">
      <h1>YieldOmega</h1>
      <p className="lede">
        Static Vite frontend: indexer reads, direct RPC where needed, wallet-native
        actions (no custody in the app).
      </p>
      <ul className="card-list">
        <li>
          <Link to="/timecurve">TimeCurve</Link> — timer, curve, buys, leaderboards
        </li>
        <li>
          <Link to="/rabbit-treasury">Rabbit Treasury</Link> — deposits, epochs,
          standings
        </li>
        <li>
          <Link to="/collection">Collection</Link> — NFT gallery and traits
        </li>
      </ul>
    </section>
  );
}
