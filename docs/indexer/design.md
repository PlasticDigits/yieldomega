# Indexer design (Rust + Postgres)

## Purpose

The indexer is an **offchain read model**. It **follows** MegaETH chain history, **decodes** contract events, and **stores** query-friendly projections in **Postgres**. It serves the **static frontend** and **autonomous agents** with low-latency aggregates (leaderboards, histories, faction stats).

It must **never** be the **authority** for balances, winners, or treasury outcomes ([../architecture/overview.md](../architecture/overview.md)).

<a id="accesscontrol-zero-admin-gitlab-120"></a>

**Deploy tx boundary ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120)):** Contracts that **`require(admin != address(0)`** during **`initializer` / `constructor`** revert **without emitting** Yieldomega **`event`s** afterward. **`INV-INDEXER-120-DEPLOY`** applies: the indexer’s job starts at **successful** bytecode at **`ADDRESS_REGISTRY`** addresses—Forge coverage **`AccessControlZeroAdmin.t.sol`** is the invariant hook, not Postgres. See **`INV-INDEXER-120-DEPLOY`** and [indexer README — #120](../../indexer/README.md#accesscontrol-zero-admin-gitlab-120).

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

Arena v2 Postgres projections (fresh DB only — see [Arena v2 schema](#arena-v2-schema-http-gitlab-254) and [arena-v2.md](../product/arena-v2.md)):

- **`idx_arena_buy`**, **`idx_arena_started`** — **`TimeArena`** **`Buy`** / **`ArenaStarted`**
- **`idx_arena_podium_epoch`**, view **`idx_arena_podium_snapshot`**, **`idx_arena_podium_live`** — rolled epochs and live top-3 ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273))
- **`idx_arena_warbow_steal`**, **`idx_arena_warbow_guard`**, **`idx_warbow_epoch_score`** — WarBow steals/guards and BP snapshots ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))
- **`idx_player_xp`**, **`idx_play_cred_claim`** — **`XpGained`**, **`CredClaimed`**
- **`idx_arena_referral_cred`**, **`idx_arena_referral_applied`**, **`idx_referral_code_registered`** — referral CRED and codes ([#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253))
- **`idx_arena_podium_pool_top_up`**, **`idx_arena_vault_funding`** — manual podium top-ups ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)) and per-buy vault splits ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267))

**Retired:** legacy **`timecurve_*`** / **`idx_timecurve_*`** buy, prize, and WarBow tables; Rabbit Treasury **`Burrow*`** projections — decode paths and HTTP removed ([#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). Historical Rabbit spec: [rabbit-treasury.md](../product/rabbit-treasury.md).

- **factions** — membership rules referencing NFT traits.
- **Derived** winner rows must record **derivation rules** (contract version + block) for auditability.

<a id="arena-v2-schema-http-gitlab-254"></a>

### Arena v2 schema + HTTP ([GitLab #254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))

Fresh databases use migration [`20240601000000_arena_v2.up.sql`](../../indexer/migrations/20240601000000_arena_v2.up.sql) only (no TimeCurve buy/WarBow tables). Core projections:

| Table / view | Source events |
|--------------|----------------|
| `idx_arena_buy` | `Buy` |
| `idx_arena_started` | `ArenaStarted` |
| `idx_arena_podium_epoch` | `PodiumEpochRolled` |
| `idx_arena_podium_snapshot` | **View** over `idx_arena_podium_epoch` ([`20260601120000_…_gl254`](../../indexer/migrations/20260601120000_idx_arena_podium_snapshot_view_gl254.up.sql)) |
| `idx_arena_podium_live` | Live top-3 per `(category, epoch)` — block-tagged `podium()` snapshots + WarBow BP rollup ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) |
| `idx_arena_warbow_steal` | `WarBowSteal` |
| `idx_arena_warbow_guard` | `WarBowGuard` |
| `idx_play_cred_claim` | `CredClaimed` |
| `idx_player_xp` | `XpGained` |
| `idx_arena_referral_cred` | `ReferralCredApplied` |
| `idx_arena_referral_applied` | `ReferralApplied` |
| `idx_referral_code_registered` | `ReferralCodeRegistered` |
| `idx_warbow_epoch_score` | Post-log `battlePoints` eth_call snapshots + explicit test/backfill rows ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [`warbow_score.rs`](../../indexer/src/warbow_score.rs)) |
| `idx_arena_podium_pool_top_up` | `PodiumPoolsToppedUp` ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)) |
| `idx_arena_vault_funding` | `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267)) |

Decode **`TimeArena`**, **`ReferralRegistry`**, and registry vault contracts per [`decoder.rs`](../../indexer/src/decoder.rs). **Legacy TimeCurve / FeeRouter / TimeCurveBuyRouter / Rabbit `Burrow*` decode paths and `idx_timecurve_*` tables were removed** ([#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). **Emitted-event completeness** for persisted families (dedicated `idx_*` tables, **`rollback_after` coverage**) remains mandated by [GitLab #112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112) — **`INV-INDEXER-112`** in [invariants — emitted-event coverage](../testing/invariants-and-business-logic.md#indexer-emitted-event-coverage-gitlab-112).

HTTP (schema **≥ 2.5.0**, [`api_arena.rs`](../../indexer/src/api_arena.rs)): **`GET /v1/arena/timers`**, **`GET /v1/arena/podiums`**, **`GET /v1/arena/buys`**, **`GET /v1/arena/wallet/{address}/stats`**, **`GET /v1/arena/podium-pool-donations`**, **`GET /v1/arena/vault-funding/*`**, plus **`GET /v1/referrals/*`** in [`api.rs`](../../indexer/src/api.rs). **No** active **`GET /v1/timecurve/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Map: **`INV-INDEXER-254-ARENA-SCHEMA`**, **`INV-INDEXER-PODIUM-PREDICT-LIVE`**, **`INV-FRONTEND-266-ARENA-INDEXER`** · play skills [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md), [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md).

## API guidelines for agents

- Paginate all list endpoints; include **cursor** or **block-height** watermarks.
- Expose **schema version** header or field.
- **Referrals (GitLab #94; CRED fields [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253); registry union [GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204); global summary [GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225); buyer index [GitLab #165](https://gitlab.com/PlasticDigits/yieldomega/-/issues/165)):** `GET /v1/referrals/referrer-leaderboard` (schema **≥ 2.3.0** CRED fields; global aggregates **≥ 1.25.0**) unions **`idx_referral_code_registered`** and **`idx_arena_referral_cred`**; **`total_referrer_cred_wad`**; `GET /v1/referrals/wallet-cred-summary` aggregates **`idx_arena_referral_cred`** — see [`docs/product/referrals.md`](../product/referrals.md#referrals-dashboard-issue-94) and **`INV-REFERRAL-253-CRED`**. **`INV-INDEXER-165`:** store and bind **lowercase** addresses; use **`referrer` / `buyer = $n`** in SQL (no **`lower(column)`** on indexed columns).
- <a id="arena-timers-http-gitlab-216"></a>**Arena head timers (`GET /v1/arena/timers`, schema ≥ 2.5.0, [GitLab #254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), head fields [#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)):** Background **`TimeArena`** poller ([`chain_timer.rs`](../../indexer/src/chain_timer.rs), [`sale_state.rs`](../../indexer/src/sale_state.rs)) at shared **`read_block_number`**. JSON: Last Buy deadline, four podium deadlines, **`last_buy_epoch`** / **`podium_epochs`**, **`paused`**, **`total_doub_raised`**, **`arena_start_sec`**. **503** when **`ADDRESS_REGISTRY`** lacks **`TimeArena`** or the poller snapshot is unset. Replaces legacy **`GET /v1/timecurve/chain-timer`** and **`GET /v1/timecurve/sale-state`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Frontend uses this when **`VITE_INDEXER_URL`** is set; submit-time sizing/preflight still uses fresh RPC.
- <a id="arena-podiums-http"></a>**Arena live podiums (`GET /v1/arena/podiums`, schema ≥ 2.5.0, [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)):** Rows are **UX-ordered** (**Last Buy**, **WarBow**, **Defended Streak**, **Time Booster**) with **`category_index`** (onchain cat). **`epoch`** per row is head **`lastBuyEpoch`** (cat 0) or **`podiumEpoch[cat]`** from the head poller. Ingest writes **`idx_arena_podium_live`** on **`Buy`**, WarBow BP-affecting logs, **`LastBuyEpochStarted`**, and **`PodiumEpochRolled`** (block-tagged **`podium()`** eth_call). WarBow leaders prefer **`idx_warbow_epoch_score`** top-3 when head **`podium(3)`** is empty mid-epoch. **`podium_prediction: true`** only when winners come from Postgres; otherwise RPC fallback at **`read_block_number`**. Last Buy keeps **`last_buy_prediction`**. Map: **`INV-INDEXER-PODIUM-PREDICT-LIVE`** · [`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs) · [`api_arena.rs`](../../indexer/src/api_arena.rs).
- **WarBow persistence:** Steals and guards land in **`idx_arena_warbow_steal`** / **`idx_arena_warbow_guard`**; BP snapshots in **`idx_warbow_epoch_score`**. Legacy **`idx_timecurve_warbow_*`** and WarBow HTTP (`battle-feed`, `pending-revenge`, `refresh-candidates`) were removed with **`/v1/timecurve/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). Wallet-level WarBow counts: **`GET /v1/arena/wallet/{address}/stats`** ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)).
- <a id="arena-wallet-stats-http-gitlab-255"></a>

### Arena wallet stats (`GET /v1/arena/wallet/{address}/stats`, schema ≥ 2.4.0, [GitLab #255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255))

Participant profile modal aggregates from **`idx_arena_buy`**, **`idx_arena_podium_epoch`**, **`idx_player_xp`**, **`idx_play_cred_claim`**, **`idx_arena_referral_cred`**, **`idx_arena_warbow_steal`**, **`idx_arena_warbow_guard`**. Response includes **`epochs_participated`** (distinct Last Buy epochs via **`timer_hard_reset`** window), **`prizes_won[]`** (4:2:1 **`pool_paid`** split from **`ArenaPodiumSettlement`**), **`highest_scores[]`** (derived per-podium peaks), and bonus fields (**`longest_defended_streak`**, **`warbow_guards`**, **`referral_cred_earned`**, **`podium_win_rate`**, **`rank_distribution`**). Empty wallet → zeros / empty arrays (not 404). Map: **`INV-INDEXER-255-WALLET-STATS`** · invariants §255 · [`arena_wallet_stats.rs`](../../indexer/src/arena_wallet_stats.rs) · frontend [`WalletProfileModal.tsx`](../../frontend/src/components/WalletProfileModal.tsx).

<a id="arena-podium-pool-donations-http-gitlab-262"></a>**Podium pool donations (`GET /v1/arena/podium-pool-donations`, schema ≥ 2.1.0, [GitLab #262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262), onchain [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)):** Persists **`PodiumPoolsToppedUp`** into **`idx_arena_podium_pool_top_up`** (`donor_address` lowercase). Response: **`total_donated_doub_wad`**, **`unique_donors_count`**, **`recent[]`** (default **`limit=10`**), optional **`donor_summary`** when **`?donor=0x…`**. Empty DB → zeros / empty arrays. Map: **`INV-INDEXER-262-DONATE-POOLS`** · invariants §262 · [`api_arena.rs`](../../indexer/src/api_arena.rs).
- <a id="arena-vault-funding-http-gitlab-267"></a>**Buy vault funding (`GET /v1/arena/vault-funding/*`, schema ≥ 2.2.0, [GitLab #267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267)):** Persists **`PodiumFunded`**, **`SeedFunded`**, **`AdminVaultFunded`** (from registry **`PodiumVaults`** / **`AdminSellVault`** addresses) into **`idx_arena_vault_funding`**. Routes: **`…/recent?limit=&offset=`**, **`…/by-tx/{tx_hash}`** (9 rows typical for 1000 DOUB buy), **`…/totals`**. Empty DB → zeros / **`[]`**. Reorg rollback includes this table. **`topUpPodiumPools`** rows stay in **`idx_arena_podium_pool_top_up`** only ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)). Map: **`INV-INDEXER-267-VAULT-FUNDING`** · invariants §267 · [`api_arena.rs`](../../indexer/src/api_arena.rs). Manual QA: ingest one Anvil DOUB buy → **`GET …/by-tx/0x…`** shows 40/30/30 breakdown.
- <a id="arena-platform-usage-http-gitlab-231"></a>**Platform usage (retired HTTP, [GitLab #231](https://gitlab.com/PlasticDigits/yieldomega/-/issues/231), [#233](https://gitlab.com/PlasticDigits/yieldomega/-/issues/233), [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)):** Legacy **`GET /v1/timecurve/platform-usage`** is not served; the AUDIT page stub reads **`GET /v1/arena/timers`** until a restored **`GET /v1/arena/platform-usage`** ships. Intended aggregates use **`idx_arena_buy`** (partial index **`idx_arena_buy_block_timestamp`**) plus **`idx_arena_warbow_steal`** / **`idx_arena_warbow_guard`** for WarBow **`doub_spent`** totals and buy **velocity** windows anchored on the head poller **`block_timestamp_sec`** / **`arena_start_sec`**.
- Do not return **actionable** balances without optional **client verification** hints (for example contract call template).

## Configuration

- **RPC URL**, **chain id**, **start block**, **contract address registry** per deployment.
- **Database URL** and migration directory.
- **Production (`INDEXER_PRODUCTION`)** — When truthy (same tokens as [CORS production mode](../../indexer/src/cors_config.rs)), [`Config::from_env`](../../indexer/src/config.rs) rejects **`DATABASE_URL`** values that contain known **placeholder substrings** ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142); **`INV-INDEXER-142`** in [invariants — production DB URL](../testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142), [indexer README](../../indexer/README.md)) and **fail-closes** on **`ADDRESS_REGISTRY`** / **`CHAIN_ID`** misconfiguration when ingestion is enabled ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156); **`INV-INDEXER-156`** in [invariants — production registry](../testing/invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)). Unset **`INDEXER_PRODUCTION`** for local/dev (including `postgres://yieldomega:password@…` from [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)).

## AGPL note

Indexer source in this repo is **AGPL-3.0**. Operators who modify and run it publicly should comply with source-offer requirements ([../licensing.md](../licensing.md)).

---

**Agent phase:** [Phase 12 — Indexer design (Rust + Postgres)](../agent-phases.md#phase-12)
