# Contracts (Foundry)

Smart contracts for MegaEVM (TimeCurve, Rabbit Treasury / **Burrow**, NFTs, routers).

Original Solidity and documentation in this directory follow the repository **GNU Affero General Public License v3.0** ([`../LICENSE`](../LICENSE)); third-party libraries under `lib/` keep their own licenses.

## Setup

Foundry dependencies live under `lib/` as **git submodules** (pinned in `.gitmodules`; lockfile: [`foundry.lock`](./foundry.lock)). After clone:

```bash
git submodule update --init --recursive
```

Or clone with submodules in one step:

```bash
git clone --recurse-submodules <repository-url>
```

To bump a dependency, from `contracts/` use `forge update lib/<name>`, or check out a new tag inside the submodule and commit the updated pointer in this repository.

Copy [`.env.example`](./.env.example) if you want a local `.env` for RPC URLs (optional for unit tests).

## Test

```bash
forge test
```

CI uses the `ci` profile (pinned fuzz runs). To match locally:

```bash
FOUNDRY_PROFILE=ci forge test -vv
```

Optional **live RPC fork smoke** (`test/TimeCurveFork.t.sol`) is skipped unless `FORK_URL` is set; see [`../docs/testing/contract-fork-smoke.md`](../docs/testing/contract-fork-smoke.md).

## Slither (static analysis)

CI runs Slither on push/PR via [`.github/workflows/slither.yml`](../.github/workflows/slither.yml) using [`slither.config.json`](./slither.config.json) (`fail-on: high`). Locally, after `forge build`:

```bash
pip install --user slither-analyzer   # or: python3 -m venv .venv && . .venv/bin/activate && pip install slither-analyzer
cd contracts && slither . --config-file slither.config.json --fail-high
```

Use `--fail-high` so the CLI matches CI; without it, Slither exits non-zero on **medium** (or lower) findings by default.

If `forge build` fails with permission errors on `out/` or `cache/` (for example after a root-owned Docker compile), fix ownership of those directories or point Forge at writable paths (`FOUNDRY_OUT`, `forge build --cache-path …`).

This is a **pre-audit** hygiene gate, not a substitute for a professional review.

## MegaETH RPC (testnet and mainnet)

Official parameters and endpoints change over time; confirm on [MegaETH documentation](https://docs.megaeth.com/) before relying on values below. High-level research notes live in [`../docs/research/megaeth.md`](../docs/research/megaeth.md).

| Network  | Chain ID | Public RPC (example) |
| -------- | -------- | -------------------- |
| Testnet  | 6343     | `https://carrot.megaeth.com/rpc` |
| Mainnet  | 4326     | `https://mainnet.megaeth.com/rpc` |

[`foundry.toml`](./foundry.toml) defines labels `megaeth_testnet` and `megaeth` so you can fork or send transactions without pasting URLs each time:

```bash
# Fork testnet (e.g. for script debugging)
forge script script/DeployDev.s.sol --fork-url megaeth_testnet

# cast against testnet
cast chain-id --rpc-url https://carrot.megaeth.com/rpc
```

Set `ETH_RPC_URL` or pass `--rpc-url` to point `cast send`, `forge script`, and wallet tools at the network you intend. Rate limits and URL churn are documented on the official testnet/mainnet pages.

### Multidimensional gas pitfalls (MegaEVM)

MegaEVM uses a **multidimensional gas** model (for example **compute** vs **storage**). That affects how you interpret costs and tooling:

- **Storage-heavy** code paths can dominate cost compared to L1 intuition; profile hot paths on a **real MegaETH RPC**, not only `anvil`.
- **Gas estimates from local simulators** (including vanilla EVM replay) can **diverge** from MegaETH. Prefer **RPC-native `eth_estimateGas`** for production transactions.
- Foundry and other toolchains that simulate with a non-MegaEVM EVM may mis-estimate gas; MegaETH documents mitigations such as **`--gas-limit`** with a sufficient cap and **`--skip-simulation`** for `forge script`, or using MegaETH’s RPC for estimation. See [MegaETH mainnet docs](https://docs.megaeth.com/frontier) and [MegaEVM](https://docs.megaeth.com/megaevm).
- **Event/log-heavy** flows should still be measured under MegaETH RPC if gas limits matter at the margin.

More context: [`../docs/contracts/foundry-and-megaeth.md`](../docs/contracts/foundry-and-megaeth.md).

## Deploy (dev)

Deploy all core contracts to a local or dev environment:

```bash
forge script script/DeployDev.s.sol --broadcast --rpc-url <RPC>
```

The script deploys mock tokens (**CL8Y** reserve + launched token) when neither `RESERVE_ASSET_ADDRESS` nor legacy `USDM_ADDRESS` is set.
To use a real testnet CL8Y address, export `RESERVE_ASSET_ADDRESS` (or `USDM_ADDRESS`) before running.

Addresses are printed to console — copy them into
[`deployments/dev-addresses.example.json`](./deployments/dev-addresses.example.json).
ABIs live in `out/` after `forge build`. Registry templates and **ABI hash export** for consumers: [`deployments/README.md`](./deployments/README.md). See
[`docs/operations/deployment-stages.md`](../docs/operations/deployment-stages.md),
[`docs/operations/deployment-checklist.md`](../docs/operations/deployment-checklist.md), and
[`docs/operations/stage3-mainnet-operator-runbook.md`](../docs/operations/stage3-mainnet-operator-runbook.md).

## Parameters

See [`PARAMETERS.md`](./PARAMETERS.md) for testnet defaults and `TODO`s that
need human decisions before mainnet.

## Contract map

| Contract | Purpose |
|----------|---------|
| `TimeCurve` | Token launch primitive — buys, timer, prizes, fee routing |
| `RabbitTreasury` | Player-facing reserve game — **CL8Y** ↔ DOUB, **redeemable / protocol-owned** buckets, burn + controlled redemption, epoch repricing via `BurrowMath` |
| `Doubloon` | DOUB ERC-20 — mint/burn controlled by `RabbitTreasury` |
| `FeeRouter` | Splits fees to **five** sink slots (bps weights, governed; launch default includes one **0%** team slot) |
| `PodiumPool` | Holds podium-pool portion of fees; `TimeCurve.distributePrizes` pays winners |
| `CL8YProtocolTreasury` | CL8Y buy-and-burn sink (**35%** launch default) |
| `DoubLPIncentives` | DOUB liquidity sink (**25%** launch default) — LP mechanics TODO |
| `EcosystemTreasury` | Team / ecosystem sink address (**0%** weight at launch; still wired in `DeployDev`) |
| `LeprechaunNFT` | ERC-721 with onchain traits, series, role-gated minting |
| `ReferralRegistry` | Short referral codes; **CL8Y** burn to register; used by `TimeCurve` buys |
| `MockReserveCl8y` | Dev-only mintable **CL8Y** stand-in in `DeployDev.s.sol` when no reserve address is set |
| `MockCL8Y` | Dev-only mintable token in `src/tokens/` for isolated tests |

## Libraries

- `BurrowMath` — coverage, multiplier, epoch `e` step (aligned with `simulations/bounded_formulas/model.py`).
- `TimeMath` — exponential **envelope** factor for CHARM min/max band; timer extension with cap.
- `LinearCharmPrice` — default linear per-CHARM price schedule (`ICharmPrice` for `TimeCurve`).
- `FeeMath` — basis-point weight validation and share computation.

## Burrow events

`RabbitTreasury` emits the canonical `Burrow*` events defined in
[`docs/product/rabbit-treasury.md`](../docs/product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events)
so indexers decode a stable ABI.
