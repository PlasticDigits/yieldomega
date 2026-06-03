# Agent instructions (Yieldomega)

Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md). Phased work: [`docs/agent-phases.md`](docs/agent-phases.md).

## Cursor Cloud specific instructions

### Bootstrap (dependencies only)

After clone or pull, run the full Cloud Agent bootstrap (also in [`.cursor/environment.json`](.cursor/environment.json)):

```bash
bash scripts/bootstrap-dev.sh
bash scripts/bootstrap-cloud-vm-toolchain.sh
bash scripts/bootstrap-cloud-postgres-native.sh
bash scripts/bootstrap-cloud-agent.sh
```

- **`bootstrap-dev.sh`** — `git submodule update --init --recursive` and `npm ci` in `frontend/`.
- **`bootstrap-cloud-vm-toolchain.sh`** — Foundry (`foundryup`), Rust ≥ 1.85, `libssl-dev` / `pkg-config`, Docker (`fuse-overlayfs` with **vfs** fallback), **glab** + `GITLAB_TOKEN`, `xvfb-run`; also invokes native Postgres bootstrap when Docker is unavailable ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)).
- **`bootstrap-cloud-postgres-native.sh`** — **PostgreSQL 16** on host port **5433**, **`postgresql-client`** (`psql`), **`yieldomega`** role with **`CREATEDB`**, app + test databases (idempotent; primary indexer path without Docker).
- **`bootstrap-cloud-agent.sh`** — Playwright Chromium, Rabby extension, automated import of **`KEY_EVM_1..3`**.

Smoke-check everything: `bash scripts/verify-cloud-vm-toolchain.sh` (includes **`bash scripts/verify-cloud-postgres.sh`**).

### Toolchain expectations on Cloud VMs

| Tool | Notes |
|------|--------|
| **Foundry** | Install via [foundryup](https://book.getfoundry.sh/getting-started/installation); binaries live under `~/.foundry/bin` (add to `PATH`). |
| **Rust** | Indexer needs **Cargo ≥ 1.85** (edition 2024 deps). Cloud image may provide `/usr/local/cargo/env` — `source` it before `cargo` in `indexer/`. Ubuntu also needs **`libssl-dev`** and **`pkg-config`** for `openssl-sys`. |
| **Docker** | Full-stack QA uses container `yieldomega-pg` ([`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh)). [`scripts/bootstrap-cloud-vm-toolchain.sh`](scripts/bootstrap-cloud-vm-toolchain.sh) configures **`fuse-overlayfs`** in `/etc/docker/daemon.json`, starts **`dockerd`** when systemd cannot, and sets **`/var/run/docker.sock`** permissions (`chmod 666` / `docker` group). If `docker run` still fails (overlay mount errors), the bootstrap script retries with storage driver **`vfs`**. If Docker remains broken, use **native Postgres** below. |
| **glab** | Installed by `bootstrap-cloud-vm-toolchain.sh`. Requires Cursor secret **`GITLAB_TOKEN`**. Sets `remote.origin_url` to **`PlasticDigits/yieldomega`** (namespace/repo — **not** a `https://…/*.git` URL; that suffix breaks `glab mr create` with 404). Verify: `glab auth status` · `glab mr list --per-page 1`. |
| **Node** | `npm ci` in `frontend/` (lockfile: `package-lock.json`). |

### Postgres without Docker (`yieldomega-pg`)

Preferred local path is the **`yieldomega-pg`** container from [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh). On Cloud VMs where Docker is unavailable or `docker run` fails (common: `overlay` / `fuse-overlayfs` mount errors in nested VMs), use **native PostgreSQL 16** on the host with the same connection settings the stack scripts expect ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)).

| Setting | Default |
|---------|---------|
| Host / port | `127.0.0.1` **`5433`** (`PG_HOST_PORT` in stack scripts) |
| User / password | `yieldomega` / `password` |
| App database | `yieldomega_indexer` |
| Integration tests | `yieldomega_indexer_test` (`YIELDOMEGA_PG_TEST_URL`) |
| `DATABASE_URL` | `postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer` |

**Automated setup (Cloud Agent / Ubuntu):**

```bash
bash scripts/bootstrap-cloud-postgres-native.sh
bash scripts/verify-cloud-postgres.sh
```

Invariants: **`INV-CLOUD-287-NATIVE-PG`**, **`INV-CLOUD-287-PSQL-CLIENT`**, **`INV-CLOUD-287-CREATEDB`** — [invariants §287](docs/testing/invariants-and-business-logic.md#cloud-agent-native-postgres-gitlab-287).

**Why `CREATEDB`:** [`scripts/verify-podium-live-anvil.sh`](scripts/verify-podium-live-anvil.sh), [`scripts/verify-vault-funding-anvil.sh`](scripts/verify-vault-funding-anvil.sh), and the stack script reset the app DB by running `DROP DATABASE` / `CREATE DATABASE` as **`yieldomega`** over `psql` (not `docker exec`). Without `CREATEDB`, those steps fail with `permission denied to create database`. `verify-cloud-postgres.sh` includes a CREATEDB smoke probe.

**Manual fallback** (non-idempotent DB recreate; use only when the bootstrap script cannot run): expand the historical `sudo apt-get` / `pg_ctlcluster` steps in [GitLab #287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287) or prior `AGENTS.md` revisions.

**Port conflicts:** if something else already listens on `5433`, either free that port or set `PG_HOST_PORT` and `DATABASE_URL` consistently when starting the stack and running verify scripts.

**What works without Docker:** Arena/indexer verify scripts (`bash scripts/verify-podium-live-anvil.sh`, `verify-vault-funding-anvil.sh`, `verify-wallet-profile-anvil.sh`, …) and `cargo test --test integration_stage2` with `YIELDOMEGA_PG_TEST_URL` — they use host `psql` and `DATABASE_URL` only.

**Full product stack:** [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh) still boots Postgres via **`docker run yieldomega-pg`** and `docker exec … pg_isready`; it will **not** succeed on a VM with a broken Docker daemon even if native Postgres is already listening on `:5433`. On those VMs, either restore Docker (`fuse-overlayfs` in `/etc/docker/daemon.json` is often enough) or run Anvil + DeployDev + indexer with the same env vars the stack script exports, after native Postgres is ready.

Example indexer-focused smoke (own Anvil on **8546**, indexer on **3101**):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
source /usr/local/cargo/env 2>/dev/null || true
bash scripts/verify-podium-live-anvil.sh
```

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
| **Postgres / indexer DB** on Cloud VM (native or Docker) | `bash scripts/verify-cloud-postgres.sh` | PASS: `psql` on PATH, `pg_isready`, `SELECT 1`, **`yieldomega` CREATEDB**. SKIP Docker when native passes ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)). Bootstrap: `bash scripts/bootstrap-cloud-postgres-native.sh`. |
| Scripts touching **Anvil deploy**, **`KEY_EVM_*`**, **dev wallet seeding**, or **`anvil_deploy_dev.sh`** | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh` | Foundry only: fresh Anvil → `DeployDev` → seed `KEY_EVM_1..3` (ETH + DOUB + CRED + mock CL8Y). No Docker. |
| Contract / deploy script changes (broader) | `cd contracts && forge test` | Skip gitignored `doub.csv` fork tests if missing. |
| Indexer changes | `cd indexer && cargo clippy --all-targets -- -D warnings && cargo test` | Arena buys + wallet profile: `bash scripts/verify-wallet-profile-anvil.sh` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)) |
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
bash scripts/bootstrap-dev.sh && bash scripts/bootstrap-cloud-vm-toolchain.sh && bash scripts/bootstrap-cloud-agent.sh
```

That installs **Playwright Chromium** (`cd frontend && npx playwright install chromium`; on Linux also `npx playwright install-deps chromium` when available) and, when permitted, the **Rabby** unpacked extension plus dev wallet import.

Browsers land under `~/.cache/ms-playwright/`. Automated Playwright E2E uses the wagmi **mock** connector ([`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md)), not a browser extension — Playwright does not load Rabby by default. Rabby is for **Desktop / manual QA** with a real extension.

| Item | Details |
|------|---------|
| **Dev keys** | `KEY_EVM_1`, `KEY_EVM_2`, `KEY_EVM_3` — default to Foundry Anvil accounts **#0–#2** (override via Cursor Cloud secrets). Addresses: `source scripts/lib/evm_dev_keys.sh` → `ADDR_EVM_*`. |
| **Rabby install** | `sudo bash scripts/install-browser-extensions.sh` (once per VM/snapshot) → `/opt/cursor/browser-extensions/rabby` |
| **Rabby import** | `node scripts/setup-rabby-dev-wallets.mjs` (from `frontend/` so Playwright resolves); password `RABBY_DEV_PASSWORD` (default `YieldomegaDevOnly1!`, **local only**). Manual fallback: `bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena` |
| **On-chain seed** | After `DeployDev`, [`scripts/seed-evm-dev-wallets-anvil.sh`](scripts/seed-evm-dev-wallets-anvil.sh) funds all three addresses with **ETH + DOUB + CRED + mock CL8Y** (via [`scripts/lib/anvil_deploy_dev.sh`](scripts/lib/anvil_deploy_dev.sh) when `YIELDOMEGA_SEED_EVM_DEV_WALLETS=1`, default). Minter key follows **`PRIVATE_KEY`** (DeployDev broadcaster), not **`KEY_EVM_1`** ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)). Verify: `bash scripts/verify-evm-dev-wallet-seed-anvil.sh`. |

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
