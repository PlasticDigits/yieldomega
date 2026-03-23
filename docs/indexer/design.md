# Indexer design (Rust + Postgres)

## Purpose

The indexer is an **offchain read model**. It **follows** MegaETH chain history, **decodes** contract events, and **stores** query-friendly projections in **Postgres**. It serves the **static frontend** and **autonomous agents** with low-latency aggregates (leaderboards, histories, faction stats).

It must **never** be the **authority** for balances, winners, or treasury outcomes ([../architecture/overview.md](../architecture/overview.md)).

## Core responsibilities

1. **Ingestion** — Follow new heads via JSON-RPC or streaming APIs (mechanism TBD). Respect MegaETH **~1s** block time.
2. **Deterministic decoding** — Map logs to ABIs; reject unknown signatures or version them explicitly.
3. **Reorg handling** — Track a **canonical chain pointer** and **rollback** to common ancestor on reorg; reapply blocks. Depth policy must be documented (for example finalize after N confirmations for UI badges).
4. **Persistence** — Normalized tables + optional materialized views for heavy queries.
5. **API** — HTTP (REST or GraphQL TBD) with stable schemas **versioned** for agents.

## Conceptual entities

Examples of tables or projections (names illustrative):

- **timecurve_sales** — sale id, parameters snapshot, timer state transitions.
- **timecurve_buys** — buyer, amount, tranche, block, tx index for ordering.
- **timecurve_prizes** — derived winner rows **verified against** onchain claims or explicit contract events.
- **rabbit_deposits_withdrawals** — amounts, epochs, user, faction id.
- **rabbit_health_epochs** — reserve snapshots and repricing factors **as emitted onchain**.
- **rabbits** — token id, collection id, trait blob or hash, schema version.
- **factions** — membership rules referencing NFT traits.

**Derived** winner rows must record **derivation rules** (contract version + block) for auditability.

## API guidelines for agents

- Paginate all list endpoints; include **cursor** or **block-height** watermarks.
- Expose **schema version** header or field.
- Do not return **actionable** balances without optional **client verification** hints (for example contract call template).

## Configuration

- **RPC URL**, **chain id**, **start block**, **contract address registry** per deployment.
- **Database URL** and migration directory.

## AGPL note

Indexer source in this repo is **AGPL-3.0**. Operators who modify and run it publicly should comply with source-offer requirements ([../licensing.md](../licensing.md)).

---

**Agent phase:** [Phase 12 — Indexer design (Rust + Postgres)](../agent-phases.md#phase-12)
