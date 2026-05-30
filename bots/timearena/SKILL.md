---
name: yieldomega-timearena-bot
description: Work on the TimeArena Python bot under bots/timearena — env-based RPC, Anvil-first workflows, no offchain game authority.
---

# TimeArena bot (`bots/timearena`)

Use this skill when editing or running the **`timecurve-bot`** package (Arena v2 client for `TimeArena`).

Renamed from `bots/timecurve/` in GitLab [#245](https://gitlab.com/PlasticDigits/yieldomega/-/issues/245). Play skills: [`skills/README.md`](../../skills/README.md).

## Authority and scope

- **Contracts are authoritative.** The bot reads onchain state via `web3.py` and may submit **normal** contract calls (`buy`, etc.). It does **not** re-implement arena rules as a parallel simulator.
- Product semantics: [`docs/product/time-arena.md`](../../docs/product/time-arena.md), [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md). Invariants: [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md#arena-v2-play-skills-gitlab-245).
- This tree is **contributor tooling**, not a “play” skill. Play-oriented agent guidance lives under root `skills/` and Phase 20 in `docs/agent-phases.md`.

## Environment

- Required: `YIELDOMEGA_RPC_URL` (or `RPC_URL`), `YIELDOMEGA_CHAIN_ID`, `YIELDOMEGA_TIME_ARENA_ADDRESS` (legacy alias `YIELDOMEGA_TIMECURVE_ADDRESS`).
- DOUB token: `YIELDOMEGA_ACCEPTED_ASSET_ADDRESS` or read `TimeArena.doub()`.
- **`YIELDOMEGA_TIME_ARENA_ADDRESS`** must be the **ERC1967 proxy** from `DeployDev`, not the implementation row in `run-latest.json`.
- **Sending txs:** CLI `--send` **or** `YIELDOMEGA_SEND_TX=1` with `YIELDOMEGA_DRY_RUN=0`, plus `YIELDOMEGA_PRIVATE_KEY`.
- **Anvil dev funding:** `--allow-anvil-funding` or `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1` only for **`swarm`** one-shot ETH + DOUB mint on `YIELDOMEGA_CHAIN_ID=31337`.

## Local Anvil workflow

1. From repo root: `bash scripts/anvil-export-bot-env.sh` or `bash scripts/sync-bot-env-from-frontend.sh` → `bots/timearena/.env.local`.
2. `cd bots/timearena && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"`.
3. `.venv/bin/timecurve-bot inspect` (reads only).

## Testing

- Unit tests: `pytest` in `bots/timearena/` (no chain).
