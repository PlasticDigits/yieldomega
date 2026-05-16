import { IndexerStatusBar } from "@/components/IndexerStatusBar";
import { ReferralsFooterPendingPill } from "@/components/ReferralsFooterPendingPill";
import { FeeTransparency } from "@/components/FeeTransparency";
import { addresses, governanceUrl, indexerBaseUrl } from "@/lib/addresses";
import { resolveChainRpcConfig } from "@/lib/chain";

// SPDX-License-Identifier: AGPL-3.0-only

/** Public GitHub mirror of the monorepo (`main` branch). Canonical development may track GitLab; paths match. */
const GH_MAIN = "https://github.com/PlasticDigits/yieldomega/blob/main";

const PLAY_SKILLS: { label: string; path: string }[] = [
  { label: "skills index (play + contributor map)", path: "skills/README.md" },
  { label: "why-yieldomega-participation-matters", path: "skills/why-yieldomega-participation-matters/SKILL.md" },
  { label: "script-with-timecurve-local", path: "skills/script-with-timecurve-local/SKILL.md" },
  { label: "play-timecurve-doubloon", path: "skills/play-timecurve-doubloon/SKILL.md" },
  { label: "play-timecurve-warbow", path: "skills/play-timecurve-warbow/SKILL.md" },
  { label: "play-rabbit-treasury", path: "skills/play-rabbit-treasury/SKILL.md" },
  { label: "collect-leprechaun-sets", path: "skills/collect-leprechaun-sets/SKILL.md" },
];

const CONTRIBUTOR_SKILL = {
  label: "yieldomega-guardrails (repo editing)",
  path: ".cursor/skills/yieldomega-guardrails/SKILL.md",
};

const DOCS_LINKS: { label: string; path: string }[] = [
  { label: "Agent phases (18 / 20)", path: "docs/agent-phases.md" },
  { label: "Agents: metadata and skills", path: "docs/agents/metadata-and-skills.md" },
  { label: "Architecture overview (onchain vs indexer vs UI)", path: "docs/architecture/overview.md" },
  { label: "Indexer design + HTTP error redaction (#157)", path: "docs/indexer/design.md" },
  { label: "Invariants & business logic (indexer INV-* index)", path: "docs/testing/invariants-and-business-logic.md" },
  { label: "TimeCurve product primitives", path: "docs/product/primitives.md" },
];

const TIMECURVE_SCRIPTING_SNIPPET = `# pip install web3 — sketch only: set RPC_URL, PRIVATE_KEY, TIMECURVE, TIME_CURVE_ABI (proxy).
import os
from web3 import Web3

w3 = Web3(Web3.HTTPProvider(os.environ["RPC_URL"]))
acct = w3.eth.account.from_key(os.environ["PRIVATE_KEY"])
tc = w3.eth.contract(address=w3.to_checksum_address(os.environ["TIMECURVE"]), abi=TIME_CURVE_ABI)

ts = w3.eth.get_block("latest")["timestamp"]
if tc.functions.ended().call() or tc.functions.deadline().call() - ts > 15:
    raise SystemExit("skip: not final 15s or sale ended")

winners, _ = tc.functions.podium(0).call()  # category 0 = last-buy reserve podium
if winners[0].lower() == acct.address.lower():
    raise SystemExit("skip: wallet already first on last-buy podium")

_min, max_wad = tc.functions.currentCharmBoundsWad().call()
tx = tc.functions.buy(max_wad).build_transaction(
    {"from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address), "chainId": w3.eth.chain_id}
)
raw = w3.eth.account.sign_transaction(tx, acct.key).raw_transaction
w3.eth.send_raw_transaction(raw)`;

const INDEXER_ROUTES = `GET /healthz
GET /v1/status
GET /v1/timecurve/chain-timer
GET /v1/timecurve/podiums
GET /v1/timecurve/buys
GET /v1/timecurve/warbow/battle-feed
GET /v1/timecurve/warbow/leaderboard
GET /v1/timecurve/warbow/steals-by-victim-day
GET /v1/timecurve/warbow/guard-latest
GET /v1/timecurve/warbow/pending-revenge
GET /v1/timecurve/warbow/refresh-candidates
GET /v1/timecurve/buyer-stats
GET /v1/rabbit/deposits
GET /v1/rabbit/withdrawals
GET /v1/rabbit/health-epochs
GET /v1/timecurve/charm-redemptions
GET /v1/leprechauns/mints
GET /v1/timecurve/prize-distributions
GET /v1/timecurve/prize-payouts
GET /v1/referrals/registrations
GET /v1/referrals/applied
GET /v1/referrals/referrer-leaderboard
GET /v1/referrals/wallet-charm-summary
GET /v1/fee-router/sinks-updates
GET /v1/fee-router/fees-distributed
GET /v1/rabbit/faction-stats`;

function ghBlob(path: string) {
  return `${GH_MAIN}/${path}`;
}

function envAddresses(): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  const map: Record<string, `0x${string}` | undefined> = {
    "VITE_TIMECURVE_ADDRESS (TimeCurve proxy)": addresses.timeCurve,
    "VITE_RABBIT_TREASURY_ADDRESS": addresses.rabbitTreasury,
    "VITE_LEPRECHAUN_NFT_ADDRESS": addresses.leprechaunNft,
    "VITE_REFERRAL_REGISTRY_ADDRESS": addresses.referralRegistry,
    "VITE_FEE_ROUTER_ADDRESS": addresses.feeRouter,
    "VITE_DOUB_PRESALE_VESTING_ADDRESS": addresses.doubPresaleVesting,
    "VITE_PRESALE_CHARM_BENEFICIARY_REGISTRY": addresses.presaleCharmBeneficiaryRegistry,
  };
  for (const [key, v] of Object.entries(map)) {
    if (v) entries.push({ key, value: v });
  }
  return entries;
}

export function AgentFooterCard() {
  const gov = governanceUrl();
  const indexer = indexerBaseUrl();
  const chain = resolveChainRpcConfig(import.meta.env.VITE_CHAIN_ID, import.meta.env.VITE_RPC_URL);
  const rpc = import.meta.env.VITE_RPC_URL?.trim() || "(default transport)";
  const addrs = envAddresses();

  return (
    <details className="app-footer-agent">
      <summary className="app-footer-agent__summary">
        <span className="app-footer-agent__summary-title">AGENT CARD: For agents only</span>
        <span className="app-footer-agent__summary-hint">Expand for skills, indexer routes, and live readouts.</span>
      </summary>
      <div className="app-footer-agent__body">
        <article className="app-footer-agent__article" lang="en">
          <h3 className="app-footer-agent__h">YieldOmega — machine-readable orientation</h3>
          <p className="app-footer-agent__p">
            YieldOmega ships onchain games and treasuries (TimeCurve DOUB sale, Rabbit Treasury / Burrow, Leprechaun
            NFTs, referrals, fee routing).{" "}
            <strong>Authoritative rules and balances live in contracts</strong>; the indexer and this UI are{" "}
            <strong>derived read models</strong> built from decoded logs and JSON-RPC (see architecture doc). Agents
            helping <em>users participate</em> should follow{" "}
            <a href={ghBlob("docs/agent-phases.md")}>Phase 20</a> and the play skills below. Agents <em>editing this</em>{" "}
            repository follow Phase 18 and the guardrails skill.
          </p>

          <h4 className="app-footer-agent__h">Play skills (GitHub mirror, raw Markdown)</h4>
          <p className="app-footer-agent__p">
            Six player-facing skills live under <code className="app-footer-agent__code-inline">skills/</code> (see
            table in <a href={ghBlob("skills/README.md")}>skills/README.md</a>). Use these for wallet flows, buys,
            WarBow, treasury, and collection semantics — not for unsolicited repo patches unless the user asks.
          </p>
          <ul className="app-footer-agent__list">
            {PLAY_SKILLS.map((s) => (
              <li key={s.path}>
                <a href={ghBlob(s.path)} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">Contributor agents (code / CI / indexer)</h4>
          <ul className="app-footer-agent__list">
            <li>
              <a href={ghBlob(CONTRIBUTOR_SKILL.path)} target="_blank" rel="noreferrer">
                {CONTRIBUTOR_SKILL.label}
              </a>{" "}
              — phases, AGPL-3.0, onchain-vs-derived layers, testing strategy cross-links.
            </li>
            <li>
              <a href={ghBlob(".cursor/skills/README.md")} target="_blank" rel="noreferrer">
                .cursor/skills/README.md
              </a>{" "}
              — IDE skill index for maintainers.
            </li>
          </ul>

          <h4 className="app-footer-agent__h">Canonical docs (same tree on GitHub)</h4>
          <ul className="app-footer-agent__list">
            {DOCS_LINKS.map((d) => (
              <li key={d.path}>
                <a href={ghBlob(d.path)} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">TimeCurve scripting</h4>
          <p className="app-footer-agent__p">
            Use <strong>RPC</strong> for <code className="app-footer-agent__code-inline">deadline</code> vs{" "}
            <code className="app-footer-agent__code-inline">latest</code> time — not indexer latency alone (
            <a href={ghBlob("skills/script-with-timecurve-local/SKILL.md")} target="_blank" rel="noreferrer">
              script-with-timecurve-local
            </a>
            ). <code className="app-footer-agent__code-inline">podium(0)</code> is the <strong>last-buy</strong> reserve
            podium (first address = current #1). Before production sends: cooldown, allowances, CHARM slack (#82),
            gas — this is a process sketch, not execution advice.
          </p>
          <pre className="app-footer-agent__route-block">{TIMECURVE_SCRIPTING_SNIPPET}</pre>

          <h4 className="app-footer-agent__h">Indexer HTTP API (v1)</h4>
          <p className="app-footer-agent__p">
            The Rust indexer exposes read-only JSON under{" "}
            <code className="app-footer-agent__code-inline">/v1/*</code>.{" "}
            <code className="app-footer-agent__code-inline">GET /v1/status</code> returns{" "}
            <code className="app-footer-agent__code-inline">schema_version</code>,{" "}
            <code className="app-footer-agent__code-inline">chain_pointer</code>,{" "}
            <code className="app-footer-agent__code-inline">max_indexed_block</code>,{" "}
            <code className="app-footer-agent__code-inline">ingestion_alive</code>, and{" "}
            <code className="app-footer-agent__code-inline">last_indexed_at_ms</code>. Unexpected SQL failures respond
            with HTTP 500 and a generic <code className="app-footer-agent__code-inline">error</code> string (no raw
            Postgres text in the body — INV-INDEXER-157). Block ingestion commits per-block in a single DB transaction
            (INV-INDEXER-140). Decoded events must cover deployed emits (INV-INDEXER-112).
          </p>
          <pre className="app-footer-agent__route-block">{INDEXER_ROUTES}</pre>

          <h4 className="app-footer-agent__h">This build (env)</h4>
          <dl className="app-footer-agent__dl">
            <dt>Chain id (configured)</dt>
            <dd>{chain.id}</dd>
            <dt>VITE_RPC_URL</dt>
            <dd className="app-footer-agent__dd-break">{rpc}</dd>
            <dt>Indexer base URL (effective)</dt>
            <dd>{indexer ?? "(unset — fee/history panels may be empty)"}</dd>
          </dl>
          {addrs.length > 0 ? (
            <>
              <h4 className="app-footer-agent__h">Resolved protocol addresses (env)</h4>
              <dl className="app-footer-agent__dl">
                {addrs.map((a) => (
                  <FragmentRow key={a.key} k={a.key} v={a.value} />
                ))}
              </dl>
            </>
          ) : null}
        </article>

        <div className="app-footer__row app-footer__row--after-agent">
          <IndexerStatusBar />
          <ReferralsFooterPendingPill />
          {gov ? (
            <a href={gov} target="_blank" rel="noreferrer" className="footer-link-pill">
              Governance / CL8Y
            </a>
          ) : null}
        </div>
        <div className="data-panel data-panel--footer">
          <h3 className="h-footer">Canonical fee sinks (read-only)</h3>
          <FeeTransparency />
        </div>
      </div>
    </details>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className="app-footer-agent__dd-mono">{v}</dd>
    </>
  );
}
