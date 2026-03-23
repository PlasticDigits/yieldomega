# Reorg Strategy — MegaETH ≈1 s blocks

## Problem

MegaETH targets **sub-second to 1-second block times**. At this cadence the
indexer cannot assume even moderate finality latency — a 10-block reorg
represents only ~10 seconds of wall time, yet the indexer may have already
surfaced those blocks to users and agents.

The design must balance **low-latency reads** (users expect near-instant
feedback) against **data correctness** (reorged events must never stick).

## Chain pointer model

The indexer maintains a single **canonical chain pointer** in Postgres:

```
(block_number, block_hash)
```

Every new block is validated against this pointer by comparing its
`parent_hash` to the stored `block_hash`. On match the block is processed and
the pointer advances. On mismatch a reorg is detected.

## Detection and rollback

1. **Walk back** — Starting from the pointer, fetch ancestor blocks from the
   RPC and compare hashes against locally stored block hashes until a common
   ancestor is found.
2. **Atomic rollback** — In a single Postgres transaction:
   - Delete all event rows with `block_number > ancestor_block_number`.
   - Reset the chain pointer to the ancestor.
3. **Re-ingest** — Resume normal ingestion from `ancestor + 1`. The new
   (canonical) blocks will be fetched and processed.

Because all mutations happen inside a transaction, the API never serves a
partially-rolled-back state.

## Confirmation tiers

Not all consumers need the same finality guarantee. The indexer exposes (or
will expose) a **confirmation tier** concept:

| Tier | Min confirmations | Use case |
|------|-------------------|----------|
| `realtime` | 0 | Live feed, best-effort |
| `soft` | 5 (~5 s) | UI badges, activity lists |
| `final` | 30 (~30 s) | Leaderboards, aggregate stats |

The `soft` and `final` thresholds are **configurable** and should be tuned
once MegaETH mainnet reorg frequency is observed. The indexer processes all
blocks immediately but tags each row with `block_number`; API queries can
filter `block_number <= (head - min_confirmations)` for the desired tier.

## Depth cap

A reorg deeper than **`MAX_REORG_DEPTH`** (default: 128 blocks ≈ 2 minutes)
is treated as **catastrophic**. The indexer should:

- Log an error with full context.
- Halt ingestion (do not silently re-index an unbounded range).
- Alert operators (webhook / metric).

Manual intervention or a full re-index from `START_BLOCK` is the recovery
path for ultra-deep reorgs or chain-level incidents.

## Stored block hashes

To support the walk-back during reorg detection, the indexer stores a rolling
window of `(block_number, block_hash)` pairs in an `indexed_blocks` table
(or equivalent). Rows older than `MAX_REORG_DEPTH` blocks behind head can
be pruned periodically.

## Open questions

- **Streaming vs polling:** MegaETH may offer `eth_subscribe("newHeads")`
  over WebSocket. If available, the ingestion loop should prefer it for
  lower latency; the reorg logic stays the same (parent-hash check).
- **Finality gadget:** If MegaETH exposes an explicit finality signal (e.g.
  `safe` / `finalized` block tags), the `final` tier should track that
  instead of a fixed confirmation count.
- **Parallel decode:** At 1 block/s with potentially many logs, decoding
  can run in a `tokio::spawn_blocking` pool if it becomes CPU-bound.

---

**Reference:** `docs/indexer/design.md` §3 (Reorg handling).
