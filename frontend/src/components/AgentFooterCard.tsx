import { IndexerStatusBar } from "@/components/IndexerStatusBar";
import { ReferralsFooterPendingPill } from "@/components/ReferralsFooterPendingPill";
import { FeeTransparency } from "@/components/FeeTransparency";
import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { addresses, governanceUrl, indexerBaseUrl } from "@/lib/addresses";
import { resolveChainRpcConfig } from "@/lib/chain";

// SPDX-License-Identifier: AGPL-3.0-only

/** Public GitHub mirror (`main`). Canonical dev + issues: GitLab PlasticDigits/yieldomega. */
const GH_MAIN = "https://github.com/PlasticDigits/yieldomega/blob/main";
const GITLAB_REPO = "https://gitlab.com/PlasticDigits/yieldomega";

const PLAY_SKILLS: { label: string; path: string }[] = [
  { label: "play-active-time-arena — live / paused / indexer-first display", path: "skills/play-active-time-arena/SKILL.md" },
  { label: "play-time-arena-doub — DOUB buys, 100% podium routing, vault funding", path: "skills/play-time-arena-doub/SKILL.md" },
  { label: "play-time-arena-warbow — DOUB PvP, autoroll payout (#252, #312)", path: "skills/play-time-arena-warbow/SKILL.md" },
  { label: "script-with-timearena-local — Anvil stack, env, read-before-write", path: "skills/script-with-timearena-local/SKILL.md" },
  { label: "why-yieldomega-participation-matters — ethics before play", path: "skills/why-yieldomega-participation-matters/SKILL.md" },
  { label: "skills index (play + contributor map)", path: "skills/README.md" },
];

const CONTRIBUTOR_LINKS: { label: string; path: string; note?: string }[] = [
  { label: "AGENTS.md — Cloud Agent runbook + verify matrix", path: "AGENTS.md" },
  {
    label: "yieldomega-guardrails — repo editing skill",
    path: ".cursor/skills/yieldomega-guardrails/SKILL.md",
  },
  {
    label: "rabby-cloud-verification — real wallet QA on Cloud VMs",
    path: ".cursor/skills/rabby-cloud-verification/SKILL.md",
  },
  { label: ".cursor/skills README", path: ".cursor/skills/README.md" },
];

const DOCS_LINKS: { label: string; path: string }[] = [
  { label: "Agent phases (18 build · 20 play)", path: "docs/agent-phases.md" },
  { label: "Architecture — onchain vs indexer vs UI", path: "docs/architecture/overview.md" },
  { label: "Arena v2 product spec", path: "docs/product/arena-v2.md" },
  { label: "Time Arena mechanics", path: "docs/product/time-arena.md" },
  { label: "Indexer design + HTTP surfaces", path: "docs/indexer/design.md" },
  { label: "QA local full stack", path: "docs/testing/qa-local-full-stack.md" },
  { label: "Anvil E2E + dev-wallet seed", path: "docs/testing/e2e-anvil.md" },
  { label: "CI mapping", path: "docs/testing/ci.md" },
  { label: "Arena views / AUDIT page", path: "docs/frontend/arena-views.md" },
  { label: "Invariants & INV-* index", path: "docs/testing/invariants-and-business-logic.md" },
];

const LOCAL_STACK_SNIPPET = `# Bootstrap (Cloud Agent VM or fresh checkout)
bash scripts/bootstrap-cloud-install.sh
bash scripts/verify-cloud-vm-toolchain.sh
bash scripts/verify-cloud-postgres.sh    # native Postgres :5433 (#287)

# Anvil + DeployDev + indexer + frontend/.env.local
bash scripts/start-local-anvil-stack.sh

# Full QA stack (native or Docker PG, optional bot swarm)
export PATH="$HOME/.foundry/bin:$PATH"
SKIP_ANVIL_RICH_STATE=1 YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 START_BOT_SWARM=0 \\
  bash scripts/start-qa-local-full-stack.sh --live-sale --no-swarm

# Play UI http://127.0.0.1:5173/  ·  AUDIT /arena/protocol  ·  indexer :3100
curl -sf http://127.0.0.1:3100/v1/status | jq '{schema_version, max_indexed_block, ingestion_alive}'`;

const VERIFY_SCRIPTS_SNIPPET = `# Smallest check per layer (see AGENTS.md) — run from repo root
cd contracts && forge test
cd indexer && cargo clippy --all-targets -- -D warnings && cargo test
cd frontend && npm run typecheck && npm run lint && npm test

# Anvil smokes (Foundry + host psql; Docker optional #288)
bash scripts/verify-evm-dev-wallet-seed-anvil.sh
bash scripts/verify-podium-live-anvil.sh
bash scripts/verify-podium-prize-preview-anvil.sh
bash scripts/verify-podium-timers-anvil.sh
bash scripts/verify-vault-funding-anvil.sh
bash scripts/verify-wallet-profile-anvil.sh
bash scripts/verify-last-buy-epoch-anvil.sh
bash scripts/verify-cred-buy-anvil.sh
bash scripts/verify-donate-pools-anvil.sh
bash scripts/verify-referral-flat-cred-anvil.sh
bash scripts/verify-arena-charm-twap.sh
bash scripts/verify-time-arena-buy-router-anvil.sh

# Indexer ops / E2E
bash scripts/verify-indexer-rpc-metrics.sh
bash scripts/verify-indexer-rate-limit.sh
bash scripts/e2e-anvil.sh
bash scripts/glab-mr-create.sh --title "…"   # GitLab MR helper`;

const SCRIPTING_SNIPPET = `// Arena v2 — read models: VITE_INDEXER_URL (timers, podiums, wallet stats).
// Writes: TimeArena proxy at VITE_TIME_ARENA_ADDRESS — buy(charmWad) / buyWithCred(charmWad).
// Always read paused + deadlines on RPC before tx; UI display is indexer-first (#301).

import { createPublicClient, http } from "viem";
import { timeArenaReadAbi } from "./abis"; // see frontend/src/lib/abis.ts

const client = createPublicClient({ transport: http(process.env.RPC_URL!) });
const arena = process.env.VITE_TIME_ARENA_ADDRESS as \`0x\${string}\`;

const [paused, deadline] = await Promise.all([
  client.readContract({ address: arena, abi: timeArenaReadAbi, functionName: "paused" }),
  client.readContract({ address: arena, abi: timeArenaReadAbi, functionName: "deadline" }),
]);

const head = await fetch(\`\${process.env.VITE_INDEXER_URL}/v1/arena/timers\`).then((r) => r.json());
// head.podium_deadlines_sec[0..3], head.charm_price_wad, head.schema via /v1/status`;

const INDEXER_ROUTES = `GET /healthz
GET /v1/status                    # schema_version, max_indexed_block, ingestion_alive
GET /v1/status/ops                # rpc_metrics when INDEXER_EXPOSE_OPS_METRICS=1
GET /v1/arena/timers              # four podium_deadlines_sec + sale head (#301)
GET /v1/arena/last-buy-epoch-pricing
GET /v1/arena/podiums             # live leaders; ≥2.16 buy_routing + seed/future prizes
GET /v1/arena/buys
GET /v1/arena/activity
GET /v1/arena/platform-usage
GET /v1/arena/wallet/{address}/stats
GET /v1/arena/warbow/latest-bp
GET /v1/arena/warbow/pending-revenge/{address}
GET /v1/arena/podium-pool-donations
GET /v1/arena/vault-funding/recent
GET /v1/arena/vault-funding/by-tx/{tx_hash}
GET /v1/arena/vault-funding/totals
GET /v1/referrals/registrations
GET /v1/referrals/applied
GET /v1/referrals/referrer-leaderboard
GET /v1/referrals/wallet-cred-summary
GET /v1/referrals/wallet-charm-summary   # alias`;

function ghBlob(path: string) {
  return `${GH_MAIN}/${path}`;
}

function envAddresses(): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  const map: Record<string, `0x${string}` | undefined> = {
    VITE_TIME_ARENA_ADDRESS: addresses.timeArena,
    VITE_PODIUM_VAULTS_ADDRESS: addresses.podiumVaults,
    VITE_REFERRAL_REGISTRY_ADDRESS: addresses.referralRegistry,
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
    <AccordionPanel
      className="app-footer-agent"
      badgeLabel="Agents"
      badgeTone="info"
      title="Agent card"
      lede="Skills, verify scripts, indexer routes, and this build's env."
    >
      <article className="app-footer-agent__article" lang="en">
          <h3 className="app-footer-agent__h">Yield Omega — machine-readable orientation</h3>
          <p className="app-footer-agent__p">
            Time Arena (Arena v2): always-live when unpaused, <strong>DOUB</strong> buys, four independent podium
            timers, 100% buy routing to prize vaults (25% × 4 · 70/20/10 epoch tranches — #300).{" "}
            <strong>Authoritative state is onchain</strong>; the Rust indexer and this UI are derived read models (
            <a href={ghBlob("docs/architecture/overview.md")} target="_blank" rel="noreferrer">
              architecture
            </a>
            ). Primary play route <code className="app-footer-agent__code-inline">/</code>; operator AUDIT{" "}
            <code className="app-footer-agent__code-inline">/arena/protocol</code>. With{" "}
            <code className="app-footer-agent__code-inline">VITE_INDEXER_URL</code> set, timer/podium/sale-head
            display is <strong>indexer-first</strong> (#301) — no browser RPC mirrors for those surfaces.
          </p>
          <p className="app-footer-agent__p">
            <strong>Play agents</strong> → Phase 20 +{" "}
            <a href={ghBlob("skills/README.md")} target="_blank" rel="noreferrer">
              skills/
            </a>
            . <strong>Contributor agents</strong> → Phase 18 +{" "}
            <a href={ghBlob("AGENTS.md")} target="_blank" rel="noreferrer">
              AGENTS.md
            </a>{" "}
            + guardrails. Canonical dev:{" "}
            <a href={GITLAB_REPO} target="_blank" rel="noreferrer">
              GitLab
            </a>
            ; GitHub mirror links below for raw Markdown.
          </p>

          <h4 className="app-footer-agent__h">Play skills</h4>
          <ul className="app-footer-agent__list">
            {PLAY_SKILLS.map((s) => (
              <li key={s.path}>
                <a href={ghBlob(s.path)} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">Contributor runbooks</h4>
          <ul className="app-footer-agent__list">
            {CONTRIBUTOR_LINKS.map((s) => (
              <li key={s.path}>
                <a href={ghBlob(s.path)} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
                {s.note ? ` — ${s.note}` : null}
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">Canonical docs</h4>
          <ul className="app-footer-agent__list">
            {DOCS_LINKS.map((d) => (
              <li key={d.path}>
                <a href={ghBlob(d.path)} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
              </li>
            ))}
          </ul>

          <h4 className="app-footer-agent__h">Local stack scripts</h4>
          <p className="app-footer-agent__p">
            Stack scripts write <code className="app-footer-agent__code-inline">frontend/.env.local</code> (not repo-root{" "}
            <code className="app-footer-agent__code-inline">.env</code>). Native Postgres on{" "}
            <code className="app-footer-agent__code-inline">127.0.0.1:5433</code> when Docker is unavailable (#287).
            Reuse a running Anvil: <code className="app-footer-agent__code-inline">REUSE_ANVIL=1</code>.
          </p>
          <pre className="app-footer-agent__route-block">{LOCAL_STACK_SNIPPET}</pre>

          <h4 className="app-footer-agent__h">Verification scripts</h4>
          <p className="app-footer-agent__p">
            Prefer the <strong>smallest</strong> script that proves your change (full matrix in{" "}
            <a href={ghBlob("AGENTS.md")} target="_blank" rel="noreferrer">
              AGENTS.md
            </a>
            ). Most <code className="app-footer-agent__code-inline">verify-*-anvil.sh</code> scripts manage their own
            Anvil on a dedicated port or reuse <code className="app-footer-agent__code-inline">REUSE_ANVIL=1</code>.
          </p>
          <pre className="app-footer-agent__route-block">{VERIFY_SCRIPTS_SNIPPET}</pre>

          <h4 className="app-footer-agent__h">Scripting (reads + writes)</h4>
          <p className="app-footer-agent__p">
            UUPS <strong>proxy</strong> addresses only. Use RPC for deadline vs block time when timing txs; use indexer
            for history, leaderboards, and wallet stats. See{" "}
            <a href={ghBlob("skills/script-with-timearena-local/SKILL.md")} target="_blank" rel="noreferrer">
              script-with-timearena-local
            </a>{" "}
            and <a href={ghBlob("bots/timearena/README.md")} target="_blank" rel="noreferrer">
              bots/timearena
            </a>
            .
          </p>
          <pre className="app-footer-agent__route-block">{SCRIPTING_SNIPPET}</pre>

          <h4 className="app-footer-agent__h">Indexer HTTP API (v1)</h4>
          <p className="app-footer-agent__p">
            Read-only JSON; <code className="app-footer-agent__code-inline">x-schema-version</code> on responses (current
            tree: <strong>2.16.0</strong> — podium <code className="app-footer-agent__code-inline">buy_routing</code>,
            seed/future prize previews, WarBow pending revenge). SQL failures → HTTP 500 with generic{" "}
            <code className="app-footer-agent__code-inline">error</code> (INV-INDEXER-157). Per-block ingest commits
            (INV-INDEXER-140). Head poller batches via Multicall3 (#307).
          </p>
          <pre className="app-footer-agent__route-block">{INDEXER_ROUTES}</pre>

          <h4 className="app-footer-agent__h">This build (env)</h4>
          <dl className="app-footer-agent__dl">
            <dt>Chain id (configured)</dt>
            <dd>{chain.id}</dd>
            <dt>VITE_RPC_URL</dt>
            <dd className="app-footer-agent__dd-break">{rpc}</dd>
            <dt>VITE_INDEXER_URL (effective)</dt>
            <dd>{indexer ?? "(unset — arena display panels empty/offline)"}</dd>
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
        <h3 className="h-footer">
          {addresses.timeArena ? "Arena prize routing (read-only)" : "Arena routing not configured"}
        </h3>
        <FeeTransparency />
      </div>
    </AccordionPanel>
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
