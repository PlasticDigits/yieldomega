# Yieldomega QA shared host

Manual frontend QA against **Anvil + indexer running on a QA server**, with **SSH port forwards** to your laptop and **Vite running locally**. Services listen on **127.0.0.1** on the server so only **SSH** needs to be exposed to the internet.

## On the QA server

**One-time:** Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Rust toolchain (indexer builds with `cargo`).

**Each bring-up:**

```bash
make start-qa
# alias:
make qa-start
```

This runs `scripts/qa/stop-qa.sh` (clean slate), then `scripts/start-local-anvil-stack.sh` with a **fixed indexer port** (see `scripts/qa/qa-host.env`, default `3100`). It writes **`.deploy/local.env`** for `scp` to laptops.

**Stop:**

```bash
make stop-qa
```

This stops Anvil and the indexer and **removes** the Postgres container so the next `start-qa` recreates it bound to **127.0.0.1** only (avoids legacy `0.0.0.0` Docker publishes).

**Check:**

```bash
make status
```

**Optional repo-root `.env`** on the server: `QA_SSH_HOST` (hostname as seen from your laptop), `QA_SSH_PORT` if not 22. Overrides for ports: `ANVIL_PORT`, `INDEXER_PORT`, `PG_HOST_PORT`, `DOCKER_PG` (same vars as the local stack script).

## On your laptop

After `make start-qa` succeeds on the server:

1. **SSH forwards** — run the `ssh -4 -N ...` block from **`make qa-tunnel-help`** (or the end of `start-qa`). Keep that terminal open.
2. **`scp`** — `.deploy/local.env` from the server into your clone:  
   `scp user@host:/path/to/yieldomega/.deploy/local.env .deploy/local.env`
3. **Frontend env** — `./scripts/qa/write-frontend-env-local.sh`  
   (URLs-only without addresses: `./scripts/qa/write-frontend-env-local.sh --urls-only`)
4. **Vite** — `cd frontend && npm ci && npm run dev` — open the URL Vite prints. **Do not** tunnel the Vite port; run the dev server only on the laptop.

Reprint tunnel steps anytime: **`make qa-tunnel-help`** (on server or laptop clone).

## Local stack without QA Makefile

For an all-local laptop setup (no QA host), use:

```bash
bash scripts/start-local-anvil-stack.sh
```

That script may pick a free indexer port if `QA_USE_FIXED_INDEXER_PORT` is not set.
