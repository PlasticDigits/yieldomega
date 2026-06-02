# Agent instructions (Yieldomega)

Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md). Phased work: [`docs/agent-phases.md`](docs/agent-phases.md).

## Cursor Cloud specific instructions

### Bootstrap (dependencies only)

After clone or pull, refresh submodules and frontend packages:

```bash
bash scripts/bootstrap-dev.sh
```

This runs `git submodule update --init --recursive` and `npm ci` in `frontend/`. It does **not** install Foundry, Docker, or Rust.

### Toolchain expectations on Cloud VMs

| Tool | Notes |
|------|--------|
| **Foundry** | Install via [foundryup](https://book.getfoundry.sh/getting-started/installation); binaries live under `~/.foundry/bin` (add to `PATH`). |
| **Rust** | Indexer needs **Cargo ≥ 1.85** (edition 2024 deps). Cloud image may provide `/usr/local/cargo/env` — `source` it before `cargo` in `indexer/`. Ubuntu also needs **`libssl-dev`** and **`pkg-config`** for `openssl-sys`. |
| **Docker** | Full-stack QA uses container `yieldomega-pg` ([`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh)). On some Cloud VMs, `dockerd` must be started manually and the socket may need `sudo chmod 666 /var/run/docker.sock` for the dev user. Storage driver `fuse-overlayfs` is common in nested VMs. |
| **Node** | `npm ci` in `frontend/` (lockfile: `package-lock.json`). |

### Running the full local product stack

Single entrypoint (Postgres + Anvil + DeployDev + indexer + optional Vite):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
source /usr/local/cargo/env 2>/dev/null || true

SKIP_ANVIL_RICH_STATE=1 \
YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 \
START_BOT_SWARM=0 \
bash scripts/start-qa-local-full-stack.sh --live-sale --no-swarm
```

- **RPC:** `http://127.0.0.1:8545` (chain id `31337`)
- **Indexer:** `http://127.0.0.1:3100` — smoke: `curl -sf http://127.0.0.1:3100/v1/status`
- **Frontend:** `http://127.0.0.1:5173` — primary route **`/arena`**

Stack-only (no Vite): add `--no-frontend`, then `cd frontend && npm run dev` after `frontend/.env.local` exists.

See [`docs/testing/qa-local-full-stack.md`](docs/testing/qa-local-full-stack.md) and [`scripts/qa/README.md`](scripts/qa/README.md).

### Cloud agent verification (when to run what)

Use the **smallest** check that proves your change. Do **not** require Docker, Postgres, or Vite unless the task touches those layers.

| Situation | Run | Notes |
|-----------|-----|--------|
| Scripts touching **Anvil deploy**, **`KEY_EVM_*`**, **dev wallet seeding**, or **`anvil_deploy_dev.sh`** | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh` | Foundry only: fresh Anvil → `DeployDev` → seed `KEY_EVM_1..3` (ETH + DOUB + CRED + mock CL8Y). No Docker. |
| Contract / deploy script changes (broader) | `cd contracts && forge test` | Skip gitignored `doub.csv` fork tests if missing. |
| Indexer changes | `cd indexer && cargo clippy --all-targets -- -D warnings && cargo test` | |
| Frontend changes | `cd frontend && npm run typecheck && npm run lint && npm test` | |
| Browser E2E / Playwright | `bash scripts/e2e-anvil.sh` | Needs Anvil stack or script-managed Anvil; see [`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md). |
| Full product stack (indexer ingest, `/arena` UI) | `bash scripts/start-qa-local-full-stack.sh …` | Docker + Rust + optional Vite — only when acceptance criteria need indexer/UI. |
| Security review of **local dev keys** | Same as row 1 + confirm keys are **Anvil defaults only** and documented in [`scripts/lib/evm_dev_keys.sh`](scripts/lib/evm_dev_keys.sh) | Never use dev keys on public networks. |

**MR / issue checklist:** For each touched layer, add one row: *item → command → PASS/FAIL*. If on-chain seeding is in scope, `verify-evm-dev-wallet-seed-anvil.sh` must be **PASS** before merge (not “skipped — needs Docker”).

`REUSE_ANVIL=1` reuses a listener on `ANVIL_PORT` (default `8545`) when the stack is already up.

### Lint / test / build (by package)

| Package | Directory | Commands |
|---------|-----------|----------|
| Contracts | `contracts/` | `forge test` — four `DoubAirdropMegaethFork` tests require gitignored `airdrop/doub.csv` and fail without it; all other tests should pass. |
| Indexer | `indexer/` | `cargo clippy --all-targets -- -D warnings` · `cargo test` |
| Frontend | `frontend/` | `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` |
| Playwright (Anvil) | repo root | `bash scripts/e2e-anvil.sh` (needs stack or script-managed Anvil) |

CI mapping: [`docs/testing/ci.md`](docs/testing/ci.md).

### Hot reload caveats

- **`frontend/.env.local`** is written by the Anvil stack; **restart Vite** if you change it after `npm run dev` is already running.
- Indexer reads env at process start; restart indexer after registry/RPC changes.

### Cloud agent bootstrap (Playwright + Rabby)

On each Cloud Agent boot, [`.cursor/environment.json`](.cursor/environment.json) runs:

```bash
bash scripts/bootstrap-dev.sh && bash scripts/bootstrap-cloud-agent.sh
```

That installs **Playwright Chromium** (`cd frontend && npx playwright install chromium`; on Linux also `npx playwright install-deps chromium` when available) and, when permitted, the **Rabby** unpacked extension plus dev wallet import.

Browsers land under `~/.cache/ms-playwright/`. Automated Playwright E2E uses the wagmi **mock** connector ([`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md)), not a browser extension — Playwright does not load Rabby by default. Rabby is for **Desktop / manual QA** with a real extension.

| Item | Details |
|------|---------|
| **Dev keys** | `KEY_EVM_1`, `KEY_EVM_2`, `KEY_EVM_3` — default to Foundry Anvil accounts **#0–#2** (override via Cursor Cloud secrets). Addresses: `source scripts/lib/evm_dev_keys.sh` → `ADDR_EVM_*`. |
| **Rabby install** | `sudo bash scripts/install-browser-extensions.sh` (once per VM/snapshot) → `/opt/cursor/browser-extensions/rabby` |
| **Rabby import** | `node scripts/setup-rabby-dev-wallets.mjs` (from `frontend/` so Playwright resolves); password `RABBY_DEV_PASSWORD` (default `YieldomegaDevOnly1!`, **local only**). Manual fallback: `bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena` |
| **On-chain seed** | After `DeployDev`, [`scripts/seed-evm-dev-wallets-anvil.sh`](scripts/seed-evm-dev-wallets-anvil.sh) funds all three addresses with **ETH + DOUB + CRED + mock CL8Y** (via [`scripts/lib/anvil_deploy_dev.sh`](scripts/lib/anvil_deploy_dev.sh) when `YIELDOMEGA_SEED_EVM_DEV_WALLETS=1`, default). Verify: `bash scripts/verify-evm-dev-wallet-seed-anvil.sh`. |

**Never use Anvil dev keys on a public network.**

### Rabby extension (manual / Desktop browser QA)

Install unpacked extension once per VM (or snapshot):

```bash
sudo bash scripts/install-browser-extensions.sh
```

Launch Chrome with Rabby + a persistent profile:

```bash
bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena
```

- Extension path: `/opt/cursor/browser-extensions/rabby`
- Profile: `/opt/cursor/chrome-profile-rabby` (wallet state persists here across launches; **not** in git)

Import an Anvil private key in Rabby (chain **31337**) for real signing against the local stack. The Cursor **Desktop** pane may use a separate Chrome profile — use the launch script when you need Rabby specifically.
