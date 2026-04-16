---
name: yieldomega-timecurve-bot
description: Work on the TimeCurve Python bot under bots/timecurve — env-based RPC, Anvil-first workflows, no offchain game authority.
---

# TimeCurve bot (`bots/timecurve`)

Use this skill when editing or running the **`timecurve-bot`** package.

## Authority and scope

- **Contracts are authoritative.** The bot reads onchain state via `web3.py` and may submit **normal** contract calls (`buy`, WarBow, etc.). It does **not** re-implement TimeCurve rules, podiums, or BP logic as a parallel simulator.
- Product semantics (three reserve podiums vs WarBow ladder, timer hard-reset band) are documented in `docs/product/primitives.md`. Keep bot interpretations **thin** — prefer `eth_call` over inferred rules.
- This tree is **contributor tooling**, not a “play” skill. Play-oriented agent guidance lives under root `skills/` and Phase 20 in `docs/agent-phases.md`.

## Repository guardrails

- Read `docs/agent-phases.md` and follow `docs/testing/strategy.md` when changing behavior or docs.
- Default license for new files: **AGPL-3.0** (match repo).
- Do not commit secrets. Use `.env.example` only for templates; real keys stay in gitignored `.env` / `.env.local`.

## Layout

- `src/timecurve_bot/config.py` — env parsing, send/dry-run policy.
- `addresses.py`, `rpc.py`, `contracts.py`, `state.py` — reads and wiring.
- `actions.py` — tx building; `strategies/` — thin orchestration.
- `cli.py` — Typer entrypoint (`timecurve-bot` console script).

## Environment

- Required: `YIELDOMEGA_RPC_URL` (or `RPC_URL`), `YIELDOMEGA_CHAIN_ID`, `YIELDOMEGA_TIMECURVE_ADDRESS`.
- Optional: treasury/NFT/accepted-asset overrides, `YIELDOMEGA_ADDRESS_FILE` for registry JSON.
- **Sending txs:** CLI `--send` **or** `YIELDOMEGA_SEND_TX=1` with `YIELDOMEGA_DRY_RUN=0`, plus `YIELDOMEGA_PRIVATE_KEY`.
- **Anvil dev funding:** `--allow-anvil-funding` or `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1` only for **`swarm`** one-shot ETH + mock CL8Y on `YIELDOMEGA_CHAIN_ID=31337`. Default false (mainnet-safe).

## Local Anvil workflow

1. From repo root: `bash scripts/anvil-export-bot-env.sh` (starts Anvil, runs shared `DeployDev` via `scripts/lib/anvil_deploy_dev.sh`, writes `bots/timecurve/.env.local`).
2. `cd bots/timecurve && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"`
3. `set -a && source .env.local && set +a`
4. `.venv/bin/timecurve-bot inspect` (reads only).
5. For scripted activity: `timecurve-bot --send --allow-anvil-cheat seed-local`.

## Public RPC

- Use a **dedicated wallet** and low limits. Never assume Anvil gas or behavior matches MegaETH; see `docs/testing/e2e-anvil.md`.

## Testing

- Unit tests: `pytest` in `bots/timecurve/` (no chain).
- Integration: manual Anvil + `anvil-export-bot-env.sh` as in README.
