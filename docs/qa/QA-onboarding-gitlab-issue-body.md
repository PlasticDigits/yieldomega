## Summary

Onboarding task for a new QA engineer ([GitLab #274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)): run the full local YieldOmega stack (Postgres, Anvil, indexer, frontend, bot swarm), fund a **personal test wallet** on Anvil alongside bots, and complete the **Arena v2** verification checklist below.

**Canonical product:** [`TimeArena`](../../contracts/src/arena/TimeArena.sol) on route **`/arena`** — not the retired v1 launchpad or five-sink CL8Y fee model ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

**Authoritative checklists (read before filing defects):**

- [`docs/testing/manual-qa-checklists.md` §260 — Arena v2 QA](../testing/manual-qa-checklists.md#manual-qa-issue-260) ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260))
- [`skills/README.md`](../../skills/README.md) — participant play skills (`play-active-time-arena`, `play-time-arena-doub`, `play-time-arena-warbow`)
- [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) — contributor guardrails (Arena v2 spec, testing, indexer, bots)

---

## Prerequisites

Install on the machine:

- **Docker** (Postgres for indexer)
- **Foundry** — `anvil`, `forge`, `cast` on `PATH`
- **jq**, **curl**
- **Node.js** + npm (frontend)
- **Python 3.11+** ([`bots/timearena`](../../bots/timearena/README.md))

Clone and stay at repo root unless noted:

```bash
git clone https://gitlab.com/PlasticDigits/yieldomega.git
cd yieldomega
```

---

## 1. Full local infra + frontend

From **repository root**:

```bash
bash scripts/start-local-anvil-stack.sh
```

This brings up Postgres, Anvil, deploys **`DeployDev`** (Arena v2), runs the indexer, and writes `frontend/.env.local` (chain `31337`, **`VITE_TIME_ARENA_ADDRESS`**, vault addresses, indexer URL). See [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) for:

- **`SKIP_ANVIL_RICH_STATE=1`** — skip prefilled rich chain state; arena stays **live** for demos; **`START_BOT_SWARM`** defaults to **1**.
- **`START_BOT_SWARM=0`** — skip automatic swarm if you only want infra.
- **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** — short per-wallet buy cooldown for dense manual QA ([#88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)); pair with swarm demos ([#99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99)).

Start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open **`http://127.0.0.1:5173/arena`** (unified Arena page — [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)).

**Vite env:** Build-time `VITE_*` variables are documented in [`docs/testing/e2e-anvil.md`](../testing/e2e-anvil.md) (table). The stack script already writes `frontend/.env.local`.

After the stack (or after `scripts/qa/write-frontend-env-local.sh` on a QA laptop), run **`make check-frontend-env`** from repo root. It validates merged `frontend/.env` + `frontend/.env.local` for Arena v2 deploy vars — at minimum non-empty **`VITE_TIME_ARENA_ADDRESS`**, **`VITE_PODIUM_VAULTS_ADDRESS`**, **`VITE_ADMIN_SELL_VAULT_ADDRESS`**, **`VITE_REFERRAL_REGISTRY_ADDRESS`**, **`VITE_RPC_URL`**, and **`VITE_CHAIN_ID`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) — no `VITE_TIMECURVE_ADDRESS`). Legacy v1 fee-router **`VITE_*`** vars are **retired** ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)) — do not treat them as a QA gate.

If you started **`npm run dev`** before `frontend/.env.local` existed, **restart** the dev server so Vite reloads `VITE_*`.

---

## 2. Bot env + QA wallet “airdrop” (Anvil only)

Sync bot env from the frontend file (RPC + **`TimeArena`** proxy addresses):

```bash
bash scripts/sync-bot-env-from-frontend.sh
```

Install the TimeArena bot package:

```bash
cd bots/timearena
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Edit **`bots/timearena/.env.local`** (gitignored). Add your **browser test wallet address** (MetaMask or similar) so it receives the same one-shot funding as swarm bots:

```bash
# Comma-separated 0x addresses only — never commit private keys.
YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=0xYourAddressHere
```

Also ensure Anvil funding is allowed when running swarm (the local stack sets this when it spawns swarm):

- `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`
- `YIELDOMEGA_CHAIN_ID=31337`

**Security:** Only **addresses** belong in shared docs; private keys stay local.

Details: [`bots/timearena/README.md`](../../bots/timearena/README.md).

---

## 3. Start the swarm (if not already started by the stack)

If you used `SKIP_ANVIL_RICH_STATE=1`, the stack may already have started the swarm. Otherwise, from repo root with env loaded:

```bash
set -a && source bots/timearena/.env.local && set +a
export YIELDOMEGA_ALLOW_ANVIL_FUNDING=1
cd bots/timearena && .venv/bin/timecurve-bot --allow-anvil-funding swarm  # legacy CLI binary name for `bots/timearena`
```

Standalone swarm without the full stack: [`bots/timearena/README.md` § Run `run_swarm()`](../../bots/timearena/README.md) and [e2e-anvil.md § standalone bot swarm](../testing/e2e-anvil.md#standalone-bot-swarm-run_swarm-without-the-full-stack-gitlab-102).

---

## 4. Arena v2 mechanics (QA must know)

Product spec: [`docs/product/arena-v2.md`](../product/arena-v2.md).

### Always-live arena

**`TimeArena`** has **no** v1 sale-end or charm-redemption lifecycle ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)). The arena is always live when not **`paused`**. Prize settlement is permissionless **`rollPodiumEpoch(category)`** after each category’s deadline.

### Four podium categories

| Category | Index | Settlement |
|----------|-------|------------|
| **Last Buy** | 0 | Last-three buyers; **`rollPodiumEpoch(0)`** pays **4∶2∶1** from active pool |
| **Time Booster** | 1 | Most effective deadline seconds added |
| **Defended Streak** | 2 | Best under-window streak |
| **WarBow** | 3 | Top Battle Points; auto-pay skipped — owner **`finalizeWarbowPodium`** ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)) |

Each qualifying **buy** extends **all four** podium deadlines. Timers **diverge** when categories roll on different schedules ([#247](https://gitlab.com/PlasticDigits/yieldomega/-/issues/247)). Per-category timer params: [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271).

### DOUB buy routing (per buy)

Canonical split — **not** the retired five-sink CL8Y model:

| Destination | Share of gross DOUB buy |
|-------------|-------------------------|
| Four **active** podium pools | **40%** (10% each category) |
| Four **seed** podium pools | **30%** (7.5% each category) |
| **`AdminSellVault`** | **30%** |

See [arena-v2.md § DOUB prize routing](../product/arena-v2.md#doub-prize-routing-per-buy) and Forge **`ArenaPrizeRouting.t.sol`**.

---

## Acceptance criteria — setup and `/arena` page

### Tooling and repository

- [ ] Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+ available.
- [ ] Repository cloned and up to date (`main` or assigned branch).
- [ ] Read [manual-qa-checklists §260](../testing/manual-qa-checklists.md#manual-qa-issue-260), [`skills/README.md`](../../skills/README.md), and [yieldomega-guardrails SKILL](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

### Local stack (infra)

- [ ] `bash scripts/start-local-anvil-stack.sh` completes without fatal errors.
- [ ] Postgres container is running; Anvil responds on the expected RPC port (default `8545`).
- [ ] Contracts deployed; `frontend/.env.local` exists with `VITE_CHAIN_ID=31337` and Arena v2 addresses.
- [ ] **`make check-frontend-env`** passes (non-empty **`VITE_TIME_ARENA_ADDRESS`**, vault env vars, RPC, chain id).
- [ ] Indexer process is listening (note printed `INDEXER_PORT`, often `3100`).

### Frontend

- [ ] `cd frontend && npm ci && npm run dev` succeeds (restart dev server if it was started before `frontend/.env.local` was written).
- [ ] **`/arena`** opens in the browser (e.g. `http://127.0.0.1:5173/arena`).
- [ ] Wallet / network pointed at local Anvil (`http://127.0.0.1:8545`, chain `31337`).
- [ ] **`/arena`** loads without a hard error (blank screen or unhandled exception).
- [ ] **`arena-timer-chips`** shows four labels (Last Buy, Time Booster, Streak, WarBow); **`arena-charm-cred-card`** visible ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).

### Bots, swarm, and QA wallet

- [ ] `bash scripts/sync-bot-env-from-frontend.sh` run so **`bots/timearena/.env.local`** matches frontend RPC and **`TimeArena`** address.
- [ ] **`bots/timearena`** deps installed (venv + `pip install -e ".[dev]"`, or PEP 668 fallback in [`bots/timearena/README.md`](../../bots/timearena/README.md)); legacy CLI **`timecurve-bot --help`** (packaged from `bots/timearena`) and `import web3` succeed.
- [ ] **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`** set in **`bots/timearena/.env.local`** to the **same** address(es) you use in the browser (**0x only**, no private keys in shared files).
- [ ] Swarm has run with Anvil funding: either the stack started it (`SKIP_ANVIL_RICH_STATE=1` path) **or** you ran **`timecurve-bot --allow-anvil-funding swarm`** (legacy binary name) manually **or** you intentionally skipped swarm (`START_BOT_SWARM=0`) and documented why.
- [ ] After funding: QA wallet shows sufficient **native ETH** on Anvil for gas (same dev top-up as swarm bots).
- [ ] After funding: QA wallet shows **DOUB** balance for buys and WarBow spends.
- [ ] Browser wallet is connected to the dapp and matches **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`**.

### `/arena` page (smoke during onboarding)

- [ ] Four timer chips visible; with indexer up, deadlines from **`GET /v1/arena/timers`** (not all `—`).
- [ ] At least one interaction attempted with QA-funded wallet (connect, read balances, DOUB buy slider, or WarBow action as appropriate).

### Process

- [ ] Defects filed as **separate** issues with repro steps (not only comments on this issue).

---

## Acceptance criteria — indexer smoke

- [ ] `curl -s "http://127.0.0.1:<INDEXER_PORT>/v1/arena/buys?limit=5"` returns HTTP 200 and JSON (adjust `<INDEXER_PORT>` from stack output).
- [ ] After swarm or manual buys, **buy** rows appear in that response (non-empty `data` / rows as applicable).
- [ ] `curl -s "http://127.0.0.1:<INDEXER_PORT>/v1/arena/timers"` returns four **`podium_deadlines_sec`** when indexer is caught up.
- [ ] Migrations applied; **`GET /v1/arena/*`** routes used by the frontend respond without 5xx ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).
- [ ] Buy and WarBow data are driven from **decoded onchain events** (`Buy`, `PodiumFunded`, `SeedFunded`, `AdminVaultFunded`, WarBow events) — not offchain guesses.

---

## Arena v2 QA checklist (local + release-oriented)

**Scope:** Manual verification for **`TimeArena`** / **`/arena`**, aligned with this repository.  
**Canonical mechanics:** [`docs/product/arena-v2.md`](../product/arena-v2.md), [`contracts/src/arena/TimeArena.sol`](../../contracts/src/arena/TimeArena.sol), [manual-qa-checklists §260](../testing/manual-qa-checklists.md#manual-qa-issue-260).

---

### A. Local full stack (Anvil + indexer + frontend + bots)

**Prerequisites:** Docker, Foundry, `jq`, `curl`, Node/npm, Python 3.11+. On **PEP 668** hosts, install **`bots/timearena`** per [`bots/timearena/README.md`](../../bots/timearena/README.md) before swarm.

- [ ] **A1** — From repo root: `bash scripts/start-local-anvil-stack.sh` — Postgres, Anvil, **`DeployDev`**, indexer, `frontend/.env.local` written.
- [ ] **A1a** — From repo root: **`make check-frontend-env`** — validates Arena v2 **`VITE_*`** (see [e2e-anvil.md](../testing/e2e-anvil.md)).
- [ ] **A2** — Optional: `SKIP_ANVIL_RICH_STATE=1` for live arena + default swarm (see [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)); `START_BOT_SWARM=0` to skip bots.
- [ ] **A3** — `cd frontend && npm ci && npm run dev` — open **`/arena`**. Restart Vite if dev started **before** `frontend/.env.local` existed.
- [ ] **A4** — `bash scripts/sync-bot-env-from-frontend.sh` — **`bots/timearena/.env.local`** aligned with `VITE_*`.
- [ ] **A5** — `cd bots/timearena && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"` — legacy **`timecurve-bot`** / `import web3` works.
- [ ] **A6** — QA wallet: add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=<0x...>`** to **`bots/timearena/.env.local`**; re-run swarm or stack so one-shot funding includes your wallet — same 10k ETH + DOUB mint as swarm bots (Anvil **31337** + **`--allow-anvil-funding`** only).
- [ ] **A7** — Connect browser wallet with the **same** account as A6 — can submit buys / WarBow txs from UI.
- [ ] **A8** — Smoke indexer: `curl -s http://127.0.0.1:<INDEXER_PORT>/v1/arena/buys?limit=5` — JSON rows after activity.

---

### B. TimeArena behavior (contract-aligned)

- [ ] **B1** — **Last Buy** timer: buys extend deadline; hard reset band when remaining &lt; 13 min — match **`ArenaPodiumTimerConfig`** / `TimeArena.sol`.
- [ ] **B2** — Four independent podium timers — Last Buy, Time Booster, Defended Streak, WarBow — see [arena-v2.md § Timers](../product/arena-v2.md#timers-last-buy--four-podiums).
- [ ] **B3** — **`rollPodiumEpoch`**: pays **4∶2∶1** from category **active** DOUB pool; seed → active transfer on roll — **not** legacy `distributePrizes`.
- [ ] **B4** — DOUB buy routing: **40% / 30% / 30%** (active pools / seed pools / admin vault) — [arena-v2.md](../product/arena-v2.md), **not** legacy five-sink percentages.
- [ ] **B5** — WarBow: steal, revenge, guard, flag spend **DOUB**; **`finalizeWarbowPodium`** for epoch payout after roll — confirm in `TimeArena.sol` ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)).
- [ ] **B6** — Play CRED: epoch accrual on DOUB buy; **`claimCred`** after epoch ends; optional **`buyWithCred`** burn path ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268), [#269](https://gitlab.com/PlasticDigits/yieldomega/-/issues/269)).

---

### C. Frontend (`/arena`)

- [ ] **C1** — Four timer chips + countdown / urgency styling.
- [ ] **C2** — CHARM bounds and price display consistent with onchain reads.
- [ ] **C3** — Podium / leaderboard panels for **four** categories; live predictions from **`GET /v1/arena/podiums`** when wired ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)).
- [ ] **C4** — WarBow stats + battle feed (indexer-backed where wired).
- [ ] **C5** — Prize routing / vault transparency matches **40/30/30** Arena split — not legacy five-sink labels.
- [ ] **C6** — **`WalletProfileModal`** from participant addresses ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258)); **`ArenaCharmCredCard`** CRED claim UX ([#257](https://gitlab.com/PlasticDigits/yieldomega/-/issues/257)).

---

### References

- [`docs/testing/e2e-anvil.md`](../testing/e2e-anvil.md) — `VITE_*` table, Playwright Anvil E2E, legacy alias notes
- [`docs/testing/manual-qa-checklists.md` §260](../testing/manual-qa-checklists.md#manual-qa-issue-260) — condensed Arena v2 pass criteria
- [`docs/product/arena-v2.md`](../product/arena-v2.md) — timers, podiums, DOUB routing, CRED/XP
- [`skills/README.md`](../../skills/README.md) — participant play skills
- [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) — contributor guardrails
- [`bots/timearena/README.md`](../../bots/timearena/README.md) — swarm, env vars, PEP 668
- [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) — stack env toggles
- [`scripts/check-frontend-vite-env.sh`](../../scripts/check-frontend-vite-env.sh) — invoked by **`make check-frontend-env`**
