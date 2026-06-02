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
