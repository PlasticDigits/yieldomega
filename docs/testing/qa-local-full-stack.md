# QA: local full stack (Anvil, indexer, frontend, optional swarm)

Procedure for **checklist-driven** workflows that bring up **Postgres + Anvil + contracts + indexer + Vite**, with env and flags **centralized** via [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh). Implements [GitLab #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104). **`--help`** prints only leading `#` banner lines (never shell setup below the banner; [GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)). **Vite cleanup:** if the orchestrator backgrounds `npm run dev` and exits or is interrupted **before** the HTTP readiness probe succeeds, traps tear down the recorded PID so port **5173** is not left orphaned ([GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153); helpers in [`scripts/lib/qa_local_full_stack_frontend.sh`](../../scripts/lib/qa_local_full_stack_frontend.sh); hermetic check: [`scripts/verify-qa-orchestrator-frontend-trap.sh`](../../scripts/verify-qa-orchestrator-frontend-trap.sh)).

**Non-goals:** This path does **not** run Playwright. Use [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) and [`e2e-anvil.md`](e2e-anvil.md) for automated browser E2E.

---

## Invariants (do not regress)

1. **Single source of deploy/indexer logic:** The orchestrator **only** calls [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh). It must not duplicate `forge script`, DB reset, or indexer spawn. **`bash scripts/start-qa-local-full-stack.sh --help`** must not echo lines like **`set -euo pipefail`** ([GitLab #105](https://gitlab.com/PlasticDigits/yieldomega/-/issues/105)).
2. **Vite orphan prevention ([GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)):** While the readiness loop runs, **INT/TERM** kills the recorded dev-server PID and **`exit 130`** (traps in [`scripts/lib/qa_local_full_stack_frontend.sh`](../../scripts/lib/qa_local_full_stack_frontend.sh)); **`EXIT`** covers **errexit** without stealing the script’s exit code. After readiness succeeds, traps are removed so a normal orchestrator exit leaves Vite running. **`curl`** uses **`--connect-timeout 1 --max-time 3`** so signals are not deferred indefinitely by a hung probe. **`exec npm`** keeps **`$!`** aligned with the Node/Vite process. Optional test override: **`QA_FRONTEND_PID_FILE`** (default **`/tmp/yieldomega_frontend_qa.pid`**).
3. **Frontend env:** `VITE_*` and `VITE_INDEXER_URL` come from **`frontend/.env.local`** written by the stack. **Restart Vite** after that file changes (or start Vite *after* the stack, which this orchestrator does when not passing `--no-frontend`).
4. **ERC1967 proxies:** Use **proxy** addresses from the stack / registry — never the **implementation** row in `run-latest.json` for live calls ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61); [`docs/testing/anvil-rich-state.md`](anvil-rich-state.md)).
5. **Reused Anvil RPC:** If the stack **reuses** an existing listener on `ANVIL_PORT`, it cannot apply `--block-time`; swarm + long **buy cooldown** can stall **`block.timestamp`** ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)). Prefer a fresh Anvil from the stack or short cooldown ([issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Docker | Postgres container `yieldomega-pg` (see stack script). On Cursor Cloud VMs without working Docker, use **native Postgres on port 5433** — `bash scripts/bootstrap-cloud-postgres-native.sh` · `bash scripts/verify-cloud-postgres.sh` ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)) · [AGENTS.md § Postgres without Docker](../../AGENTS.md#postgres-without-docker-yieldomega-pg). |
| Foundry | `anvil`, `forge`, `cast`. |
| `jq`, `curl` | Stack and smoke checks. |
| Rust toolchain | Indexer `cargo build` / `cargo run` inside the stack. |
| Node + npm | `frontend/node_modules` (`npm ci` in `frontend/`) for **`npm run dev`**. |
| Python + `web3` | Only if **`START_BOT_SWARM=1`** — venv in `bots/timearena/.venv` preferred ([`bots/timearena/README.md`](../../bots/timearena/README.md), [issue #50](https://gitlab.com/PlasticDigits/yieldomega/-/issues/50)). |

---

## Decision tree

1. **Anvil narrative (optional)**
   - **Default stack:** runs **`anvil_rich_state.sh`** when not skipped — dense historical buys for indexer/UI exploration ([anvil-rich-state.md](anvil-rich-state.md)); optional, not required for Arena v2 ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).
   - **Live arena (bots + Kumbaya / UI demos):** `SKIP_ANVIL_RICH_STATE=1` or **`--live-sale`** (flag name retained). Stack defaults **`START_BOT_SWARM=1`** unless you **`--no-swarm`** or set `START_BOT_SWARM=0`.
   - **`--rich-state`:** unset **`SKIP_ANVIL_RICH_STATE`** when your shell inherited `SKIP_ANVIL_RICH_STATE=1` and you want the rich-state script again.
2. **Kumbaya / `BuyViaKumbaya`:** `YIELDOMEGA_DEPLOY_KUMBAYA=1` or **`--kumbaya`**. Indexer must see **`TimeArenaBuyRouter`** in the registry; after [`scripts/verify-time-arena-buy-router-anvil.sh`](../../scripts/verify-time-arena-buy-router-anvil.sh), restart the indexer if you merged registry rows ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [issue #84](https://gitlab.com/PlasticDigits/yieldomega/-/issues/84)).
3. **Dense buys / swarm:** Prefer **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** (and optionally **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`**) — [issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88), [issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99).
4. **Headless (no browser dev server):** **`--no-frontend`**.

---

## One-command start (recommended)

From repository root:

```bash
bash scripts/start-qa-local-full-stack.sh
```

Examples:

```bash
# Live arena + Kumbaya fixtures + short cooldown (env forwarded)
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/start-qa-local-full-stack.sh --live-sale --kumbaya

# Stack only (no Vite, no swarm override — inherits stack defaults)
bash scripts/start-qa-local-full-stack.sh --no-frontend --no-swarm
```

### CLI flags vs env

| Flag | Effect |
|------|--------|
| `--no-frontend` | Skip background **`npm run dev`**. |
| `--no-swarm` | **`START_BOT_SWARM=0`** before the stack. |
| `--kumbaya` | **`YIELDOMEGA_DEPLOY_KUMBAYA=1`**. |
| `--rich-state` | **`unset SKIP_ANVIL_RICH_STATE`** (run optional **`anvil_rich_state.sh`** when stack defaults apply). |
| `--live-sale` | **`SKIP_ANVIL_RICH_STATE=1`** (live arena; unwarped chain time). |

Any other variable documented for [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) can be **exported before** the orchestrator (same shell); the orchestrator does not strip env.

### Env matrix (reference)

| Area | Variables (representative) |
|------|----------------------------|
| Stack / Anvil | `ANVIL_PORT`, `RPC_URL`, `SKIP_ANVIL_RICH_STATE`, `START_BOT_SWARM`, `YIELDOMEGA_ANVIL_BLOCK_TIME_SEC`, `YIELDOMEGA_ANVIL_GAS_LIMIT`, `YIELDOMEGA_DEV_SALE_START_DELAY_SEC`, `YIELDOMEGA_DEPLOY_NO_COOLDOWN`, `YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`, `YIELDOMEGA_DEPLOY_KUMBAYA`, `DEPLOYER_PK`, `FOUNDRY_OUT` |
| Postgres / indexer | `PG_HOST_PORT`, `INDEXER_PORT`, `QA_USE_FIXED_INDEXER_PORT`, `DOCKER_PG`; production deploys: **`INDEXER_PRODUCTION=1`** requires non-placeholder **`DATABASE_URL`** ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142), [`indexer/README.md`](../../indexer/README.md)) and a valid **`ADDRESS_REGISTRY`** when ingestion is on ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156), [`INV-INDEXER-156`](../../docs/testing/invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)) |
| Frontend timing | `LAUNCH_OFFSET_SEC` → `VITE_LAUNCH_TIMESTAMP` in `.env.local` |
| Swarm | `YIELDOMEGA_SWARM_REFERRALS`, `YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`; stack runs [`scripts/sync-bot-env-from-frontend.sh`](../../scripts/sync-bot-env-from-frontend.sh) before swarm ([issue #102](https://gitlab.com/PlasticDigits/yieldomega/-/issues/102)) |
| Vite port | `FRONTEND_DEV_PORT` (orchestrator → `npm run dev -- --port …`) |

---

## Manual sequence (without orchestrator)

Equivalent to **stack only**, then Vite:

```bash
bash scripts/start-local-anvil-stack.sh
cd frontend && npm run dev
```

Cross-links: **bot-only env** regeneration — [`scripts/anvil-export-bot-env.sh`](../../scripts/anvil-export-bot-env.sh); **Playwright** — [`e2e-anvil.md`](e2e-anvil.md).

---

## Smoke checks

Substitute `RPC_URL` and indexer base URL from stack output or `frontend/.env.local` (`VITE_RPC_URL`, `VITE_INDEXER_URL`).

```bash
cast block-number --rpc-url "$RPC_URL"
curl -sf "${INDEXER_URL}/v1/status"
curl -s "${INDEXER_URL}/v1/arena/buys?limit=5" | jq .
```

**Optional:** `make check-frontend-env` — merged `frontend/.env` + `frontend/.env.local` ([`e2e-anvil.md`](e2e-anvil.md)).

---

## Stopping the stack

| Process | PID / hint |
|---------|------------|
| Anvil (when started by stack) | `/tmp/yieldomega_anvil_stack.pid` |
| Indexer | `/tmp/yieldomega_indexer_stack.pid` |
| Vite (orchestrator) | `/tmp/yieldomega_frontend_qa.pid` — if you **Ctrl+C** the orchestrator **while Vite is still starting** (before the readiness probe succeeds), the script stops the dev server automatically ([GitLab #153](https://gitlab.com/PlasticDigits/yieldomega/-/issues/153)). After a **successful** run, the orchestrator exits but leaves Vite (and the stack) running; stop Vite manually via this PID or `pkill` on your dev port if needed. |
| Docker Postgres | `docker stop yieldomega-pg` (name: `DOCKER_PG`, default `yieldomega-pg`) |
| Bot swarm | `/tmp/yieldomega_bot_swarm.pids` (if used) |

Logs: `/tmp/yieldomega_anvil_stack.log`, `/tmp/yieldomega_indexer_stack.log`, `/tmp/yieldomega_frontend_qa.log`, `/tmp/yieldomega_swarm_*.log`.

---

## Troubleshooting

- **Indexer port in use:** Stack may auto-bump **`INDEXER_PORT`** unless **`QA_USE_FIXED_INDEXER_PORT=1`**. Re-read **`VITE_INDEXER_URL`** in `.env.local` after each run.
- **PEP 668 / missing `web3`:** [`bots/timearena/README.md`](../../bots/timearena/README.md).
- **Kumbaya router not ingesting:** Registry must list **`TimeArenaBuyRouter`**; restart indexer after registry updates.

---

## Verification checklist (MR / release)

Use this list after the orchestrator or documented manual sequence ([issue #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104)):

- [ ] `cast block-number --rpc-url <RPC_URL>` succeeds.
- [ ] `curl -sf http://127.0.0.1:<indexer>/v1/status` returns OK.
- [ ] `curl -s 'http://127.0.0.1:<indexer>/v1/arena/buys?limit=5' | jq .` returns JSON (empty array OK right after deploy).
- [ ] Browser: app URL loads; **`/arena`** accepts buys when **`SKIP_ANVIL_RICH_STATE=1`** (live arena) or shows rich-state narrative when rich state ran.
- [ ] If swarm enabled: `/tmp/yieldomega_swarm_*.log` shows activity; buys endpoint gains rows over time (with short cooldown for dense checks).
- [ ] If `SKIP_ANVIL_RICH_STATE=1` + swarm: when stack **started** Anvil, logs note **interval mining**; if **reusing** RPC, expect the documented warning path ([issue #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)).
- [ ] `make check-frontend-env` passes when `.env.local` exists (optional).

---

## Related documentation

- [`e2e-anvil.md`](e2e-anvil.md) — E2E env, cooldown [#88], swarm [#99], standalone swarm [#102], Playwright workers [#87].
- [`manual-qa-checklists.md`](manual-qa-checklists.md) — Issue-tagged contributor checklists (includes [#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104) TOC row).
- [`invariants-and-business-logic.md`](invariants-and-business-logic.md) — **Local QA full stack orchestrator** ([GitLab #104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104)): [`invariants-and-business-logic.md#qa-local-full-stack-orchestrator-gitlab-104`](invariants-and-business-logic.md#qa-local-full-stack-orchestrator-gitlab-104).

Player-facing agents: root [`skills/README.md`](../../skills/README.md) (index); contributor QA cross-link for local stack in [`skills/script-with-timearena-local/SKILL.md`](../../skills/script-with-timearena-local/SKILL.md).
