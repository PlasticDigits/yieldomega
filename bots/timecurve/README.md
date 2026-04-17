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

**Anvil-only dev funding** (one-shot `anvil_setBalance` + mock reserve `mint`): require **`--allow-anvil-funding`** (or `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`) **and** `YIELDOMEGA_CHAIN_ID=31337`. Used by the **`swarm`** command only. **Default false** — mainnet runs must leave this off.

**QA / human wallet on Anvil:** set **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`** to one or more comma-separated **`0x` addresses** (no private keys) in `.env.local`. Swarm funding then includes those addresses alongside the fixed swarm HD wallets (same ETH + mock CL8Y mint). Use the same address in your browser wallet for manual UI testing.

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

Optional: run a full local scenario (mint + buys; flag claim depends on on-chain time):

```bash
# Use Anvil’s default account #0 private key from the Foundry Anvil docs (local-only; never on mainnet).
export YIELDOMEGA_PRIVATE_KEY=<anvil_default_key_from_foundry_docs>
.venv/bin/timecurve-bot --send seed-local
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
| `fun` | **Loop** conservative **min** CHARM buys (`YIELDOMEGA_FUN_MEAN_SEC`, default 45s mean inter-arrival) |
| `shark` | **Loop** **max** CHARM buys (`YIELDOMEGA_SHARK_MEAN_SEC`, default 60s mean inter-arrival) |
| `pvp` | **Loop** victim buys + attacker `warbowSteal` (`YIELDOMEGA_PVP_MEAN_SEC`, default 120s between cycles) |
| `defender` | **Loop** cycles of under-15m buys + streak reads (`--steps N` per cycle; `YIELDOMEGA_DEFENDER_MEAN_SEC`, default 90s between cycles) |
| `seed-local` / `scenario` | Deterministic multi-wallet sequence **once** (slot **0** or no slot), then **loop** min-CHARM buys rotating A0→A1→A2 (`YIELDOMEGA_SEED_LOCAL_MEAN_SEC`, default 45s). **Swarm slots 1–2** skip the deterministic block (only mint + loop) so parallel runs do not fight over the WarBow flag. |
| `rando` | **Poisson process** inter-arrival times (`YIELDOMEGA_RANDO_MEAN_SEC`, default 45s); each buy picks **uniform** random CHARM in current onchain **[min, max]** |
| `swarm` | Spawns **3×** each of `fun`, `shark`, `pvp`, `defender`, `seed-local` plus **3×** `rando` (Anvil **31337** only). Requires **`--allow-anvil-funding`** (or `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1`) for a **one-shot** mock CL8Y mint + **`anvil_setBalance` 10k ETH** per swarm wallet (plus any **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES`**), then starts bots with **`YIELDOMEGA_SEND_TX` / `YIELDOMEGA_DRY_RUN`** (no `--send` in subprocess env — avoids Typer quirks). [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) sets `YIELDOMEGA_ALLOW_ANVIL_FUNDING=1` when `SKIP_ANVIL_RICH_STATE=1` runs the swarm. |

Global options: `--send`, `--allow-anvil-funding`, `--env-file PATH`.

**Local stack:** With `SKIP_ANVIL_RICH_STATE=1`, `scripts/start-local-anvil-stack.sh` defaults `START_BOT_SWARM=1` (set `START_BOT_SWARM=0` to skip). It runs `anvil --accounts 30`, syncs bot env, then runs the swarm. Install the package first: `cd bots/timecurve && pip install -e .` (or use `bots/timecurve/.venv`).

## Implementation note

1. **Export env** — `scripts/anvil-export-bot-env.sh` runs the same `DeployDev` forge script as `e2e-anvil.sh` and parses `TimeCurve` / `RabbitTreasury` / `LeprechaunNFT` lines, then optional `cast call` for `acceptedAsset`.
2. **Load config** — `timecurve_bot.config.load_config` reads env (and optional address file), checksums addresses, applies send/dry-run policy.
3. **Connect** — `web3.py` HTTP provider; `assert_chain_id` catches mismatched `YIELDOMEGA_CHAIN_ID`.
4. **Strategies** — call `actions.approve_if_needed`, `buy`, WarBow helpers, and `mock_reserve.mint` only on dev tokens that expose `mint` (DeployDev `MockReserveCl8y`).

## Frontend support

Point the Vite app at the **same** RPC and TimeCurve address as `.env.local` (see [`docs/testing/e2e-anvil.md`](../../docs/testing/e2e-anvil.md) `VITE_*` table). Then:

- **`seed-local`** produces staggered `Buy` events, optional reset-band max buy when chain time is already `<13m` remaining, multiple wallets for **last-buy** / **WarBow** motion, and a best-effort **`claimWarBowFlag`** (may require on-chain time to advance the silence window).
- Running **`inspect`** before/after scenarios gives a quick textual check of podiums and ladder slots without opening the indexer.

This helps exercise timer UX, podium panels, and WarBow / battle-feed surfaces while staying **onchain** (no fake frontend-only state as the primary workflow).

## Tests

```bash
.venv/bin/pytest tests -v
```

CI runs the same without Anvil (unit tests only).

## Agent skill

For IDE agents working in this directory, see [`SKILL.md`](SKILL.md).
