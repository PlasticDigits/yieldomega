# Indexer design (Rust + Postgres)

## Purpose

The indexer is an **offchain read model**. It **follows** MegaETH chain history, **decodes** contract events, and **stores** query-friendly projections in **Postgres**. It serves the **static frontend** and **autonomous agents** with low-latency aggregates (leaderboards, histories, faction stats).

It must **never** be the **authority** for balances, winners, or treasury outcomes ([../architecture/overview.md](../architecture/overview.md)).

**Fee and routing parameters:** Contracts should emit **old value, new value, actor** on changes ([invariant: parameter change events](../onchain/fee-routing-and-governance.md#invariant-parameter-change-events)); the indexer should decode and store them for reconciliation. Canonical sinks and governance intent: [fee sinks](../onchain/fee-routing-and-governance.md#fee-sinks), [governance actors](../onchain/fee-routing-and-governance.md#governance-actors).

## Core responsibilities

1. **Ingestion** — Follow new heads via JSON-RPC or streaming APIs (mechanism TBD). Respect MegaETH **~1s** block time. **Per block**, persist all decoded registry logs and advance metadata (**`indexed_blocks`**, **`chain_pointer`**) in **one** SQL transaction so crashes or failures cannot leave a half-ingested block ([GitLab #146](https://gitlab.com/PlasticDigits/yieldomega/-/issues/146); **`INV-INDEXER-146`** in [invariants](../testing/invariants-and-business-logic.md#indexer-block-ingest-transaction-gitlab-146)).
2. **Deterministic decoding** — Map logs to ABIs; reject unknown signatures or version them explicitly.
3. **Reorg handling** — Track a **canonical chain pointer** and **rollback** to common ancestor on reorg; reapply blocks. Depth policy must be documented (for example finalize after N confirmations for UI badges).
4. **Persistence** — Normalized tables + optional materialized views for heavy queries.
5. **API** — HTTP (REST or GraphQL TBD) with stable schemas **versioned** for agents.

## Conceptual entities

Examples of tables or projections (names illustrative):

- **timecurve_sales** — sale id, parameters snapshot, timer state transitions.
- **timecurve_buys** — buyer, amount (spend), tokens minted or credited if emitted, block, tx index for ordering. **`TimeCurve.buy` and `TimeCurve.buyFor`** share the same canonical **`Buy`** log on the **TimeCurve** contract (indexed `buyer` is always the participant). When **`TimeCurveBuyRouter`** is in the address registry, **`BuyViaKumbaya`** logs are indexed in **`idx_timecurve_buy_router_kumbaya`** and joined into **`/v1/timecurve/buys`** as optional **`entry_pay_asset`** / **`router_attested_gross_cl8y`** ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67), [`kumbaya.md`](../integrations/kumbaya.md#issue-65-single-tx-router)).
- **timecurve_prizes** — derived winner rows **verified against** onchain claims or explicit contract events.
- **rabbit_deposits_withdrawals** — amounts, epochs, user, faction id.
- **rabbit_health_epochs** — reserve snapshots and repricing factors **as emitted onchain**; canonical **`Burrow*`** event names and metric mapping live in [product/rabbit-treasury.md](../product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events).
- **leprechauns** — token id, collection id, trait blob or hash, schema version.

### Rabbit Treasury (`RabbitTreasury` / Burrow) logs

Decode **`BurrowEpochOpened`**, **`BurrowHealthEpochFinalized`**, **`BurrowEpochReserveSnapshot`**, **`BurrowReserveBalanceUpdated`**, **`BurrowDeposited`**, **`BurrowWithdrawn`**, **`BurrowFeeAccrued`**, **`BurrowRepricingApplied`**, **`BurrowReserveBuckets`**, **`BurrowProtocolRevenueSplit`**, and **`BurrowWithdrawalFeeAccrued`** per the spec table in [product/rabbit-treasury.md](../product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events). Version decoder mappings when the deployment ABI changes; reject unknown `topic0` or register them explicitly. **Emitted-event completeness** for Postgres persistence (decoder + dedicated `idx_*` tables per event family, **`rollback_after` coverage**) is mandated by [GitLab #112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112) — see **`INV-INDEXER-112`** in [invariants — emitted-event coverage](../testing/invariants-and-business-logic.md#indexer-emitted-event-coverage-gitlab-112).

Also decode **`TimeCurve`** governance / wiring events (**`BuyFeeRoutingEnabled`**, **`CharmRedemptionEnabled`**, **`ReservePodiumPayoutsEnabled`**, **`TimeCurveBuyRouterSet`**), **`TimeCurve`** **`PrizesDistributed`** and **`PrizesSettledEmptyPodiumPool`** ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133); **`GET /v1/timecurve/prize-distributions`** merges both), **`PodiumPool` `PrizePusherSet`**, **`DoubPresaleVesting` lifecycle + `Claimed` / `ClaimsEnabled` / `RescueERC20`** ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)), **`TimeCurveBuyRouter` `BuyViaKumbaya` / `Cl8ySurplusToProtocol`**, **`FeeRouter` `DistributableTokenUpdated` / `ERC20Rescued`** ([GitLab #122](https://gitlab.com/PlasticDigits/yieldomega/-/issues/122)), and **`FeeSink` `Withdrawn`** per the migrations in `indexer/migrations/` and `indexer/src/decoder.rs` (same #112 completeness rule).
- **factions** — membership rules referencing NFT traits.

**Derived** winner rows must record **derivation rules** (contract version + block) for auditability.

## API guidelines for agents

- Paginate all list endpoints; include **cursor** or **block-height** watermarks.
- Expose **schema version** header or field.
- **Referrals (GitLab #94):** `GET /v1/referrals/referrer-leaderboard` and `GET /v1/referrals/wallet-charm-summary` aggregate **`idx_timecurve_referral_applied` only** — see [`docs/product/referrals.md`](../product/referrals.md#referrals-dashboard-issue-94) and the test map in [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#referrals-leaderboard-and-earnings-issue-94).
- **WarBow pending revenge (GitLab #135):** `GET /v1/timecurve/warbow/pending-revenge` reconciles **`WarBowRevengeWindowOpened`** rows in **`idx_timecurve_warbow_revenge_window`** against **`WarBowRevenge`** so victims see **every** open **(victim, stealer)** window; onchain truth remains **`warbowPendingRevengeExpiryExclusive` / `warbowPendingRevengeStealSeq`** — [invariants §135](../testing/invariants-and-business-logic.md#warbow-per-stealer-revenge-windows-gitlab-135).
- Do not return **actionable** balances without optional **client verification** hints (for example contract call template).

## Configuration

- **RPC URL**, **chain id**, **start block**, **contract address registry** per deployment.
- **Database URL** and migration directory.
- **Production (`INDEXER_PRODUCTION`)** — When truthy (same tokens as [CORS production mode](../../indexer/src/cors_config.rs)), [`Config::from_env`](../../indexer/src/config.rs) rejects **`DATABASE_URL`** values that contain known **placeholder substrings** ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142); **`INV-INDEXER-142`** in [invariants — production DB URL](../testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142), [indexer README](../../indexer/README.md)). Unset **`INDEXER_PRODUCTION`** for local/dev (including `postgres://yieldomega:password@…` from [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)).

## AGPL note

Indexer source in this repo is **AGPL-3.0**. Operators who modify and run it publicly should comply with source-offer requirements ([../licensing.md](../licensing.md)).

---

**Agent phase:** [Phase 12 — Indexer design (Rust + Postgres)](../agent-phases.md#phase-12)
