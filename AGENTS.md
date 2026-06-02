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
| **Docker** | Full-stack QA uses container `yieldomega-pg` ([`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh)). On some Cloud VMs, `dockerd` must be started manually and the socket may need `sudo chmod 666 /var/run/docker.sock` for the dev user. Storage driver `fuse-overlayfs` is common in nested VMs. If containers fail to start (overlay mount errors), use **native Postgres** below instead of Docker. |
| **Node** | `npm ci` in `frontend/` (lockfile: `package-lock.json`). |

### Postgres without Docker (`yieldomega-pg`)

Preferred local path is the **`yieldomega-pg`** container from [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh). On Cloud VMs where Docker is unavailable or `docker run` fails (common: `overlay` / `fuse-overlayfs` mount errors in nested VMs), install **PostgreSQL 16 on the host** with the same connection settings the stack scripts expect.

| Setting | Default |
|---------|---------|
| Host / port | `127.0.0.1` **`5433`** (`PG_HOST_PORT` in stack scripts) |
| User / password | `yieldomega` / `password` |
| App database | `yieldomega_indexer` |
| Integration tests | `yieldomega_indexer_test` (`YIELDOMEGA_PG_TEST_URL`) |
| `DATABASE_URL` | `postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer` |

One-time setup (Ubuntu; adjust if your image already runs Postgres on another port):

```bash
sudo apt-get install -y postgresql-16 postgresql-client libssl-dev pkg-config
sudo pg_ctlcluster 16 main start
CONF="$(sudo -u postgres psql -tAc 'SHOW config_file;')"
sudo sed -i 's/^#*port = .*/port = 5433/' "${CONF}"
sudo pg_ctlcluster 16 main restart
sudo -u postgres psql -p 5433 -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'yieldomega') THEN
    CREATE ROLE yieldomega LOGIN PASSWORD 'password' CREATEDB;
  ELSE
    ALTER ROLE yieldomega WITH PASSWORD 'password' CREATEDB;
  END IF;
END $$;
DROP DATABASE IF EXISTS yieldomega_indexer;
CREATE DATABASE yieldomega_indexer OWNER yieldomega;
DROP DATABASE IF EXISTS yieldomega_indexer_test;
CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;
SQL
```

**Why `CREATEDB`:** [`scripts/verify-podium-live-anvil.sh`](scripts/verify-podium-live-anvil.sh), [`scripts/verify-vault-funding-anvil.sh`](scripts/verify-vault-funding-anvil.sh), and the stack script reset the app DB by running `DROP DATABASE` / `CREATE DATABASE` as **`yieldomega`** over `psql` (not `docker exec`). Without `CREATEDB`, those steps fail with `permission denied to create database`.

**Client on PATH:** install **`postgresql-client`** so `psql` is available for the verify scripts and manual checks.

**Port conflicts:** if something else already listens on `5433`, either free that port or set `PG_HOST_PORT` and `DATABASE_URL` consistently when starting the stack and running verify scripts.

**What works without Docker:** Arena/indexer verify scripts (`bash scripts/verify-podium-live-anvil.sh`, `verify-vault-funding-anvil.sh`, …) and `cargo test --test integration_stage2` with `YIELDOMEGA_PG_TEST_URL` — they use host `psql` and `DATABASE_URL` only.

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
| **On-chain seed** | After `DeployDev`, [`scripts/seed-evm-dev-wallets-anvil.sh`](scripts/seed-evm-dev-wallets-anvil.sh) funds all three addresses with **ETH + DOUB + CRED + mock CL8Y** (via [`scripts/lib/anvil_deploy_dev.sh`](scripts/lib/anvil_deploy_dev.sh) when `YIELDOMEGA_SEED_EVM_DEV_WALLETS=1`, default). |

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
