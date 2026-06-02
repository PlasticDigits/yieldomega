# Rabby wallet QA — Cloud agents and verification

Playwright Anvil E2E ([`e2e-anvil.md`](e2e-anvil.md)) uses **`VITE_E2E_MOCK_WALLET=1`** (wagmi **mock** connector). The mock wallet **always reports the build’s `VITE_CHAIN_ID`** and cannot switch to another chain.

For a **full PASS** on acceptance items that require **wrong-network write gating** ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)) — e.g. GitLab [#277](https://gitlab.com/PlasticDigits/yieldomega/-/issues/277) functional path **#7** — Cloud agents **must** use the unpacked **Rabby** extension with a real injected provider.

## When Rabby is required

| Scenario | Mock Playwright | Rabby |
|----------|-----------------|-------|
| RPC reads, `/arena` mount, localStorage prefs (#277 paths 1–6) | Sufficient | Optional |
| Wrong-network overlay blocks buy/approve (#95, #277 path 7) | **Cannot PASS** (partial only) | **Required** |
| Real `approve` / `buy` signing, security review of tx prompts | Partial | **Required** |
| Issue / MR / implementation verification with “manual” wallet steps | Partial | **Required** |

Treat **“PASS (partial)”** on path 7 as **FAIL** for issue sign-off until Rabby verification passes.

## One-time VM setup

```bash
# From repo root (after bash scripts/bootstrap-dev.sh)
sudo bash scripts/install-browser-extensions.sh
bash scripts/bootstrap-cloud-agent.sh   # Playwright + Rabby import (xvfb)
```

| Item | Location / command |
|------|-------------------|
| Extension | `/opt/cursor/browser-extensions/rabby` |
| Chrome profile | `/opt/cursor/chrome-profile-rabby` |
| Dev keys | `KEY_EVM_1..3` → Anvil accounts #0–#2; `source scripts/lib/evm_dev_keys.sh` |
| Rabby password (local only) | `RABBY_DEV_PASSWORD` (default `YieldomegaDevOnly1!`) |
| Import script | `cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs` |

**Headless rule:** Rabby does **not** inject `window.ethereum` in Chromium **headless** mode. Use **`xvfb-run`** or **`DISPLAY=:99`** with **`YIELDOMEGA_RABBY_HEADLESS=0`** (default in `scripts/verify-rabby-chain-mismatch.sh`).

## Stack + frontend (no mock wallet)

```bash
export PATH="$HOME/.foundry/bin:$PATH"

# Infra: Postgres + Anvil + DeployDev + indexer (see qa-local-full-stack.md)
SKIP_ANVIL_RICH_STATE=1 \
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 \
START_BOT_SWARM=0 \
bash scripts/start-qa-local-full-stack.sh --no-swarm --no-frontend

# Build without VITE_E2E_MOCK_WALLET
bash scripts/qa/build-frontend-for-rabby.sh
cd frontend && npm run preview -- --host 127.0.0.1 --port 5173
```

Do **not** set `VITE_E2E_MOCK_WALLET=1` for Rabby verification.

## Automated wrong-network check (path 7 full PASS)

```bash
# Anvil + preview on :5173 must already be up
bash scripts/verify-rabby-chain-mismatch.sh
```

This runs [`scripts/qa/verify-rabby-chain-mismatch.mjs`](../../scripts/qa/verify-rabby-chain-mismatch.mjs) via Playwright + persistent Rabby profile:

1. Wallet on **target chain** (`VITE_CHAIN_ID`, default **31337**) → connect on `/arena` → **no** `.chain-write-gate__overlay`.
2. Switch wallet to **Ethereum mainnet (1)** → **Wrong network** overlay visible; buy CTA disabled when present.
3. Switch back to target chain → overlay cleared.

Override wrong chain: `YIELDOMEGA_RABBY_WRONG_CHAIN_ID=1` (default).

### Profile lock troubleshooting

If Chrome reports `SingletonLock: File exists`:

```bash
# Safe: only kills Chrome using the Rabby profile (do not use bare `pkill -f chrome-profile-rabby`
# — that string can appear in the shell’s own argv and kill the verification script).
pkill -9 -f "user-data-dir=.*/chrome-profile-rabby" 2>/dev/null || true
sleep 1
rm -f /opt/cursor/chrome-profile-rabby/SingletonLock
```

## Manual Rabby QA (Desktop or Cloud with GUI)

```bash
bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena
```

1. Unlock Rabby; ensure **Anvil / chain 31337** (add `http://127.0.0.1:8545` if needed).
2. Connect wallet on `/arena` (RainbowKit → Rabby / MetaMask slot).
3. **ADVANCED** → confirm CL8Y unlimited checkbox (#277 paths 1–6).
4. In Rabby, switch to **Ethereum Mainnet** → confirm **Wrong network** overlay on buy panel; no successful buy/approve.
5. Switch back to **31337** → overlay clears; optional buy smoke.

## Verification loop for agents (issues / MRs / security reviews)

1. **Automated (mock):** `cd frontend && npm test` · `bash scripts/e2e-anvil.sh` · issue-specific `rg` / doc gates.
2. **Rabby (required when issue lists wrong-network, signing, or “manual” wallet paths):**
   - `bash scripts/qa/build-frontend-for-rabby.sh`
   - `bash scripts/verify-rabby-chain-mismatch.sh`
   - Plus issue-specific UI (checkbox, legacy key) via manual Chrome or extended Playwright specs.
3. Record **PASS / FAIL** per path; do not mark #95 / path 7 PASS without Rabby.

See [`.cursor/skills/rabby-cloud-verification/SKILL.md`](../../.cursor/skills/rabby-cloud-verification/SKILL.md).

## Related docs

- [`AGENTS.md`](../../AGENTS.md) — Cloud bootstrap
- [`e2e-anvil.md`](e2e-anvil.md) — mock wallet scope
- [`manual-qa-checklists.md`](manual-qa-checklists.md) — human QA
- [wallet-connection.md §95](../frontend/wallet-connection.md) — `ChainMismatchWriteBarrier`
