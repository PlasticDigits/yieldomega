## Summary

Onboarding task for a new QA engineer: run the full local YieldOmega stack (infra, frontend, bot swarm), fund a **personal test wallet** on Anvil alongside bots, and execute the TimeCurve verification checklist.

**Checklist (in-repo):** [`docs/qa/YO-TimeCurve-QA-Checklist.md`](docs/qa/YO-TimeCurve-QA-Checklist.md)  
**On default branch (after merge):** https://gitlab.com/PlasticDigits/yieldomega/-/blob/main/docs/qa/YO-TimeCurve-QA-Checklist.md

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

This brings up Postgres, Anvil, deploys `DeployDev`, runs the indexer, and writes `frontend/.env.local` (chain `31337`, contract addresses, indexer URL). See the script header in [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh) for:

- `SKIP_ANVIL_RICH_STATE=1` — skip prefilled “rich” chain state so the TimeCurve sale stays **live** for demos (default `START_BOT_SWARM=1` in that mode).
- `START_BOT_SWARM=0` — skip automatic swarm if you only want infra.

Start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open the printed URL (typically `http://127.0.0.1:5173`).

**Vite env:** Build-time `VITE_*` variables are documented in [`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md) (table). The stack script already writes `frontend/.env.local`.

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

Details: [`bots/timecurve/README.md`](bots/timecurve/README.md).

---

## 4. Verify frontend workflows

Use the checklist in [`docs/qa/YO-TimeCurve-QA-Checklist.md`](docs/qa/YO-TimeCurve-QA-Checklist.md) — sections **A** (local stack), **C** (frontend), **D** (indexer). Connect the wallet whose address you put in `YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES` so you have CL8Y + ETH on Anvil for buys and WarBow actions.

---

## 5. External spec note

The older [ecosystem-qa verification spec v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) incorrectly described four reserve podium categories including WarBow. **Canonical:** three reserve podium categories; WarBow is PvP BP — see checklist **Delta** section and [`docs/product/primitives.md`](docs/product/primitives.md).

---

## Acceptance criteria

- [ ] Local stack runs without errors; frontend loads against local RPC.
- [ ] `YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES` set; QA wallet funded after swarm (ETH + mock CL8Y on Anvil).
- [ ] TimeCurve page exercised per in-repo checklist; indexer smoke OK.
- [ ] Any defects filed as separate issues with repro steps.
