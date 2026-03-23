# Research notes: MegaETH and MegaEVM

## Summary

**MegaETH** is a high-performance Ethereum L2; **MegaEVM** is its EVM-compatible execution environment with chain-specific **gas** and **limits**. This project targets MegaETH for **real-time** consumer experiences (for example sub-second block times).

## Primary documentation (verify periodically)

- MegaEVM overview: [https://docs.megaeth.com/megaevm](https://docs.megaeth.com/megaevm)
- Testnet and mainnet pages on the same doc site for **RPC endpoints**, **chain ID**, and **explorer** links.

Do **not** treat numeric parameters in this file as authoritative if they drift; **confirm on official docs** before deployment.

## Technical themes relevant to yieldomega

1. **Compatibility** — Standard Solidity tooling (Foundry) and contract patterns are expected to work; still **validate** opcodes and precompiles against MegaETH’s current fork baseline (see MegaETH docs for hardfork / OP stack alignment).

2. **Gas model** — Multidimensional gas (**compute** vs **storage**) affects optimization priorities. Profile hot paths under MegaETH RPC, not only `anvil`.

3. **Throughput** — Fast blocks imply **more frequent indexer ticks** and **reorg** handling; design for **high churn** event streams ([../indexer/design.md](../indexer/design.md)).

4. **Debugging** — MegaETH documents tooling such as **`mega-evme`** for execution debugging; use when investigating revert mysteries (link from official docs).

## Operational checklist for devs

- Confirm **chain ID** for target network.
- Use **official RPC** for gas estimation and deployment.
- Record **deployed addresses** and **verification** URLs per [../operations/deployment-stages.md](../operations/deployment-stages.md).

---

**Agent phase:** [Phase 16 — Research: MegaETH](../agent-phases.md#phase-16)
