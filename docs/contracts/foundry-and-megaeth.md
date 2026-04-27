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

## MegaEVM bytecode limits and nested-call gas

MegaEVM **does not** use Ethereum’s **EIP-170** runtime cap (**24,576 bytes**) for chain deployments. The authoritative limits are in the MegaETH spec ([Contract limits](https://docs.megaeth.com/spec/megaevm/contract-limits)):

| Limit | Bytes | KiB (1024-based) |
| --- | ---: | ---: |
| **Max deployed runtime bytecode** (`MAX_CONTRACT_SIZE`) | 524,288 | 512 |
| **Additional initcode allowance** (`ADDITIONAL_INITCODE_SIZE`) | 24,576 | 24 |
| **Max initcode** (`MAX_INITCODE_SIZE` = sum of the two) | 548,864 | 536 |

Nodes **must** reject creations that exceed these bounds. **Ethereum L1** and **default Anvil** (no flag) still enforce **EIP-170** on the runtime code of each created contract: **0x6000** bytes = **24,576** (~24 KiB). **This repository** starts Anvil with **`--code-size-limit 524288`** (512 KiB = **0x80000**; Foundry’s flag is **decimal-only**—`0x80000` is rejected) in [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh), `scripts/e2e-anvil.sh`, and `scripts/anvil-export-bot-env.sh` so local deploys are not incorrectly capped at EIP-170. If you run a **plain** `anvil` or another node without that flag, a deploy that fits MegaETH can still **fail** with a code-size error—set the limit to **524288** (or `anvil --disable-code-size-limit`) or split/shrink for L1-style tooling.

**How to verify in this repo:** from `contracts/`, run `forge build` (or `FOUNDRY_PROFILE=ci forge build`), then either `forge build --sizes` or measure `out/<Contract>.sol/<Contract>.json` deployed bytecode length (hex `object` length ÷ 2, minus the `0x` byte). Re-check after any optimizer or compiler change.

**Nested calls (gas forwarding):** MegaEVM applies a **98/100** forwarding cap to `CALL`, `DELEGATECALL`, `STATICCALL`, `CALLCODE`, `CREATE`, and `CREATE2` (replacing Ethereum’s **63/64** rule) so deep call stacks shed gas **more aggressively** under MegaETH’s high block-gas regime — see [Gas forwarding](https://docs.megaeth.com/spec/megaevm/gas-forwarding.md). Prefer **shallow** composer patterns and **RPC-native `eth_estimateGas`** on MegaETH when calibrating limits; do not assume L1-style depth budgets.

This project should still favor **clear modules** for audits and upgrade clarity ([../architecture/overview.md](../architecture/overview.md)), even though MegaEVM allows much larger single-contract artifacts than EIP-170.

## Networks and workflow

- **Local** — `anvil` or MegaETH-provided dev tooling for fast iteration.
- **Testnet** — deploy candidate releases; record addresses in [../operations/deployment-stages.md](../operations/deployment-stages.md).
- **Mainnet** — MegaETH mainnet; verify contracts on supported explorers per current MegaETH docs.

Exact **chain IDs**, **RPC URLs**, and **explorer** links should be copied from official docs into [../research/megaeth.md](../research/megaeth.md) and kept updated.

## Testing expectations

- **Forge tests** are **Stage 1** ([../testing/strategy.md](../testing/strategy.md)).
- Fuzz timer and ordering edge cases for TimeCurve; property tests for treasury invariants where possible (see `BurrowMath` in [`contracts/README.md`](../../contracts/README.md) and Python sims in [`simulations/README.md`](../../simulations/README.md)).
- After clone, run `git submodule update --init --recursive` (or clone with `--recurse-submodules`) so `contracts/lib/` dependencies are present; see [`contracts/README.md`](../../contracts/README.md).

---

**Agent phase:** [Phase 11 — Foundry on MegaEVM](../agent-phases.md#phase-11)
