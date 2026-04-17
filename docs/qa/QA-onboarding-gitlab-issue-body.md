## Summary

Onboarding task for a new QA engineer: run the full local YieldOmega stack (infra, frontend, bot swarm), fund a **personal test wallet** on Anvil alongside bots, and complete the TimeCurve verification checklist below (copied from the repository).

---

## Prerequisites

Install on the machine:

- **Docker** (Postgres for indexer)
- **Foundry** — `anvil`, `forge`, `cast` on `PATH`
- **jq**, **curl**
- **Node.js** + npm (frontend)
- **Python 3.11+** (TimeCurve bots)

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

This brings up Postgres, Anvil, deploys `DeployDev`, runs the indexer, and writes `frontend/.env.local` (chain `31337`, contract addresses, indexer URL). See the script header in [`scripts/start-local-anvil-stack.sh`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/scripts/start-local-anvil-stack.sh) for:

- `SKIP_ANVIL_RICH_STATE=1` — skip prefilled “rich” chain state so the TimeCurve sale stays **live** for demos (default `START_BOT_SWARM=1` in that mode).
- `START_BOT_SWARM=0` — skip automatic swarm if you only want infra.

Start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open the printed URL (typically `http://127.0.0.1:5173`).

**Vite env:** Build-time `VITE_*` variables are documented in [`docs/testing/e2e-anvil.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/testing/e2e-anvil.md) (table). The stack script already writes `frontend/.env.local`.

---

## 2. Bot env + QA wallet “airdrop” (Anvil only)

Sync bot env from the frontend file (RPC + addresses):

```bash
bash scripts/sync-bot-env-from-frontend.sh
```

Install the TimeCurve bot package:

```bash
cd bots/timecurve
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Edit **`bots/timecurve/.env.local`** (gitignored). Add your **browser test wallet address** (MetaMask or similar) so it receives the same one-shot funding as swarm bots:

```bash
# Comma-separated 0x addresses only — never commit private keys.
YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=0xYourAddressHere
```

Also ensure Anvil funding is allowed when running swarm (the local stack sets this when it spawns swarm):

- `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`
- `YIELDOMEGA_CHAIN_ID=31337`

**Security:** Only **addresses** belong in shared docs; private keys stay local.

---

## 3. Start the swarm (if not already started by the stack)

If you used `SKIP_ANVIL_RICH_STATE=1`, the stack may already have started the swarm. Otherwise, from repo root with env loaded:

```bash
set -a && source bots/timecurve/.env.local && set +a
export YIELDOMEGA_ALLOW_ANVIL_FUNDING=1
cd bots/timecurve && .venv/bin/timecurve-bot --allow-anvil-funding swarm
```

Details: [`bots/timecurve/README.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/bots/timecurve/README.md).

---

## 4. External spec note

The older [ecosystem-qa verification spec v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) incorrectly described four reserve podium categories including WarBow. **Canonical:** three reserve podium categories; WarBow is PvP BP — see the checklist section below (“Delta vs ecosystem-qa”) and [`docs/product/primitives.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md).

---

## Acceptance criteria — setup and TimeCurve page

### Tooling and repository

- [ ] Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+ available.
- [ ] Repository cloned and up to date (`main` or assigned branch).

### Local stack (infra)

- [ ] `bash scripts/start-local-anvil-stack.sh` completes without fatal errors.
- [ ] Postgres container is running; Anvil responds on the expected RPC port (default `8545`).
- [ ] Contracts deployed; `frontend/.env.local` exists with `VITE_CHAIN_ID=31337` and contract addresses.
- [ ] Indexer process is listening (note printed `INDEXER_PORT`, often `3100`).

### Frontend

- [ ] `cd frontend && npm ci && npm run dev` succeeds.
- [ ] App opens in the browser (e.g. `http://127.0.0.1:5173`).
- [ ] Wallet / network pointed at local Anvil (`http://127.0.0.1:8545`, chain `31337`).
- [ ] **TimeCurve** page loads without a hard error (blank screen or unhandled exception).

### Bots, swarm, and QA wallet

- [ ] `bash scripts/sync-bot-env-from-frontend.sh` run so `bots/timecurve/.env.local` matches frontend RPC and addresses.
- [ ] `cd bots/timecurve && pip install -e ".[dev]"` (or `.venv`) succeeds; `timecurve-bot --help` works.
- [ ] `YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES` set in `bots/timecurve/.env.local` to the **same** address(es) you use in the browser (**0x only**, no private keys in shared files).
- [ ] Swarm has run with Anvil funding: either the stack started it (`SKIP_ANVIL_RICH_STATE=1` path) **or** you ran `timecurve-bot --allow-anvil-funding swarm` manually **or** you intentionally skipped swarm (`START_BOT_SWARM=0`) and documented why.
- [ ] After funding: QA wallet shows sufficient **native ETH** on Anvil for gas (same dev top-up as swarm bots).
- [ ] After funding: QA wallet shows **mock CL8Y** (accepted asset) balance for buys and WarBow burns.
- [ ] Browser wallet is connected to the dapp and matches `YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`.

### TimeCurve page (smoke during onboarding)

- [ ] Timer / sale state visible on TimeCurve page.
- [ ] At least one interaction attempted with QA-funded wallet (e.g. connect, read balances, or a test tx as appropriate).

### Process

- [ ] Defects filed as **separate** issues with repro steps (not only comments on this issue).

---

## Acceptance criteria — indexer smoke

- [ ] `curl -s "http://127.0.0.1:<INDEXER_PORT>/v1/timecurve/buys?limit=5"` returns HTTP 200 and JSON (adjust `<INDEXER_PORT>` from stack output).
- [ ] After swarm or manual buys, **buy** rows appear in that response (non-empty `data` / rows as applicable).
- [ ] Migrations applied; `/v1/timecurve/*` routes used by the frontend respond without 5xx.
- [ ] Buy and WarBow data are driven from **decoded events**; ambush / streak-break come from **`Buy` event fields**, not offchain guesses.

---

## TimeCurve QA checklist

### YieldOmega — TimeCurve QA checklist (local + release-oriented)

**Scope:** Manual and semi-automated verification for TimeCurve, aligned with this repository.  
**Canonical mechanics:** [`docs/product/primitives.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md), [`contracts/src/TimeCurve.sol`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/contracts/src/TimeCurve.sol), [`docs/onchain/fee-routing-and-governance.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/onchain/fee-routing-and-governance.md), [`contracts/PARAMETERS.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/contracts/PARAMETERS.md).

---

#### Delta vs PlasticDigits/cl8y-ecosystem-qa (GitLab spec v2.0)

The external [YO-TimeCurve-Verification-Spec.md v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) and [YO-TimeCurve-Release-Checklist.md v1.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Release-Checklist.md) are **partly outdated** for:

1. **Podium categories:** There are **three** reserve podium categories in `TimeCurve` (**last buy**, **time booster**, **defended streak**). **WarBow** is **Battle Points / PvP** and **not** a fourth reserve prize slice. The **WarBow Ladder** top-3 is display-only (`warbowLadderPodium()`), not paid from `PodiumPool`.
2. **`distributePrizes`:** Splits the **accepted asset balance** held by **`PodiumPool`** at call time: **50% / 25% / 25%** across those three categories (see `TimeCurve.distributePrizes()`), with **4∶2∶1** within each category. This is **not** the same as **buy-time** `FeeRouter` routing (see fee-routing doc).
3. **Buy-time fee routing** (canonical launch default): **25%** DOUB locked LP · **35%** CL8Y burn · **20%** podium pool · **0%** team · **20%** Rabbit Treasury — **10 000 bps** total. Do not conflate these percentages with **podium internal** splits.

---

#### A. Local full stack (Anvil + indexer + frontend + bots)

**Prerequisites:** Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+.

- [ ] **A1** — From repo root: `bash scripts/start-local-anvil-stack.sh` — Postgres, Anvil, deploy, indexer, `frontend/.env.local` written.
- [ ] **A2** — Optional: `SKIP_ANVIL_RICH_STATE=1` for live sale + default swarm (see script header) — sale stays active for bots/UI; `START_BOT_SWARM=0` to skip bots.
- [ ] **A3** — `cd frontend && npm ci && npm run dev` — app at `http://127.0.0.1:5173` (or configured port).
- [ ] **A4** — `bash scripts/sync-bot-env-from-frontend.sh` — `bots/timecurve/.env.local` aligned with `VITE_*`.
- [ ] **A5** — `cd bots/timecurve && pip install -e ".[dev]"` (or use `.venv`) — `timecurve-bot` available.
- [ ] **A6** — QA wallet: add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=<0x...>`** to `bots/timecurve/.env.local` (**addresses only**); re-run swarm or stack so one-shot funding includes your wallet — same 10k ETH + mock CL8Y mint as swarm bots (Anvil **31337** + `--allow-anvil-funding` only).
- [ ] **A7** — Connect browser wallet with the **same** account as A6 — can submit buys / WarBow txs from UI.
- [ ] **A8** — Smoke indexer: `curl -s http://127.0.0.1:<INDEXER_PORT>/v1/timecurve/buys?limit=5` — JSON rows after activity.

---

#### B. TimeCurve behavior (contract-aligned)

- [ ] **B1** — Sale lifecycle: buys extend timer; hard reset when remaining &lt; 13 min — match `TIMER_RESET_*` in `TimeCurve.sol`.
- [ ] **B2** — Three podium categories only; **WarBow** BP separate from reserve prizes — see [primitives.md](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md).
- [ ] **B3** — `distributePrizes`: 50/25/25 of **podium pool** balance — not FeeRouter percentages.
- [ ] **B4** — `redeemCharms` after `endSale` — pro-rata DOUB per charm weight.
- [ ] **B5** — WarBow: steal, revenge, guard, flag — gated by `!ended` where applicable — confirm post-end behavior in `TimeCurve.sol` for deployment.

---

#### C. Frontend (TimeCurve page)

- [ ] **C1** — Timer countdown and urgency styling.
- [ ] **C2** — CHARM bounds and price display consistent with contract reads.
- [ ] **C3** — Podium / leaderboard panels for **three** reserve categories.
- [ ] **C4** — WarBow stats + battle feed (indexer-backed where wired).
- [ ] **C5** — Fee sink display matches deployment **FeeRouter**; cross-check `FeeRouter` on chain if labels drift.
- [ ] **C6** — Redeem path after sale end (when stack uses ended state).

---

#### D. Indexer

- [ ] **D1** — Migrations applied; API responds on `/v1/timecurve/*` routes used by frontend.
- [ ] **D2** — Buy and WarBow events decode; no reliance on guessed ambush/streak fields — use `Buy` event fields.

---

#### E. Automation gates (before release candidate)

Run per [`docs/testing/strategy.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/testing/strategy.md):

- [ ] **E1** — Contracts: `cd contracts && forge test` — all green.
- [ ] **E2** — Indexer: `cd indexer && cargo test --lib` (and clippy if required by CI).
- [ ] **E3** — Frontend unit: `cd frontend && npm run test` / `vitest` per project scripts.
- [ ] **E4** — Anvil E2E (optional): `bash scripts/e2e-anvil.sh` (Foundry + Playwright).

---

#### F. Production-oriented (release checklist, condensed)

- [ ] **F1** — Addresses finalized in [`contracts/PARAMETERS.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/contracts/PARAMETERS.md).
- [ ] **F2** — Governance roles verified (admin, params, pauser) per deployment runbook.
- [ ] **F3** — **FeeRouter** weights and destinations match [fee-routing doc](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/onchain/fee-routing-and-governance.md).
- [ ] **F4** — Operations: documented deploy path; rollback/pause contacts; monitor timer, indexer lag, first-buy fee routing.

---

#### References

- [`docs/testing/e2e-anvil.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/testing/e2e-anvil.md) — `VITE_*` table, Playwright
- [`bots/timecurve/README.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/bots/timecurve/README.md) — swarm, env vars
- [`scripts/start-local-anvil-stack.sh`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/scripts/start-local-anvil-stack.sh) — stack env toggles
