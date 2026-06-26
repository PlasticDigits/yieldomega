# WarBow ranking gas benchmark (GitLab #312)

Anvil (`forge test`) on Cloud Agent VM, **2026-06-13**.

## Setup

- **10,000** synthetic players with seeded `_battlePoints` (incremental top-3 maintained via `_updateTopThree`).
- Three top-BP players register on the live WarBow podium via level-4 buys (`_cachedLevel` slot **106** via `vm.store`; refresh from `forge inspect TimeArena storage-layout` after append-only state changes — [#353](https://gitlab.com/PlasticDigits/yieldomega/-/issues/353)).
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

### ≤6-address tracking tradeoff (gas vs accuracy)

`TimeArena` tracks at most **six** WarBow addresses between merges: the live global top-3 plus an off-podium top-3 buffer. `_mergeWarbowGlobalPodium` re-sorts those six and writes back global top-3 + off-podium ranks 4–6.

| Guarantee | Limit |
|-----------|-------|
| Every **buy** (or steal/guard/revenge BP change) re-runs `_updateWarbowRanking` for that wallet | Only the six tracked slots are considered at merge time — a player outside the buffer who **never** triggers another BP update can stay invisible until they act again |
| Strictly **higher** live BP than a tracked slot, or equal BP with a **better tie-break** (lower address, same as `_sortPodium`), enters the buffer on that update | Off-podium **displacement without reinsert** is an accepted gas tradeoff: evicted rank-4..6 addresses are not recursively re-evaluated (unlike non-WarBow `_updateTopThree`) |
| A wallet **not** on the global podium whose live BP exceeds the worst podium slot **will** enter the merge set on their next qualifying buy/BP event | Podium can lag true global order when many equal-BP players churn outside the six-slot window |

Regression: `test_warbow_higher_bp_buy_enters_podium`, `test_warbow_off_podium_tie_break_promotes_to_global`.

Cross-links: [`arena-v2.md` § WarBow](../product/arena-v2.md), **`INV-TIME-ARENA-AUTOROLL-312`** · **`INV-TIME-ARENA-WARBOW-RANK-312`** in [`invariants-and-business-logic.md`](invariants-and-business-logic.md).
