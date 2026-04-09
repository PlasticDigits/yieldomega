# TimeCurve bot (`timecurve-bot`)

Python **client** for [TimeCurve](../../contracts/src/TimeCurve.sol): reads authoritative onchain state and optionally submits normal transactions. It does **not** replace contracts or encode a parallel rules engine.

**Anvil ≠ MegaETH:** local Foundry Anvil uses vanilla EVM-style gas and timing. A green run here does **not** prove behavior on MegaETH testnet or mainnet. See [`docs/testing/e2e-anvil.md`](../../docs/testing/e2e-anvil.md) and [`docs/testing/strategy.md`](../../docs/testing/strategy.md).

## Install

Requires **Python 3.11+** and a JSON-RPC endpoint (Anvil or public).

```bash
cd bots/timecurve
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

The console script is **`timecurve-bot`** (or `python -m timecurve_bot.cli` from `src` on `PYTHONPATH`).

## Configuration

Copy [`.env.example`](.env.example) to `.env` or `.env.local` (gitignored) and set at least:

| Variable | Purpose |
|----------|---------|
| `YIELDOMEGA_RPC_URL` or `RPC_URL` | HTTP RPC |
| `YIELDOMEGA_CHAIN_ID` | Chain id (Anvil default `31337`) |
| `YIELDOMEGA_TIMECURVE_ADDRESS` | TimeCurve contract |
| `YIELDOMEGA_RABBIT_TREASURY_ADDRESS` | Optional (shown in `inspect`) |
| `YIELDOMEGA_LEPRECHAUN_NFT_ADDRESS` | Optional (shown in `inspect`) |
| `YIELDOMEGA_ACCEPTED_ASSET_ADDRESS` | Optional; else read from contract |
| `YIELDOMEGA_ADDRESS_FILE` | Optional JSON registry (see `contracts/deployments/stage2-anvil-registry.json`) |

**Transaction safety (default dry-run):**

- No submissions unless you pass **`--send`** on the CLI **or** set `YIELDOMEGA_SEND_TX=1` **and** `YIELDOMEGA_DRY_RUN=0`, **and** set `YIELDOMEGA_PRIVATE_KEY`.
- **`inspect`** never sends transactions.

**Anvil-only cheats** (`anvil_increaseTime` / `anvil_mine`): require **`--allow-anvil-cheat`** (or `YIELDOMEGA_ALLOW_ANVIL_CHEAT=1`) **and** `YIELDOMEGA_CHAIN_ID=31337`. Do **not** enable against public RPC.

## Brand-new user: local Anvil → bot

From repository root (Foundry `anvil`, `forge`, `cast` on `PATH`):

```bash
# Writes bots/timecurve/.env.local and leaves Anvil running (note the printed PID).
bash scripts/anvil-export-bot-env.sh

cd bots/timecurve
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
set -a && source .env.local && set +a
.venv/bin/timecurve-bot inspect
```

Optional: run a full local scenario (mint + buys + timer warp + flag claim):

```bash
# Use Anvil’s default account #0 private key from the Foundry Anvil docs (local-only; never on mainnet).
export YIELDOMEGA_PRIVATE_KEY=<anvil_default_key_from_foundry_docs>
.venv/bin/timecurve-bot --send --allow-anvil-cheat seed-local
```

If Anvil is already running on port 8545:

```bash
bash scripts/anvil-export-bot-env.sh --no-anvil
```

Deploy logic is **shared** with Playwright Anvil E2E via [`scripts/lib/anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh) (sourced from [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh)).

## Commands

| Command | Description |
|---------|-------------|
| `inspect` | Sale phase, timer, CHARM bounds/price, reserve podiums, WarBow top-3, flag line |
| `fun` | One conservative buy at current **min** CHARM |
| `shark` | **Max** CHARM buy; with `--warp-reset` (default on), Anvil time warp into `<13m` remaining to hit hard-reset branch |
| `pvp` | Victim wallet buys for BP; attacker `warbowSteal` (mints dev CL8Y to fund wallets on local mock reserve) |
| `defender` | Repeated under-15m buys + streak reads (`--steps N`) |
| `seed-local` / `scenario` | Deterministic multi-wallet sequence for UI/indexer dev |

Global options: `--send`, `--allow-anvil-cheat`, `--env-file PATH`.

## Implementation note

1. **Export env** — `scripts/anvil-export-bot-env.sh` runs the same `DeployDev` forge script as `e2e-anvil.sh` and parses `TimeCurve` / `RabbitTreasury` / `LeprechaunNFT` lines, then optional `cast call` for `acceptedAsset`.
2. **Load config** — `timecurve_bot.config.load_config` reads env (and optional address file), checksums addresses, applies send/dry-run policy.
3. **Connect** — `web3.py` HTTP provider; `assert_chain_id` catches mismatched `YIELDOMEGA_CHAIN_ID`.
4. **Strategies** — call `actions.approve_if_needed`, `buy`, WarBow helpers, and `mock_reserve.mint` only on dev tokens that expose `mint` (DeployDev `MockReserveCl8y`).

## Frontend support

Point the Vite app at the **same** RPC and TimeCurve address as `.env.local` (see [`docs/testing/e2e-anvil.md`](../../docs/testing/e2e-anvil.md) `VITE_*` table). Then:

- **`seed-local`** produces staggered `Buy` events, a likely **timer hard-reset** buy, multiple wallets for **last-buy** / **WarBow** motion, and a **flag silence + `claimWarBowFlag`** path when the chain ends the silence window via `anvil_increaseTime`.
- Running **`inspect`** before/after scenarios gives a quick textual check of podiums and ladder slots without opening the indexer.

This helps exercise timer UX, podium panels, and WarBow / battle-feed surfaces while staying **onchain** (no fake frontend-only state as the primary workflow).

## Tests

```bash
.venv/bin/pytest tests -v
```

CI runs the same without Anvil (unit tests only).

## Agent skill

For IDE agents working in this directory, see [`SKILL.md`](SKILL.md).
