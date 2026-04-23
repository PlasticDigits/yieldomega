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

After the stack (or after `scripts/qa/write-frontend-env-local.sh` on a QA laptop), run **`make check-frontend-env`** from repo root to confirm `VITE_TIMECURVE_ADDRESS`, `VITE_FEE_ROUTER_ADDRESS`, and related deploy vars are non-empty. If you started **`npm run dev`** before `frontend/.env.local` existed, **restart** the dev server so Vite reloads `VITE_*`.

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

The older [ecosystem-qa verification spec v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) mixed WarBow with older category sets. **Canonical:** **four** reserve podium categories (**last buy**, **WarBow**, **defended streak**, **time booster**) — see the checklist section below (“Delta vs ecosystem-qa”) and [`docs/product/primitives.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md).

---

## Acceptance criteria — setup and TimeCurve page

### Tooling and repository

- [ ] Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+ available.
- [ ] Repository cloned and up to date (`main` or assigned branch).

### Local stack (infra)

- [ ] `bash scripts/start-local-anvil-stack.sh` completes without fatal errors.
- [ ] Postgres container is running; Anvil responds on the expected RPC port (default `8545`).
- [ ] Contracts deployed; `frontend/.env.local` exists with `VITE_CHAIN_ID=31337` and contract addresses.
- [ ] `frontend/.env.local` includes non-empty **`VITE_TIMECURVE_ADDRESS`** and **`VITE_FEE_ROUTER_ADDRESS`** (or `make check-frontend-env` passes).
- [ ] Indexer process is listening (note printed `INDEXER_PORT`, often `3100`).

### Frontend

- [ ] `cd frontend && npm ci && npm run dev` succeeds (restart dev server if it was started before `frontend/.env.local` was written).
- [ ] App opens in the browser (e.g. `http://127.0.0.1:5173`).
- [ ] Wallet / network pointed at local Anvil (`http://127.0.0.1:8545`, chain `31337`).
- [ ] **TimeCurve** page loads without a hard error (blank screen or unhandled exception).

### Bots, swarm, and QA wallet

- [ ] `bash scripts/sync-bot-env-from-frontend.sh` run so `bots/timecurve/.env.local` matches frontend RPC and addresses.
- [ ] `bots/timecurve` deps installed (venv + `pip install -e ".[dev]"`, or PEP 668 fallback in [`bots/timecurve/README.md`](../../bots/timecurve/README.md)); `timecurve-bot --help` and `import web3` succeed.
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

1. **Podium categories (exactly four, reserve-funded):** Canonical v1 tracks match [`docs/product/primitives.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md) — **last buy**, **WarBow** (top-3 Battle Points / `warbowLadderPodium()` ≡ `podium(CAT_WARBOW)`), **defended streak** (best under-window streak), **time booster** (most effective deadline seconds added). **`distributePrizes`** pays these from **`PodiumPool`** in the **accepted reserve asset (CL8Y at launch)** after `endSale`. **DOUB** is **only** for **`redeemCharms`** (pro-rata by charm weight), **not** podium payouts. Legacy ecosystem-qa category sets (e.g. opening/closing-window podiums) are **removed**.

   | Category | Share of **podium pool** | Share of **gross raise** (podium slice = **20%** of each buy) |
   |----------|--------------------------|----------------------------------------------------------------|
   | Last buy | **40%** | **8%** |
   | WarBow (top BP) | **25%** | **5%** |
   | Defended streak | **20%** | **4%** |
   | Time booster | **15%** | **3%** |

2. **`distributePrizes` internals:** At call time, splits the **accepted asset** balance held by **`PodiumPool`** **40% / 25% / 20% / 15%** across the four rows above (see `TimeCurve.distributePrizes()`). Equivalently **8% / 5% / 4% / 3%** of **gross raise** while the podium **`FeeRouter`** sink remains **20%**. **Within** each category, **1st : 2nd : 3rd** uses **4∶2∶1**. This layer is **not** the same as **buy-time** `FeeRouter` top-level routing ([`docs/onchain/fee-routing-and-governance.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/onchain/fee-routing-and-governance.md)).

3. **Buy-time fee routing** (canonical launch default, **full gross** per buy through `FeeRouter`): **30%** DOUB/CL8Y locked LP · **40%** CL8Y burned · **20%** podium pool (**reserve** prizes; **podium-internal** splits in the table above) · **0%** team · **10%** Rabbit Treasury — **10 000 bps** (**3000 / 4000 / 2000 / 0 / 1000**). Do not conflate these **top-level** percentages with **podium-internal** **40/25/20/15** or placement **4∶2∶1**.

---

#### A. Local full stack (Anvil + indexer + frontend + bots)

**Prerequisites:** Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+. On **PEP 668** hosts, install `bots/timecurve` per that package README before swarm.

- [ ] **A1** — From repo root: `bash scripts/start-local-anvil-stack.sh` — Postgres, Anvil, deploy, indexer, `frontend/.env.local` written.
- [ ] **A1a** — From repo root: `make check-frontend-env` — validates merged `frontend/.env` + `frontend/.env.local` (TimeCurve + FeeRouter + related `VITE_*`).
- [ ] **A2** — Optional: `SKIP_ANVIL_RICH_STATE=1` for live sale + default swarm (see script header) — sale stays active for bots/UI; `START_BOT_SWARM=0` to skip bots.
- [ ] **A3** — `cd frontend && npm ci && npm run dev` — app at `http://127.0.0.1:5173` (or configured port). Restart Vite if you opened dev **before** `frontend/.env.local` was created.
- [ ] **A4** — `bash scripts/sync-bot-env-from-frontend.sh` — `bots/timecurve/.env.local` aligned with `VITE_*`.
- [ ] **A5** — `cd bots/timecurve && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"` (or PEP 668 fallback in that README) — `timecurve-bot` / `import web3` works.
- [ ] **A6** — QA wallet: add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=<0x...>`** to `bots/timecurve/.env.local` (**addresses only**); re-run swarm or stack so one-shot funding includes your wallet — same 10k ETH + mock CL8Y mint as swarm bots (Anvil **31337** + `--allow-anvil-funding` only).
- [ ] **A7** — Connect browser wallet with the **same** account as A6 — can submit buys / WarBow txs from UI.
- [ ] **A8** — Smoke indexer: `curl -s http://127.0.0.1:<INDEXER_PORT>/v1/timecurve/buys?limit=5` — JSON rows after activity.

---

#### B. TimeCurve behavior (contract-aligned)

- [ ] **B1** — Sale lifecycle: buys extend timer; hard reset when remaining &lt; 13 min — match `TIMER_RESET_*` in `TimeCurve.sol`.
- [ ] **B2** — Four podium categories — **WarBow** is reserve-funded; see [primitives.md](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/product/primitives.md).
- [ ] **B3** — `distributePrizes`: **40/25/20/15** of **podium pool** balance — not FeeRouter top-level percentages.
- [ ] **B4** — `redeemCharms` after `endSale` — pro-rata DOUB per charm weight.
- [ ] **B5** — WarBow: steal, revenge, guard, flag — gated by `!ended` where applicable — confirm post-end behavior in `TimeCurve.sol` for deployment.

---

#### C. Frontend (TimeCurve page)

- [ ] **C1** — Timer countdown and urgency styling.
- [ ] **C2** — CHARM bounds and price display consistent with contract reads.
- [ ] **C3** — Podium / leaderboard panels for **four** reserve categories.
- [ ] **C4** — WarBow stats + battle feed (indexer-backed where wired).
- [ ] **C5** — Fee sink display matches deployment **FeeRouter**; cross-check `FeeRouter` on chain if labels drift.
- [ ] **C6** — Redeem path after sale end (when stack uses ended state).

---

#### References

- [`docs/testing/e2e-anvil.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/testing/e2e-anvil.md) — `VITE_*` table, Playwright
- [`scripts/check-frontend-vite-env.sh`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/scripts/check-frontend-vite-env.sh) — verify required `VITE_*` before `npm run dev`
- [`bots/timecurve/README.md`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/bots/timecurve/README.md) — swarm, env vars
- [`scripts/start-local-anvil-stack.sh`](https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/scripts/start-local-anvil-stack.sh) — stack env toggles
