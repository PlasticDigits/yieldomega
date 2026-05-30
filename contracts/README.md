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
forge script script/DeployDev.s.sol --fork-url megaeth_testnet --code-size-limit 524288

# cast against testnet
cast chain-id --rpc-url https://carrot.megaeth.com/rpc
```

**Mis-RPC safety ([GitLab #141](https://gitlab.com/PlasticDigits/yieldomega/-/issues/141)):** `DeployDev` and the other **dev** scripts in `script/` (`DeployKumbayaAnvilFixtures`, `AnvilSameBlockDrill`, `SimulateAnvilRichState*`) call [`DevOnlyChainGuard.sol`](./script/DevOnlyChainGuard.sol) so they only run on chain IDs **31337**, **6342**, or **6343**. They **revert** on MegaETH **mainnet (4326)** and other networks, preventing a mistaken `--rpc-url` from deploying mocks or flipping dev operator flags with a production key.

Set `ETH_RPC_URL` or pass `--rpc-url` to point `cast send`, `forge script`, and wallet tools at the network you intend. Rate limits and URL churn are documented on the official testnet/mainnet pages.

### Multidimensional gas pitfalls (MegaEVM)

MegaEVM uses a **multidimensional gas** model (for example **compute** vs **storage**). That affects how you interpret costs and tooling:

- **Storage-heavy** code paths can dominate cost compared to L1 intuition; profile hot paths on a **real MegaETH RPC**, not only `anvil`.
- **Gas estimates from local simulators** (including vanilla EVM replay) can **diverge** from MegaETH. Prefer **RPC-native `eth_estimateGas`** for production transactions.
- Foundry and other toolchains that simulate with a non-MegaEVM EVM may mis-estimate gas; MegaETH documents mitigations such as **`--gas-limit`** with a sufficient cap and **`--skip-simulation`** for `forge script`, or using MegaETH’s RPC for estimation. See [MegaETH mainnet docs](https://docs.megaeth.com/frontier) and [MegaEVM](https://docs.megaeth.com/megaevm).
- **Event/log-heavy** flows should still be measured under MegaETH RPC if gas limits matter at the margin.

More context: [`../docs/contracts/foundry-and-megaeth.md`](../docs/contracts/foundry-and-megaeth.md).

### Contract size and initcode (MegaETH vs Anvil)

MegaEVM uses **512 KiB** max **deployed** bytecode and **536 KiB** max **initcode** (see [MegaETH contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits)), **not** Ethereum’s **EIP-170** ~24 KiB runtime cap. **Nested-call gas** uses MegaEVM’s **98/100** forwarding rule ([Gas forwarding](https://docs.megaeth.com/spec/megaevm/gas-forwarding.md)). A **stock** `anvil` process still uses EIP-170’s **0x6000** (~24 KiB) unless you set **`--code-size-limit 524288`** (decimal only; hex like **`0x80000`** is rejected by Anvil) for **512 KiB** (MegaEVM parity). The repo’s **`scripts/start-local-anvil-stack.sh`**, **`scripts/e2e-anvil.sh`**, **`scripts/anvil-export-bot-env.sh`**, **`scripts/lib/anvil_deploy_dev.sh`**, **`contracts/script/anvil_rich_state.sh`**, and **`contracts/script/anvil_same_block_drill.sh`** pass **524288** on **Anvil** and on **`forge script`** where applicable (Forge simulates before `--broadcast` with its own EIP-170 check). After `forge build`, use `forge build --sizes` or inspect `out/<Name>.sol/<Name>.json` to confirm artifacts fit your **target chain**; see [foundry-and-megaeth.md](../docs/contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas) and [issue #72](https://gitlab.com/PlasticDigits/yieldomega/-/issues/72).

## Deploy (production / MegaETH)

For the contracts-only MegaETH quickstart and the indexer/frontend handoff, see
[`../docs/operations/deployment-guide.md`](../docs/operations/deployment-guide.md#arena-v2-deploy-gitlab-259).
The production wrapper is:

```bash
scripts/deploy-megaeth-contracts.sh
```

It uses [`script/DeployProduction.s.sol`](./script/DeployProduction.s.sol) (Arena v2 — [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)), prompts for the
private key and Etherscan API key, defaults to MegaETH mainnet RPC / chain ID, assigns
owner/admin roles to the CL8Y manager (`0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`),
and writes an address registry under `.deploy/`.

## Deploy (dev)

Deploy Arena v2 core contracts to a local or dev environment:

```bash
forge script script/DeployDev.s.sol --broadcast --rpc-url <RPC> --code-size-limit 524288
```

The script deploys mock **CL8Y** when neither `RESERVE_ASSET_ADDRESS` nor legacy `USDM_ADDRESS` is set.
To use a real testnet CL8Y address, export `RESERVE_ASSET_ADDRESS` (or `USDM_ADDRESS`) before running.

**Wires:** `TimeArena`, `PodiumVaults`, `AdminSellVault`, `PlayCred`, `ReferralRegistry`, `Doubloon`. Calls **`startArena()`** and seeds test DOUB/CL8Y/CRED. **`TimeArenaBuyRouter`:** deploy via `DeployKumbayaAnvilFixtures` when `YIELDOMEGA_DEPLOY_KUMBAYA=1` ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)).

Addresses are printed to console — copy them into
[`deployments/dev-addresses.example.json`](./deployments/dev-addresses.example.json).
ABIs live in `out/` after `forge build`. Registry templates and **ABI hash export** for consumers: [`deployments/README.md`](./deployments/README.md). See
[`docs/operations/deployment-stages.md`](../docs/operations/deployment-stages.md),
[`docs/operations/deployment-checklist.md`](../docs/operations/deployment-checklist.md),
[`docs/operations/stage3-mainnet-operator-runbook.md`](../docs/operations/stage3-mainnet-operator-runbook.md), and
[`docs/operations/pause-and-final-signoff.md`](../docs/operations/pause-and-final-signoff.md).

## Parameters

See [`PARAMETERS.md`](./PARAMETERS.md) for testnet defaults and `TODO`s that
need human decisions before mainnet.

## Contract map (Arena v2 — canonical)

| Contract | Purpose |
|----------|---------|
| `TimeArena` | Always-live arena — DOUB/CRED buys, four podium timers, 40/30/30 DOUB routing via `ArenaBuyRouting` ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)) |
| `PodiumVaults` | Four **active** + four **seed** DOUB prize pools; `PodiumFunded` / `SeedFunded` |
| `AdminSellVault` | **30%** admin slice per buy; `AdminVaultFunded` |
| `TimeArenaBuyRouter` | Kumbaya `exactOutput` → DOUB → `buyFor` (ETH/USDM ingress) |
| `Doubloon` | DOUB ERC-20 — **`MINTER_ROLE`** mint; burns via **OpenZeppelin `ERC20Burnable`** ([#132](https://gitlab.com/PlasticDigits/yieldomega/-/issues/132)) |
| `PlayCred` | Arena CRED mint/burn; `buyWithCred` burns per `CRED_PER_CHARM_WAD` ([#268](https://gitlab.com/PlasticDigits/yieldomega/-/issues/268)) |
| `ReferralRegistry` | Short referral codes; used by `TimeArena` buys |
| `DoubAirdrop` | Permissionless batch ERC-20 sender (disperse.app-style); CSV workflow in [`../airdrop/`](../airdrop/). **MegaETH mainnet:** `0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d` |
| `MockCL8Y` | Dev-only mintable token in `src/tokens/` for isolated tests |

Deploy: [`script/DeployDev.s.sol`](script/DeployDev.s.sol), [`script/DeployProduction.s.sol`](script/DeployProduction.s.sol) — no `FeeRouter` / `TimeCurve` ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)).

**Retired (sources removed — [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)):** `TimeCurve`, `FeeRouter`, `PodiumPool`, `DoubLPIncentives`, `EcosystemTreasury`, `CL8YProtocolTreasury`, `RabbitTreasury`, `LeprechaunNFT`, presale vesting stack. Historical parameters remain in [`PARAMETERS.md`](./PARAMETERS.md) under **Retired v1**.

## Libraries

- `ArenaBuyRouting` — pure 40% active / 30% seed / 30% admin split per DOUB buy ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).
- `ArenaXp` / `ArenaPodiumSettlement` — XP progression and podium settlement math.
- `TimeMath` — timer extension and hard-reset band (shared with legacy TimeCurve docs).

## Burrow events

`RabbitTreasury` emits the canonical `Burrow*` events defined in
[`docs/product/rabbit-treasury.md`](../docs/product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events)
so indexers decode a stable ABI.
