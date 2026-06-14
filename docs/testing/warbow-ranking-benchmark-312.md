# WarBow ranking gas benchmark (GitLab #312)

Anvil (`forge test`) on Cloud Agent VM, **2026-06-13**.

## Setup

- **10,000** synthetic players with seeded `_battlePoints` (incremental top-3 maintained via `_updateTopThree`).
- Three top-BP players register on the live WarBow podium via level-4 buys.
- Measured with `vm.startSnapshotGas` in [`TimeArenaWarbowBenchmark.t.sol`](../../contracts/test/TimeArenaWarbowBenchmark.t.sol).

## Command

```bash
cd contracts && forge test --match-test test_benchmark_warbow_10k_player_ranking -vv
```

## Results

| Metric | Gas |
|--------|-----|
| Incremental top-3 update (one buy at player 5000) | **466,208** |
| WarBow `rollPodiumEpoch` after 10k seeded BP | **127,536** |
| WarBow steal ranking update (10k seeded BP, victim on podium) | **245,841** |

## Interpretation

Ranking is **incremental O(1)** per BP change (global top-3 + off-podium top-3 merge over ≤6 candidates); epoch roll reads only the stored top-3 (no full-table scan). Steal/revenge BP drains use the same O(1) merge — not a linear scan over all holders.

Cross-links: [`arena-v2.md` § WarBow](../product/arena-v2.md), **`INV-TIME-ARENA-AUTOROLL-312`** · **`INV-TIME-ARENA-WARBOW-RANK-312`** in [`invariants-and-business-logic.md`](invariants-and-business-logic.md).
