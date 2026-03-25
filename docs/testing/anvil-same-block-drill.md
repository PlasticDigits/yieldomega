# Anvil same-block ordering drill

This drill complements Foundry unit tests: sequential `vm.prank` calls run in **one** outer transaction, so they only prove **call order**. To approximate **transaction index** ordering inside a **single mined block**, use local **Anvil** with **manual mining**:

1. Start Anvil with **`--no-mining`** (mine blocks only when you call `anvil_mine`).
2. Submit two or more signed txs (e.g. `cast send --async`) so they sit in the **pending** pool.
3. Mine one block (`cast rpc anvil_mine`).
4. Inspect logs / state (e.g. `Buy` events with `buyIndex`).

This is **not** a Flashbots **`eth_sendBundle`** simulation; it only validates **inclusion order** in one block on a local node.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`anvil`, `cast`, `forge`) on `PATH`.
- Forge dependencies installed under `contracts/` per [contracts/README.md](../../contracts/README.md).

## Run

From repository root:

```bash
bash contracts/script/anvil_same_block_drill.sh
```

Optional: `ANVIL_PORT=8546 bash contracts/script/anvil_same_block_drill.sh` if port 8545 is busy.

The script:

1. Starts `anvil --no-mining` in the background.
2. Deploys a minimal TimeCurve stack via `forge script script/AnvilSameBlockDrill.s.sol`.
3. Mints and approves two default Anvil accounts.
4. Queues two `buy` transactions with `--async`, then mines one block.
5. Prints recent logs for inspection.

Stop the background Anvil when finished (the script exits and kills its child on success).

## CI

This drill is **optional** and **not** required in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) (extra tooling time and port binding). Run locally or in a dedicated workflow if you add one.

**Related:** [invariants-and-business-logic.md](invariants-and-business-logic.md) (ordering / MEV gaps), [security-and-threat-model.md](../onchain/security-and-threat-model.md).
