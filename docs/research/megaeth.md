# Research notes: MegaETH and MegaEVM

## Summary

**MegaETH** is a high-performance Ethereum L2; **MegaEVM** is its EVM-compatible execution environment with chain-specific **gas** and **limits**. This project targets MegaETH for **real-time** consumer experiences (for example sub-second block times).

## Primary documentation (verify periodically)

- MegaEVM overview: [docs.megaeth.com/megaevm](https://docs.megaeth.com/megaevm)
- Mainnet (RPC, chain ID, explorers): [docs.megaeth.com/frontier](https://docs.megaeth.com/frontier)
- Testnet: [docs.megaeth.com/testnet](https://docs.megaeth.com/testnet)
- Realtime JSON-RPC enhancements: [docs.megaeth.com/realtime-api](https://docs.megaeth.com/realtime-api)

Do **not** treat numeric parameters in this file as authoritative if they drift; **confirm on official docs** before deployment.

## For contract developers

**Compute vs storage gas.** In MegaEVM, transaction gas is the sum of **compute gas** and **storage gas**. Compute gas uses the same opcode costs as Ethereum’s EVM (roughly, compute gas matches what the same tx would burn on L1). **Storage gas** charges the storage subsystem and related data paths: every transaction pays intrinsic storage gas on top of intrinsic compute gas (official docs currently give **21,000** compute + **39,000** storage = **60,000** minimum intrinsic gas), and additional storage gas applies only where documented—for example zero-to-nonzero `SSTORE` (scaled by a **bucket multiplier**), account/contract creation, code deposit per byte, `LOG` topics and data, calldata bytes, and EIP-7623 floor components—while most other opcodes add **zero** storage gas. See the [MegaEVM page](https://docs.megaeth.com/megaevm) for the authoritative tables and limits.

**Why local gas estimation can differ.** Toolchains that simulate transactions with a **vanilla EVM** do not model MegaEVM’s **storage gas** or **multidimensional resource limits**, so offline estimates are often **too low**. Symptoms include RPC errors such as **intrinsic gas too low** (gas limit under the chain’s intrinsic minimum) or on-chain **out of gas** despite a “successful” local run. Prefer **MegaETH’s RPC** for gas estimation (and APIs described under [Realtime API](https://docs.megaeth.com/realtime-api)), or bypass local simulation and set a **sufficiently high explicit gas limit** (e.g. Foundry `forge script` with `--skip-simulation` and `--gas-limit`) as the official docs recommend. For execution-accurate debugging, use **`mega-evme`** against the open-source MegaEVM implementation ([build and usage](https://github.com/megaeth-labs/mega-evm/blob/main/bin/mega-evme/README.md)).

Repo workflow notes: [Foundry on MegaEVM](../contracts/foundry-and-megaeth.md).

## Technical themes relevant to yieldomega

1. **Compatibility** — Standard Solidity tooling (Foundry) and contract patterns are expected to work; still **validate** opcodes and precompiles against MegaETH’s current fork baseline (see MegaETH docs for hardfork / OP stack alignment).

2. **Gas model** — Multidimensional gas (**compute** vs **storage**) affects optimization priorities. Profile hot paths under MegaETH RPC, not only `anvil`.

3. **Throughput** — Fast blocks imply **more frequent indexer ticks** and **reorg** handling; design for **high churn** event streams ([../indexer/design.md](../indexer/design.md)).

4. **Debugging** — Use **`mega-evme`** for execution-accurate simulation ([README](https://github.com/megaeth-labs/mega-evm/blob/main/bin/mega-evme/README.md)); see also **For contract developers** above.

## Operational checklist for devs

- Confirm **chain ID** for target network.
- Use **official RPC** for gas estimation and deployment.
- Record **deployed addresses** and **verification** URLs per [../operations/deployment-stages.md](../operations/deployment-stages.md).

---

**Agent phase:** [Phase 16 — Research: MegaETH](../agent-phases.md#phase-16)
