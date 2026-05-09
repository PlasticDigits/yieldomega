# Indexer design (Rust + Postgres)

## Purpose

The indexer is an **offchain read model**. It **follows** MegaETH chain history, **decodes** contract events, and **stores** query-friendly projections in **Postgres**. It serves the **static frontend** and **autonomous agents** with low-latency aggregates (leaderboards, histories, faction stats).

It must **never** be the **authority** for balances, winners, or treasury outcomes ([../architecture/overview.md](../architecture/overview.md)).

<a id="accesscontrol-zero-admin-gitlab-120"></a>

**Deploy tx boundary ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)):** Contracts that **`require(admin != address(0)`** during **`initializer` / `constructor`** revert **without emitting** Yieldomega **`event`s** afterward. **`INV-INDEXER-120-DEPLOY`** applies: the indexer’s job starts at **successful** bytecode at **`ADDRESS_REGISTRY`** addresses—Forge coverage **`AccessControlZeroAdmin.t.sol`** is the invariant hook, not Postgres. See **[`INV-INDEXER-120-DEPLOY`](../testing/invariants-and-business-logic.md#indexer-accesscontrol-deploy-footgun-gitlab-120)** and [indexer README — #120](../../indexer/README.md#accesscontrol-zero-admin-gitlab-120).

**Fee and routing parameters:** Contracts should emit **old value, new value, actor** on changes ([invariant: parameter change events](../onchain/fee-routing-and-governance.md#invariant-parameter-change-events)); the indexer should decode and store them for reconciliation. Canonical sinks and governance intent: [fee sinks](../onchain/fee-routing-and-governance.md#fee-sinks), [governance actors](../onchain/fee-routing-and-governance.md#governance-actors).

## Core responsibilities

1. **Ingestion** — Follow new heads via JSON-RPC or streaming APIs (mechanism TBD). Respect MegaETH **~1s** block time. **Per block**, persist all decoded registry logs and advance metadata (**`indexed_blocks`**, **`chain_pointer`**) in **one** SQL transaction so crashes or failures cannot leave a half-ingested block ([GitLab #140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140); **`INV-INDEXER-140`** in [invariants](../testing/invariants-and-business-logic.md#indexer-transactional-block-ingestion-gitlab-140); umbrella [#146](https://gitlab.com/PlasticDigits/yieldomega/-/issues/146)). **`persist_decoded_log_conn`** is the shared insert path; **`persist_decoded_log_autocommit`** is an explicit pool wrapper for **single-event** calls ([GitLab #148](../testing/invariants-and-business-logic.md#post-138-hygiene-naming-gitlab-148)).
2. **Deterministic decoding** — Map logs to ABIs; reject unknown signatures or version them explicitly.
3. **Reorg handling** — Track a **canonical chain pointer** and **rollback** to common ancestor on reorg; reapply blocks. Depth policy must be documented (for example finalize after N confirmations for UI badges).
4. **Persistence** — Normalized tables + optional materialized views for heavy queries.
5. **API** — HTTP (REST or GraphQL TBD) with stable schemas **versioned** for agents.

<a id="http-api-error-bodies-gitlab-157"></a>

**Public HTTP error bodies ([GitLab #157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157)):** When a read handler hits an unexpected **`sqlx::Error`**, the JSON response uses a **generic** **`error`** string; full failure text is **`tracing::error!`** only (**`INV-INDEXER-157`** in [invariants — § #157](../testing/invariants-and-business-logic.md#indexer-public-api-500-error-redaction-gitlab-157), [`api.rs`](../../indexer/src/api.rs)).

<a id="indexer-runtime-resilience-gitlab-168"></a>

**Runtime resilience ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)):** JSON-RPC HTTP clients use a **bounded per-request timeout** (**`INDEXER_RPC_REQUEST_TIMEOUT_SEC`**, default **5s**) so hung transports fail fast instead of freezing ingestion or the chain-timer snapshot loop (**`INV-INDEXER-168`**). Ingestion errors trigger a **supervised retry loop** with backoff in [`main.rs`](../../indexer/src/main.rs). **`GET /v1/status`** exposes **`ingestion_alive`** and **`last_indexed_at_ms`** for operator smoke checks ([invariants §168](../testing/invariants-and-business-logic.md#indexer-ingestion-liveness-and-rpc-timeouts-gitlab-168)).

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

Also decode **`TimeCurve`** governance / wiring events (**`BuyFeeRoutingEnabled`**, **`CharmRedemptionEnabled`**, **`ReservePodiumPayoutsEnabled`**, **`TimeCurveBuyRouterSet`**), **`TimeCurve`** **`PodiumResidualRecipientSet`** ([GitLab #139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139); **`idx_timecurve_podium_residual_recipient_set`**), **`TimeCurve`** **`PrizesDistributed`** and **`PrizesSettledEmptyPodiumPool`** ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133); **`GET /v1/timecurve/prize-distributions`** merges both), **`PodiumPool` `PrizePusherSet`**, **`DoubPresaleVesting` lifecycle + `Claimed` / `ClaimsEnabled` / `RescueERC20`** ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)), **`TimeCurveBuyRouter` `BuyViaKumbaya` / `Cl8ySurplusToProtocol` / `EthRescued` / `Erc20Rescued`** (router rescue events are **ABI-distinct** from **`FeeRouter.ERC20Rescued`** — [GitLab #139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139), [GitLab #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117)), **`FeeRouter` `DistributableTokenUpdated` / `ERC20Rescued`** ([GitLab #122](https://gitlab.com/PlasticDigits/yieldomega/-/issues/122)), and **`FeeSink` `Withdrawn`** per the migrations in `indexer/migrations/` and `indexer/src/decoder.rs` (same #112 completeness rule).
- **factions** — membership rules referencing NFT traits.

**Derived** winner rows must record **derivation rules** (contract version + block) for auditability.

## API guidelines for agents

- Paginate all list endpoints; include **cursor** or **block-height** watermarks.
- Expose **schema version** header or field.
- **Referrals (GitLab #94; predicates + buyer index [GitLab #165](https://gitlab.com/PlasticDigits/yieldomega/-/issues/165)):** `GET /v1/referrals/referrer-leaderboard` and `GET /v1/referrals/wallet-charm-summary` aggregate **`idx_timecurve_referral_applied` only** — see [`docs/product/referrals.md`](../product/referrals.md#referrals-dashboard-issue-94) and the test map in [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#referrals-leaderboard-and-earnings-issue-94). **`INV-INDEXER-165`:** store and bind **lowercase** addresses; use **`referrer` / `buyer = $n`** in SQL (no **`lower(column)`** on indexed columns) — [invariants — § #165](../testing/invariants-and-business-logic.md#indexer-referral-applied-address-predicates-gitlab-165); migration **`20260506210000_idx_timecurve_referral_applied_buyer`**.
- **WarBow pending revenge (GitLab #135):** `GET /v1/timecurve/warbow/pending-revenge` reconciles **`WarBowRevengeWindowOpened`** rows in **`idx_timecurve_warbow_revenge_window`** against **`WarBowRevenge`** so victims see **every** open **(victim, stealer)** window; onchain truth remains **`warbowPendingRevengeExpiryExclusive` / `warbowPendingRevengeStealSeq`** — [invariants §135](../testing/invariants-and-business-logic.md#warbow-per-stealer-revenge-windows-gitlab-135).
- **WarBow refresh candidates (GitLab #160, hint timing #170, unbounded DISTINCT #172):** `GET /v1/timecurve/warbow/refresh-candidates` (schema **≥ 1.15.1**, **≥ 1.18.0** drops **`distinct_sql_cap_hit`**) serves a deduped **`candidates`** list for **operator reference** — head WarBow podium hints apply only while **`chain_timer`** reports **`!sale_ended`**; body includes **`sale_ended`** — see **`INV-INDEXER-160-WARBOW-REFRESH-CANDIDATES`**, **`INV-INDEXER-170-WARBOW-REFRESH-POSTEND`**, and **`INV-WARBOW-172-*`** in [invariants §149 / §170](../testing/invariants-and-business-logic.md#gitlab-149-warbow-arena-indexer-hardening).
- Do not return **actionable** balances without optional **client verification** hints (for example contract call template).

## Configuration

- **RPC URL**, **chain id**, **start block**, **contract address registry** per deployment.
- **Database URL** and migration directory.
- **Production (`INDEXER_PRODUCTION`)** — When truthy (same tokens as [CORS production mode](../../indexer/src/cors_config.rs)), [`Config::from_env`](../../indexer/src/config.rs) rejects **`DATABASE_URL`** values that contain known **placeholder substrings** ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142); **`INV-INDEXER-142`** in [invariants — production DB URL](../testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142), [indexer README](../../indexer/README.md)) and **fail-closes** on **`ADDRESS_REGISTRY`** / **`CHAIN_ID`** misconfiguration when ingestion is enabled ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156); **`INV-INDEXER-156`** in [invariants — production registry](../testing/invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)). Unset **`INDEXER_PRODUCTION`** for local/dev (including `postgres://yieldomega:password@…` from [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)).

## AGPL note

Indexer source in this repo is **AGPL-3.0**. Operators who modify and run it publicly should comply with source-offer requirements ([../licensing.md](../licensing.md)).

---

**Agent phase:** [Phase 12 — Indexer design (Rust + Postgres)](../agent-phases.md#phase-12)
