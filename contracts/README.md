# Contracts (Foundry)

Smart contracts for MegaEVM (TimeCurve, Rabbit Treasury / **Burrow**, NFTs, routers).

Original Solidity and documentation in this directory follow the repository **GNU Affero General Public License v3.0** ([`../LICENSE`](../LICENSE)); third-party libraries under `lib/` keep their own licenses.

## Setup

Install dependencies (`lib/` is not committed; run after clone):

```bash
cd contracts
forge install foundry-rs/forge-std@v1.15.0 --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1 --no-git
forge install PaulRBerg/prb-math@v4.1.1 --no-git
```

Copy [`.env.example`](./.env.example) if you want a local `.env` for RPC URLs (optional for unit tests).

## Test

```bash
forge test
```

CI uses the `ci` profile (pinned fuzz runs). To match locally:

```bash
FOUNDRY_PROFILE=ci forge test -vv
```

## MegaETH RPC (testnet and mainnet)

Official parameters and endpoints change over time; confirm on [MegaETH documentation](https://docs.megaeth.com/) before relying on values below. High-level research notes live in [`../docs/research/megaeth.md`](../docs/research/megaeth.md).

| Network  | Chain ID | Public RPC (example) |
| -------- | -------- | -------------------- |
| Testnet  | 6343     | `https://carrot.megaeth.com/rpc` |
| Mainnet  | 4326     | `https://mainnet.megaeth.com/rpc` |

[`foundry.toml`](./foundry.toml) defines labels `megaeth_testnet` and `megaeth` so you can fork or send transactions without pasting URLs each time:

```bash
# Fork testnet (e.g. for script debugging)
forge script script/Example.s.sol --fork-url megaeth_testnet

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

## Burrow math

`src/libraries/BurrowMath.sol` implements coverage, multiplier, and epoch `e` update aligned with [`simulations/bounded_formulas/model.py`](../simulations/bounded_formulas/model.py).

When adding **`RabbitTreasury`**, emit the canonical **`Burrow*`** events (and indexed fields) defined in [`docs/product/rabbit-treasury.md`](../docs/product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events) so indexers stay ABI-aligned with the repo spec.
