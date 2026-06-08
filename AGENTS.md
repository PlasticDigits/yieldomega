# Agent instructions (Yieldomega)

**This file is `AGENTS.md` at the repository root** — the canonical Cursor Cloud agent runbook. It is **not** a `SKILL.md` file. Play/participant skills live under [`skills/`](skills/README.md); contributor guardrails live under [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md) (read that skill when editing the repo, but start here for VM bootstrap and verification).

Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md). Phased work: [`docs/agent-phases.md`](docs/agent-phases.md).

### Git commits (agents)

**Do not commit as an AI or automation product account** (Cursor, Claude, Codex, Copilot, or similar agent/bot identities). Commits must use a **human dev identity**:

| Environment | Use |
|-------------|-----|
| **Local dev machine** | The developer’s normal `git config user.name` / `user.email` for that checkout |
| **Cloud Agent VM** | **`PlasticDigits`** / **`plasticdigits@protonmail.com`** (set globally by `bootstrap-cloud-vm-toolchain.sh`) |

Bootstrap sets git identity and hooks automatically. Manual override only when debugging:

```bash
bash scripts/bootstrap-cloud-vm-toolchain.sh   # sets PlasticDigits identity + glab + GITLAB_TOKEN
git config core.hooksPath .githooks            # local repo hook path (also set by bootstrap)
```

Use **`glab`** (wrapper on `PATH` via `scripts/bin/glab`) and **`GITLAB_TOKEN`** (Cursor Cloud secret for PlasticDigits) for all GitLab CLI actions — not a separate AI-agent OAuth or bot credential. Never add `Co-authored-by` (or similar) trailers naming AI tools.

**Message body — no emails or attribution.** **Never** put emails, `Co-authored-by:` trailers, or the word **`author`** in a commit message (subject or body). Use a short imperative subject and an optional body with *what* changed and *why* — no attribution lines, no mail addresses, no “written by …” credits.

The **commit-msg** hook rejects subjects with emails/`author` and strips offending body lines ([#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303) hygiene). Do **not** bypass with `YIELDOMEGA_SKIP_COMMIT_MSG_HOOK` except a one-off human-directed emergency.

## Cursor Cloud specific instructions

### Bootstrap (dependencies only)

After clone or pull, run the full Cloud Agent bootstrap (also in [`.cursor/environment.json`](.cursor/environment.json)):

```bash
bash scripts/bootstrap-cloud-install.sh
```

Equivalent steps (do **not** hardcode `/workspace` or `/home/ubuntu` on `PATH` — that can drop `/usr/bin` and break `git` / `npm`):

```bash
bash scripts/bootstrap-dev.sh
bash scripts/bootstrap-cloud-vm-toolchain.sh
bash scripts/bootstrap-cloud-postgres-native.sh
bash scripts/bootstrap-cloud-agent.sh
bash scripts/verify-cloud-vm-toolchain.sh
```

- **`bootstrap-dev.sh`** — `git submodule update --init --recursive` and `npm ci` in `frontend/`.
- **`bootstrap-cloud-vm-toolchain.sh`** — Foundry (`foundryup`), Rust ≥ 1.85, `libssl-dev` / `pkg-config`, **`iproute2`** (`ss` for port checks), Docker (`fuse-overlayfs` with **vfs** fallback), **glab** + `GITLAB_TOKEN`, `xvfb-run`; also invokes native Postgres bootstrap when Docker is unavailable ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)).
- **`bootstrap-cloud-postgres-native.sh`** — **PostgreSQL 16** on host port **5433**, **`postgresql-client`** (`psql`), **`yieldomega`** role with **`CREATEDB`**, app + test databases (idempotent; primary indexer path without Docker).
- **`bootstrap-cloud-agent.sh`** — Playwright Chromium, Rabby extension, automated import of **`KEY_EVM_1..3`**.

Smoke-check everything: `bash scripts/verify-cloud-vm-toolchain.sh` (includes **`bash scripts/verify-cloud-postgres.sh`**; Docker is **SKIP**, not FAIL, when the agent user cannot use the socket — see [#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288)).

### Docker troubleshooting (GitLab [#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288))

**Symptom:** `permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`

| Check | Command |
|-------|---------|
| Diagnose + PASS/FAIL/SKIP | `bash scripts/verify-docker-cloud-agent.sh` |
| Full toolchain (Docker optional) | `bash scripts/verify-cloud-vm-toolchain.sh` |
| Re-apply socket + group fix | `bash scripts/bootstrap-cloud-vm-toolchain.sh` |

**Remediation (in order):**

1. Re-run bootstrap (applies `chmod 666` on `/var/run/docker.sock` and `usermod -aG docker "$USER"`).
2. If `docker info` works but `docker run` fails with permission denied: socket mode is wrong or the agent shell lacks the `docker` group — open a **new** shell after bootstrap, or rely on `chmod 666` (immediate on most VMs).
3. If overlay / `fuse-overlayfs` mount errors persist on nested VMs: bootstrap retries **`vfs`**; see `/tmp/yieldomega-dockerd.log`.
4. **Do not block** Foundry-only or indexer-only tasks on Docker — use **native Postgres** ([§ Postgres without Docker](#postgres-without-docker-yieldomega-pg)). Bootstrap writes `/tmp/yieldomega-docker-unavailable` when the agent user still cannot run containers.

**Strict gate** (full `start-local-anvil-stack` / QA stack only): `YIELDOMEGA_DOCKER_REQUIRED=1 bash scripts/verify-docker-cloud-agent.sh` must exit 0.

Invariants: [`docs/testing/invariants-and-business-logic.md` §288](docs/testing/invariants-and-business-logic.md#cloud-agent-docker-gitlab-288) · library [`scripts/lib/docker_cloud_agent.sh`](scripts/lib/docker_cloud_agent.sh).


### Toolchain expectations on Cloud VMs

| Tool | Notes |
|------|--------|
| **Foundry** | Install via [foundryup](https://book.getfoundry.sh/getting-started/installation); binaries live under `~/.foundry/bin` (add to `PATH`). |
| **Rust** | Indexer needs **Cargo ≥ 1.85** (edition 2024 deps). Cloud image may provide `/usr/local/cargo/env` — `source` it before `cargo` in `indexer/`. Ubuntu also needs **`libssl-dev`** and **`pkg-config`** for `openssl-sys`. |
| **Docker** | **Optional** for most agent work ([#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288)). Required only for `start-local-anvil-stack` / full QA stack (`yieldomega-pg`). [`scripts/bootstrap-cloud-vm-toolchain.sh`](scripts/bootstrap-cloud-vm-toolchain.sh) configures **`fuse-overlayfs`** ( **`vfs`** fallback), starts **`dockerd`**, verifies **`docker run hello-world` as `$USER`**, or writes `/tmp/yieldomega-docker-unavailable` + native Postgres hint. Verify: `bash scripts/verify-docker-cloud-agent.sh`. |
| **glab** | Always on `PATH` (`scripts/bin/glab` wrapper + system binary). **`GITLAB_TOKEN`** (PlasticDigits Cursor secret) is exported at bootstrap and used for **every** `glab` call. Configure: `bootstrap-cloud-vm-toolchain.sh`. Use **`glab`** for issues, MRs, and comments — **not** GitLab MCP or GitHub PR tooling. MR helper: `bash scripts/glab-mr-create.sh --title "…"`. Verify: `bash scripts/verify-cloud-vm-toolchain.sh`. |
| **ss** | From **`iproute2`** — used by [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh) to detect Anvil/indexer ports. Bootstrap installs it; [`scripts/lib/tcp_port.sh`](scripts/lib/tcp_port.sh) falls back to `netstat` or a Python bind probe if missing. |
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

**Full product stack:** [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh) prefers **native Postgres** on `:5433` when `yieldomega` credentials work (`bash scripts/bootstrap-cloud-postgres-native.sh`), then falls back to **`docker run yieldomega-pg`** when Docker is usable. This avoids port conflicts and Docker readiness failures on Cloud VMs ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287) / [#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288)). If both paths fail, run `bash scripts/verify-cloud-postgres.sh` or `bash scripts/verify-docker-cloud-agent.sh`.

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
| **Postgres / indexer DB** on Cloud VM (native or Docker) | `bash scripts/verify-cloud-postgres.sh` | PASS: `psql` on PATH, `pg_isready`, `SELECT 1`, **`yieldomega` CREATEDB**. Bootstrap: `bash scripts/bootstrap-cloud-postgres-native.sh` ([#287](https://gitlab.com/PlasticDigits/yieldomega/-/issues/287)). |
| **Docker** (toolchain / full stack) | `bash scripts/verify-docker-cloud-agent.sh` | **PASS** = non-sudo `docker info` + `hello-world`. **SKIP** = use native Postgres — not a merge blocker for contract/indexer/frontend-only tasks ([#288](https://gitlab.com/PlasticDigits/yieldomega/-/issues/288)). **FAIL** only when `YIELDOMEGA_DOCKER_REQUIRED=1`. |
| Scripts touching **Anvil deploy**, **`KEY_EVM_*`**, **dev wallet seeding**, or **`anvil_deploy_dev.sh`** | `bash scripts/verify-evm-dev-wallet-seed-anvil.sh` | Foundry only: fresh Anvil → `DeployDev` → seed `KEY_EVM_1..3` (ETH + DOUB + CRED + mock CL8Y). No Docker. |
| Contract / deploy script changes (broader) | `cd contracts && forge test` | Skip gitignored `doub.csv` fork tests if missing. |
| Indexer changes | `cd indexer && cargo clippy --all-targets -- -D warnings && cargo test` | Arena buys + wallet profile: `bash scripts/verify-wallet-profile-anvil.sh` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)) |
| Frontend changes | `cd frontend && npm run typecheck && npm run lint && npm test` | Arena display: **`INV-FRONTEND-301-INDEXER-FIRST-DISPLAY`** — no browser RPC mirrors for podiums/timers/sale head when `VITE_INDEXER_URL` set ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)); `indexerFirstDisplay.test.ts` |
| Browser E2E / Playwright | `bash scripts/e2e-anvil.sh` | Needs Anvil stack or script-managed Anvil; see [`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md). |
| Full product stack (indexer ingest, `/arena` UI) | `bash scripts/start-qa-local-full-stack.sh …` | Native or Docker Postgres + Rust + optional Vite — only when acceptance criteria need indexer/UI. |
| **GitLab merge requests** (Cloud agents) | `bash scripts/glab-mr-create.sh --title "…"` | PlasticDigits GitLab — use **`glab`**, not GitHub PR tooling. |
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

### Frontend env files (do not confuse with repo-root `.env`)

| File | Purpose |
|------|---------|
| **`frontend/.env.local`** | **Vite / Anvil stack** — contract addresses, RPC, indexer URL. [`scripts/start-local-anvil-stack.sh`](scripts/start-local-anvil-stack.sh) **merges** stack-managed `VITE_*` keys here (does not delete unrelated lines such as `VITE_E2E_MOCK_WALLET`). |
| **`frontend/.env.example`** | Documented defaults; safe to read, not auto-written. |
| **Repo-root `.env`** | Optional ops secrets (e.g. QA SSH) — **not** used by the Anvil stack or Vite. Do not put Anvil contract addresses here. |

### Hot reload caveats

- **`frontend/.env.local`** is updated by the Anvil stack; **restart Vite** if you change it after `npm run dev` is already running.
- Indexer reads env at process start; restart indexer after registry/RPC changes.

### Cloud agent bootstrap (Playwright + Rabby)

On each Cloud Agent boot, [`.cursor/environment.json`](.cursor/environment.json) runs `bash scripts/bootstrap-cloud-install.sh` (all five bootstrap/verify scripts in order; verify is best-effort).

Do **not** prepend a hardcoded `export PATH="/workspace/scripts/bin:…"` before bootstrap — use `bash scripts/bootstrap-cloud-install.sh` or `yieldomega_prepend_cloud_toolchain_path` from [`scripts/lib/cloud_agent_path.sh`](scripts/lib/cloud_agent_path.sh) so `/usr/bin` stays on `PATH`.

That installs **Playwright Chromium** (`cd frontend && npx playwright install chromium`; on Linux also `npx playwright install-deps chromium` when available) and, when permitted, the **Rabby** unpacked extension plus dev wallet import.

Browsers land under `~/.cache/ms-playwright/`. Automated Playwright E2E uses the wagmi **mock** connector ([`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md)) — it **cannot switch chains**. For **wrong-network** gates ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)), real signing, and full issue/MR verification, use **Rabby** ([`docs/testing/rabby-cloud-agent-qa.md`](docs/testing/rabby-cloud-agent-qa.md) · [`.cursor/skills/rabby-cloud-verification/SKILL.md`](.cursor/skills/rabby-cloud-verification/SKILL.md)).

| Item | Details |
|------|---------|
| **Dev keys** | `KEY_EVM_1`, `KEY_EVM_2`, `KEY_EVM_3` — default to Foundry Anvil accounts **#0–#2** (override via Cursor Cloud secrets). Addresses: `source scripts/lib/evm_dev_keys.sh` → `ADDR_EVM_*`. |
| **Rabby install** | Automatic in `bootstrap-cloud-vm-toolchain.sh` + `bootstrap-cloud-agent.sh` (calls `install-browser-extensions.sh` with sudo). Manual retry: `sudo bash scripts/install-browser-extensions.sh` → `/opt/cursor/browser-extensions/rabby/manifest.json` |
| **Rabby import** | `node scripts/setup-rabby-dev-wallets.mjs` (from `frontend/` so Playwright resolves); password `RABBY_DEV_PASSWORD` (default `YieldomegaDevOnly1!`, **local only**). Manual fallback: `bash scripts/launch-chrome-with-rabby.sh http://127.0.0.1:5173/arena` |
| **Rabby build (no mock)** | `bash scripts/qa/build-frontend-for-rabby.sh` then `npm run preview` — **omit** `VITE_E2E_MOCK_WALLET` |
| **Wrong-network automation** | `bash scripts/verify-rabby-chain-mismatch.sh` (requires Anvil + preview on `:5173`) |
| **On-chain seed** | After `DeployDev`, [`scripts/seed-evm-dev-wallets-anvil.sh`](scripts/seed-evm-dev-wallets-anvil.sh) funds all three addresses with **ETH + DOUB + CRED + mock CL8Y** (via [`scripts/lib/anvil_deploy_dev.sh`](scripts/lib/anvil_deploy_dev.sh) when `YIELDOMEGA_SEED_EVM_DEV_WALLETS=1`, default). Minter key follows **`PRIVATE_KEY`** (DeployDev broadcaster), not **`KEY_EVM_1`** ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)). Verify: `bash scripts/verify-evm-dev-wallet-seed-anvil.sh`. |

**Never use Anvil dev keys on a public network.**

### Rabby extension (Cloud agent + Desktop QA)

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
