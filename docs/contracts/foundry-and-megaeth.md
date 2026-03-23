# Foundry (Forge) on MegaEVM

## Tooling choice

Smart contracts for this monorepo are expected to use **Foundry** (`forge`, `cast`, `anvil`) for build, test, and deployment scripting. Foundry is widely used for Solidity and fits **AGPL-3.0**-licensed project code alongside upstream Foundry’s own license terms (maintain **NOTICE** when implementation lands).

## MegaEVM compatibility

MegaEVM is MegaETH’s execution environment: **Solidity and standard EVM patterns** are supported. Official references:

- [MegaETH MegaEVM documentation](https://docs.megaeth.com/megaevm)

## Gas model (design impact)

MegaEVM uses a **multidimensional gas** model (for example **compute gas** vs **storage gas**). Implications for contract design:

- **Storage-heavy** patterns (large structs, frequent `SSTORE`) may dominate cost versus L1 intuition.
- **Event-heavy** indexing is still preferred for transparency but log costs should be profiled under MegaETH RPC.
- **Gas estimation** in local simulators may **diverge** from MegaETH; prefer **RPC-native estimation** for production transactions.

## Contract size and initcode

MegaEVM raises limits versus classic Ethereum (for example **larger max contract size** and **initcode**). This enables more monolithic deployments **technically**, but the project should still favor **clear modules** for audits and upgrade clarity ([../architecture/overview.md](../architecture/overview.md)).

## Networks and workflow

- **Local** — `anvil` or MegaETH-provided dev tooling for fast iteration.
- **Testnet** — deploy candidate releases; record addresses in [../operations/deployment-stages.md](../operations/deployment-stages.md).
- **Mainnet** — MegaETH mainnet; verify contracts on supported explorers per current MegaETH docs.

Exact **chain IDs**, **RPC URLs**, and **explorer** links should be copied from official docs into [../research/megaeth.md](../research/megaeth.md) and kept updated.

## Testing expectations

- **Forge tests** are **Stage 1** ([../testing/strategy.md](../testing/strategy.md)).
- Fuzz timer and ordering edge cases for TimeCurve; property tests for treasury invariants where possible.

---

**Agent phase:** [Phase 11 — Foundry on MegaEVM](../agent-phases.md#phase-11)
