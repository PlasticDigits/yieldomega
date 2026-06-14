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

<a id="megaeth-wss-realtime-gitlab-237"></a>

### MegaETH WSS / SSE realtime lane (GitLab [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237)) — **deferred**

**Status (verification 2026-06):** Phase 1 from [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237) is **not implemented**. The original issue body referenced **TimeCurve** / **`TimeCurveSimpleAgentCard`**; Arena v2 uses **`TimeArena`**, **`GET /v1/arena/timers`**, and **`IndexerStatusBar`** on **`ArenaSimpleAgentCard`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Replan WSS/SSE stream IDs and Hz tables against Arena surfaces before coding (issue comment 2026-05-30).

**Non-negotiable when implemented:**

| Path | Role |
|------|------|
| **RPC `ingestion::run`** | Authoritative Postgres ingest + **`chain_pointer`** / reorg ([#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140), [#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)) |
| **MegaETH WSS `eth_subscribe("miniBlocks")`** | Best-effort head only in Phase 1 — **no** writes to event tables without RPC reconcile |
| **Indexer → browser** | **SSE** (or snapshot **`GET /v1/realtime/mini-block-head`**) — **not** per-user MegaETH WSS from the static frontend |

**Planned config (not wired):** **`INDEXER_WSS_URL`**, **`INDEXER_WSS_ENABLED`** (default off on Anvil **31337**). Mainnet mini-block semantics require **chain 4326** WSS — Anvil does not expose **`miniBlocks`**.

**Verification while deferred:** `bash scripts/verify-issue-237-wss-deferred.sh` · invariants [**§237**](../testing/invariants-and-business-logic.md#megaeth-wss-realtime-gitlab-237).

**Runtime resilience ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)):** JSON-RPC HTTP clients use a **bounded per-request timeout** (**`INDEXER_RPC_REQUEST_TIMEOUT_SEC`**, default **5s**) so hung transports fail fast instead of freezing ingestion or the chain-timer snapshot loop (**`INV-INDEXER-168`**). Ingestion errors trigger a **supervised retry loop** with backoff in [`main.rs`](../../indexer/src/main.rs). **`GET /v1/status`** exposes **`ingestion_alive`** and **`last_indexed_at_ms`** for operator smoke checks ([invariants §168](../testing/invariants-and-business-logic.md#indexer-ingestion-liveness-and-rpc-timeouts-gitlab-168)).

<a id="indexer-json-rpc-load-benchmark-gitlab-306"></a>

### JSON-RPC load metrics + localnet benchmark (GitLab [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306))

**`INV-INDEXER-306-STATUS-METRICS`:** **`GET /v1/status`** (schema **≥ 2.11.0**) includes **`rpc_metrics`** — rolling **`calls_per_min_1m`**, **`calls_per_min_5m`**, **`peak_calls_10s`**, and per-**method** / per-**caller** counters. Hooks live in [`rpc_http.rs`](../../indexer/src/rpc_http.rs) and [`rpc_metrics.rs`](../../indexer/src/rpc_metrics.rs); structured logs every **`INDEXER_RPC_METRICS_LOG_SEC`** (default **60**). Smoke: `bash scripts/verify-indexer-rpc-metrics.sh`. Full scenario matrix: [`rpc-load-benchmark.md`](rpc-load-benchmark.md) · `bash scripts/benchmark-indexer-rpc-anvil.sh`. **Chain-timer Multicall3 batching ([#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)):** [`multicall.rs`](../../indexer/src/multicall.rs) · [`chain_timer.rs`](../../indexer/src/chain_timer.rs) · Anvil bootstrap [`anvil_multicall3.sh`](../../scripts/lib/anvil_multicall3.sh). Related mitigations: [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237) (WSS hints), [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301) (browser RPC). Invariants: [§306](../testing/invariants-and-business-logic.md#indexer-json-rpc-load-benchmark-gitlab-306) · [§307](../testing/invariants-and-business-logic.md#indexer-chain-timer-multicall-gitlab-307).

## Conceptual entities

Arena v2 Postgres projections (fresh DB only — see [Arena v2 schema](#arena-v2-schema-http-gitlab-254) and [arena-v2.md](../product/arena-v2.md)):

- **`idx_arena_buy`**, **`idx_arena_started`** — **`TimeArena`** **`Buy`** / **`ArenaStarted`**
- **`idx_arena_podium_epoch`**, view **`idx_arena_podium_snapshot`**, **`idx_arena_podium_live`** — rolled epochs and live top-3 ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273))
- **`idx_arena_warbow_steal`**, **`idx_arena_warbow_guard`**, **`idx_arena_warbow_revenge`**, **`idx_warbow_epoch_score`** — WarBow steals/guards/revenges and BP snapshots ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [#292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292))
- **`idx_player_xp`**, **`idx_play_cred_claim`** — **`XpGained`**, **`CredClaimed`**
- **`idx_arena_referral_cred`**, **`idx_arena_referral_applied`**, **`idx_referral_code_registered`** — referral CRED and codes ([#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253))
- **`idx_arena_podium_pool_top_up`**, **`idx_arena_vault_funding`** — manual podium top-ups ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)) and per-buy vault splits ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267))

**Retired:** legacy **`timecurve_*`** / **`idx_timecurve_*`** buy, prize, and WarBow tables; Rabbit Treasury **`Burrow*`** projections — decode paths and HTTP removed ([#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). Historical context: [arena-v2.md § Retired surfaces](../product/arena-v2.md#retired-surfaces), [treasury-contracts.md](../onchain/treasury-contracts.md).

- **factions** — membership rules referencing NFT traits.
- **Derived** winner rows must record **derivation rules** (contract version + block) for auditability.

<a id="arena-v2-schema-http-gitlab-254"></a>

### Arena v2 schema + HTTP ([GitLab #254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254))

Fresh databases use migration [`20240601000000_arena_v2.up.sql`](../../indexer/migrations/20240601000000_arena_v2.up.sql) only (no legacy v1 buy/WarBow tables). Core projections:

| Table / view | Source events |
|--------------|----------------|
| `idx_arena_buy` | `Buy` |
| `idx_arena_started` | `ArenaStarted` |
| `idx_arena_podium_epoch` | `PodiumEpochRolled` |
| `idx_arena_podium_snapshot` | **View** over `idx_arena_podium_epoch` ([`20260601120000_…_gl254`](../../indexer/migrations/20260601120000_idx_arena_podium_snapshot_view_gl254.up.sql)) |
| `idx_arena_podium_live` | Live top-3 per `(category, epoch)` — block-tagged `podium()` snapshots + WarBow BP rollup ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) |
| `idx_arena_warbow_steal` | `WarBowSteal` |
| `idx_arena_warbow_guard` | `WarBowGuard` |
| `idx_arena_warbow_revenge` | `WarBowRevenge` ([#292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292)) |
| `idx_play_cred_claim` | `CredClaimed` |
| `idx_player_xp` | `XpGained` |
| `idx_arena_referral_cred` | `ReferralCredApplied` |
| `idx_arena_referral_applied` | `ReferralApplied` |
| `idx_referral_code_registered` | `ReferralCodeRegistered` |
| `idx_warbow_epoch_score` | Post-log `battlePoints` eth_call snapshots + explicit test/backfill rows ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [`warbow_score.rs`](../../indexer/src/warbow_score.rs)) |
| `idx_arena_podium_pool_top_up` | `PodiumPoolsToppedUp` ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)) |
| `idx_arena_vault_funding` | `PodiumFunded` / `SeedFunded` / `AdminVaultFunded` ([#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267)) |
| `idx_arena_last_buy_epoch_started` | `LastBuyEpochStarted` — global epoch boundary ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)); **`LastBuyEpochCharmAnchored`** anchor columns ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)) |
| `idx_arena_first_buy_cred_scheduled` | `FirstBuyCredScheduled` ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |
| `idx_arena_level_up` | `LevelUp` ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |
| `idx_arena_feature_unlocked` | `FeatureUnlocked` ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |
| `idx_arena_paused_set` | `PausedSet` history ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |
| `idx_arena_warbow_podium_finalized` | `WarbowPodiumFinalized` ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |
| `idx_arena_warbow_flag_claimed` | `WarBowFlagClaimed` ([#317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317)) |

<a id="ingest-side-effects-gitlab-317"></a>

#### Ingest side-effects policy ([GitLab #317](https://gitlab.com/PlasticDigits/yieldomega/-/issues/317))

Post-log **`eth_call`** snapshots that write **`idx_warbow_epoch_score`** ([`warbow_score.rs`](../../indexer/src/warbow_score.rs)) and **`idx_arena_podium_live`** ([`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs)) run inside the same per-block Postgres transaction as decoded event inserts ([#140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140)). **Policy:** RPC snapshot failure **aborts** the block transaction (no warn-and-continue). The supervised ingest loop retries the block; derived tables cannot commit partial/stale state when RPC griefing fails mid-block. Map: **`INV-INDEXER-317-INGEST-SIDE-EFFECTS`** · [invariants §317](../testing/invariants-and-business-logic.md#indexer-timearena-events-gitlab-317).

Decode **`TimeArena`**, **`ReferralRegistry`**, and registry vault contracts per [`decoder.rs`](../../indexer/src/decoder.rs). **Legacy v1 launchpad decode paths and `idx_timecurve_*` tables were removed** ([#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). **Emitted-event completeness** for persisted families (dedicated `idx_*` tables, **`rollback_after` coverage**) remains mandated by [GitLab #112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112) — **`INV-INDEXER-112`** in [invariants — emitted-event coverage](../testing/invariants-and-business-logic.md#indexer-emitted-event-coverage-gitlab-112).

HTTP (schema **≥ 2.6.0**, [`api_arena.rs`](../../indexer/src/api_arena.rs)): **`GET /v1/arena/timers`**, **`GET /v1/arena/podiums`**, **`GET /v1/arena/buys`**, **`GET /v1/arena/activity`**, **`GET /v1/arena/wallet/{address}/stats`**, **`GET /v1/arena/podium-pool-donations`**, **`GET /v1/arena/vault-funding/*`**, **`GET /v1/arena/last-buy-epoch-pricing`** (per-epoch CHARM anchor history from **`idx_arena_last_buy_epoch_started`**), **`GET /v1/arena/warbow/latest-bp?players=0x…`** (batch head BP from **`idx_warbow_epoch_score`**), plus **`GET /v1/referrals/*`** in [`api.rs`](../../indexer/src/api.rs). List routes use **`limit` / `offset`** query params (not opaque cursor tokens). **No** active **`GET /v1/timecurve/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Map: **`INV-INDEXER-254-ARENA-SCHEMA`**, **`INV-INDEXER-PODIUM-PREDICT-LIVE`**, **`INV-FRONTEND-266-ARENA-INDEXER`**, **`INV-FRONTEND-292-ARENA-PRODUCTION-COMPONENTS`** · play skills [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md), [`skills/play-time-arena-doub`](../../skills/play-time-arena-doub/SKILL.md), [`skills/play-time-arena-warbow`](../../skills/play-time-arena-warbow/SKILL.md).

## API guidelines for agents

- Paginate list endpoints with **`limit` / `offset`** (and stable sort keys); expose **schema version** header or field. Opaque **cursor** pagination is **not** implemented on Arena v2 routes ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)).
- **Referrals (GitLab #94; CRED fields [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253); registry union [GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204); global summary [GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225); buyer index [GitLab #165](https://gitlab.com/PlasticDigits/yieldomega/-/issues/165)):** `GET /v1/referrals/referrer-leaderboard` (schema **≥ 2.3.0** CRED fields; global aggregates **≥ 1.25.0**) unions **`idx_referral_code_registered`** and **`idx_arena_referral_cred`**; **`total_referrer_cred_wad`**; `GET /v1/referrals/wallet-cred-summary` aggregates **`idx_arena_referral_cred`** — see [`docs/product/referrals.md`](../product/referrals.md#referrals-dashboard-issue-94) and **`INV-REFERRAL-253-CRED`**. **`INV-INDEXER-165`:** store and bind **lowercase** addresses; use **`referrer` / `buyer = $n`** in SQL (no **`lower(column)`** on indexed columns).
- <a id="indexer-first-api-guidelines-gitlab-301"></a>**Indexer-first display policy ([GitLab #301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)):** One server-side head poller per deployment; browsers must not mirror display reads. **`GET /v1/arena/timers`** (schema **≥ 2.6.0**) adds Arena v2 **sale-head** fields batched at **`read_block_number`**: **`charm_price_wad`**, **`doub`**, **`referral_registry`**, **`buy_cooldown_sec`**, **`timer_extension_sec`**, **`time_arena_buy_router`**, **`referral_cred_flat_wad`**. Frontend maps these via **`coreReadRowsFromArenaTimers`** — no browser multicall for buy-hub head when **`VITE_INDEXER_URL`** is set. Wallet RPC remains for writes and submit-time preflight only. See [arena-views §301](../frontend/arena-views.md#indexer-first-display-gitlab-301).
- <a id="arena-timers-http-gitlab-216"></a>**Arena head timers (`GET /v1/arena/timers`, schema ≥ 2.5.0, [GitLab #254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), head fields [#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216), sale-head [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)):** Background **`TimeArena`** poller ([`chain_timer.rs`](../../indexer/src/chain_timer.rs), [`sale_state.rs`](../../indexer/src/sale_state.rs)) at shared **`read_block_number`**. JSON: Last Buy deadline, four podium deadlines, **`last_buy_epoch`** / **`podium_epochs`**, **`paused`**, **`total_doub_raised`**, **`arena_start_sec`**, plus schema **≥ 2.6.0** sale-head fields (see [#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). **503** when **`ADDRESS_REGISTRY`** lacks **`TimeArena`** or the poller snapshot is unset. Replaces legacy **`GET /v1/timecurve/chain-timer`** and **`GET /v1/timecurve/sale-state`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)). Frontend uses this when **`VITE_INDEXER_URL`** is set; submit-time sizing/preflight still uses fresh RPC.
- <a id="arena-podiums-http"></a>**Arena live podiums (`GET /v1/arena/podiums`, schema ≥ 2.5.0 live leaders, **≥ 2.8.0** prize preview [#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302), [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)):** Rows are **UX-ordered** (**Last Buy**, **WarBow**, **Defended Streak**, **Time Booster**) with **`category_index`** (onchain cat). **`epoch`** per row is head **`lastBuyEpoch`** (cat 0) or **`podiumEpoch[cat]`** from the head poller. Ingest writes **`idx_arena_podium_live`** on **`Buy`**, WarBow BP-affecting logs, **`LastBuyEpochStarted`**, and **`PodiumEpochRolled`** (block-tagged **`podium()`** eth_call). WarBow leaders prefer **`idx_warbow_epoch_score`** top-3 when head **`podium(3)`** is empty mid-epoch. **`podium_prediction: true`** only when winners come from Postgres; otherwise RPC fallback at **`read_block_number`**. Last Buy keeps **`last_buy_prediction`**. Schema **≥ 2.8.0** adds **`active_pool_balance_doub_wad`** and **`prize_places_doub_wad`** (1st/2nd/3rd) from head **`PodiumVaults.activePoolBalance(category_index)`** × 4∶2∶1 — display preview only; settlement remains on-chain at epoch roll. Map: **`INV-INDEXER-PODIUM-PREDICT-LIVE`**, **`INV-INDEXER-PODIUM-PRIZE-PREVIEW`** · [`arena_podium_live.rs`](../../indexer/src/arena_podium_live.rs) · [`arena_podium_prize.rs`](../../indexer/src/arena_podium_prize.rs) · [`chain_timer.rs`](../../indexer/src/chain_timer.rs) · [`api_arena.rs`](../../indexer/src/api_arena.rs) · `bash scripts/verify-podium-prize-preview-anvil.sh`.
- **WarBow persistence:** Steals, guards, and revenges land in **`idx_arena_warbow_steal`** / **`idx_arena_warbow_guard`** / **`idx_arena_warbow_revenge`**; BP snapshots in **`idx_warbow_epoch_score`**. Legacy **`idx_timecurve_warbow_*`** and WarBow HTTP (`battle-feed`, `pending-revenge`, `refresh-candidates`) were removed with **`/v1/timecurve/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266), [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)). Wallet-level WarBow counts: **`GET /v1/arena/wallet/{address}/stats`** ([#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)).
- <a id="arena-activity-http-gitlab-292"></a>**Arena activity (`GET /v1/arena/activity`, schema ≥ 2.6.0, [GitLab #292](https://gitlab.com/PlasticDigits/yieldomega/-/issues/292)):** Paginated union over **`idx_arena_buy`**, **`idx_arena_warbow_steal`**, **`idx_arena_warbow_guard`**, and **`idx_arena_warbow_revenge`** ordered by block/log desc. Items include **`kind`** (`buy` / `steal` / `guard` / `revenge`), **`actor`**, optional **`target`**, **`amount_doub_wad`**, optional **`charm_wad`**, **`seconds_delta`**, **`bp_delta`**, **`guard_until`**, tx identity, and `block_timestamp`. Frontend `/arena/protocol` uses it for the action feed and falls back to `GET /v1/arena/buys` when older indexers do not serve the route.
- <a id="arena-buys-http-gitlab-282"></a>**Arena recent buys (`GET /v1/arena/buys`, schema ≥ 2.5.0, [GitLab #254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), seconds [#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282), log identity [#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)):** Paginated rows from **`idx_arena_buy`** (`limit` 1–200). Each item includes **`buyer`**, **`charm_wad`**, **`doub_paid`**, **`block_number`**, **`tx_hash`**, **`timer_hard_reset`**, **`paid_with_cred`**, **`actual_seconds_added`** (decimal string — effective Last Buy timer extension from the onchain **`Buy`** log; not recomputed in the API), **`new_deadline`** and **`buy_index`** (decimal strings from the **`Buy`** log), **`log_index`** (JSON number — PK with **`tx_hash`**), and **`block_timestamp`** (unix seconds string from RPC block time at ingest, or JSON **`null`** when the column is NULL — same encoding as vault-funding / donate-pools). Values match ingest/DB for the same **`tx_hash`** / **`log_index`**. Map: **`INV-INDEXER-282-ARENA-BUYS-SECONDS`**, **`INV-INDEXER-283-ARENA-BUYS-PARITY`** · [`api_arena.rs`](../../indexer/src/api_arena.rs) · Anvil smoke: **`bash scripts/verify-wallet-profile-anvil.sh`** (dedicated **`ANVIL_PORT`** / **`INDEXER_PORT`** default **8548** / **3103**).
- <a id="arena-wallet-stats-http-gitlab-255"></a>

### Arena wallet stats (`GET /v1/arena/wallet/{address}/stats`, schema ≥ 2.4.0, [GitLab #255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255))

Participant profile modal aggregates from **`idx_arena_buy`**, **`idx_arena_podium_epoch`**, **`idx_player_xp`**, **`idx_play_cred_claim`**, **`idx_arena_referral_cred`**, **`idx_arena_warbow_steal`**, **`idx_arena_warbow_guard`**. Response includes **`epochs_participated`** (distinct stored **`last_buy_epoch`** on wallet buys — global Last Buy epoch, not per-wallet hard-reset inference ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278))), **`prizes_won[]`** (4:2:1 **`pool_paid`** split from **`ArenaPodiumSettlement`**), **`highest_scores[]`** (derived per-podium peaks), and bonus fields (**`longest_defended_streak`**, **`warbow_guards`**, **`referral_cred_earned`**, **`podium_win_rate`**, **`rank_distribution`**). Empty wallet → zeros / empty arrays (not 404). Map: **`INV-INDEXER-255-WALLET-STATS`** · invariants §255 · [`arena_wallet_stats.rs`](../../indexer/src/arena_wallet_stats.rs) · frontend [`WalletProfileModal.tsx`](../../frontend/src/components/WalletProfileModal.tsx).

<a id="arena-podium-pool-donations-http-gitlab-262"></a>**Podium pool donations (`GET /v1/arena/podium-pool-donations`, schema ≥ 2.1.0, [GitLab #262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262), onchain [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)):** Persists **`PodiumPoolsToppedUp`** into **`idx_arena_podium_pool_top_up`** (`donor_address` lowercase). Response: **`total_donated_doub_wad`**, **`unique_donors_count`**, **`recent[]`** (default **`limit=10`**), optional **`donor_summary`** when **`?donor=0x…`**. Empty DB → zeros / empty arrays. Map: **`INV-INDEXER-262-DONATE-POOLS`** · invariants §262 · [`api_arena.rs`](../../indexer/src/api_arena.rs).

- <a id="arena-last-buy-epoch-gitlab-278"></a>**Last Buy epoch persistence ([GitLab #278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)):** Ingest maintains a running global **`lastBuyEpoch`** head while processing logs in block order. **`LastBuyEpochStarted`** → **`idx_arena_last_buy_epoch_started`**; each **`Buy`** stores **`idx_arena_buy.last_buy_epoch`** equal to onchain epoch at that log position (event emitted **before** `Buy` in the same hard-reset tx). Wallet stats and epoch-scoped aggregates read the column — no `SUM() OVER (timer_hard_reset)` inference. Reorg rollback includes the epoch table. Map: **`INV-INDEXER-278-LAST-BUY-EPOCH`** · [`last_buy_epoch_head.rs`](../../indexer/src/last_buy_epoch_head.rs) · [`persist.rs`](../../indexer/src/persist.rs) · Anvil: **`bash scripts/verify-last-buy-epoch-anvil.sh`**. Deployed indexers with pre-migration rows must reindex from deploy block.
- <a id="arena-vault-funding-http-gitlab-267"></a>**Buy vault funding (`GET /v1/arena/vault-funding/*`, schema ≥ 2.7.0 for `target_epoch`, [GitLab #267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267), [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)):** Persists **`PodiumEpochFunded`** (buy path) and legacy **`PodiumFunded` / `SeedFunded`** (manual top-up) into **`idx_arena_vault_funding`** (`kind`: `podium_epoch` with **`target_epoch`**, or `podium_active` / `podium_seed`). Routes: **`…/recent?limit=&offset=`**, **`…/by-tx/{tx_hash}`** (12 rows typical for 1000 DOUB buy), **`…/totals`**. Empty DB → zeros / **`[]`**. Reorg rollback includes this table. **`topUpPodiumPools`** rows stay in **`idx_arena_podium_pool_top_up`** only ([#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262)). Map: **`INV-INDEXER-267-VAULT-FUNDING`**, **`INV-ARENA-PRIZE-ROUTING-300-INDEXER`** · invariants §267 · [§300](../testing/invariants-and-business-logic.md#arena-prize-routing-gitlab-300) · [manual QA §267](../testing/manual-qa-checklists.md#manual-qa-issue-267) · [`api_arena.rs`](../../indexer/src/api_arena.rs). Anvil smoke: **`bash scripts/verify-vault-funding-anvil.sh`**.
- <a id="arena-platform-usage-http-gitlab-231"></a>**Platform usage (`GET /v1/arena/platform-usage`, schema ≥ 2.12.0, [GitLab #231](https://gitlab.com/PlasticDigits/yieldomega/-/issues/231), restored [#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)):** Network-wide aggregates from **`idx_arena_buy`** (partial index **`idx_arena_buy_block_timestamp`**) plus **`idx_arena_warbow_steal`** / **`idx_arena_warbow_guard`** / **`idx_arena_warbow_revenge`** for WarBow **`doub_spent`** totals and buy **velocity** windows (`velocity_window` = `1h` | `24h` | `sale`) anchored on the head poller **`block_timestamp_sec`** / **`arena_start_sec`**. Wallet leaderboard paginates with `limit`/`offset`. JSON field **`cl8y_spent_wei`** carries **DOUB wad** totals for Arena v2 compatibility with the legacy TimeCurve schema. Map: **`INV-INDEXER-319-PLATFORM-USAGE`** · [`arena_platform_usage.rs`](../../indexer/src/arena_platform_usage.rs).
- <a id="arena-buys-cursor-gitlab-319"></a>**Cursor pagination ([GitLab #319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)):** `GET /v1/arena/buys` and `GET /v1/arena/activity` accept optional **`cursor`** (`{block_number}:{log_index}`) with **`next_cursor`** in responses; **`offset`** remains for compatibility. **`idx_arena_buy.pay_kind`** (nullable) is set when ingest processes **`BuyViaKumbaya`** on **`TimeArenaBuyRouter`** (same `tx_hash` as the arena **`Buy`**). Map: **`INV-INDEXER-319-KUMBAYA-BUY`** · [`api_cursor.rs`](../../indexer/src/api_cursor.rs).
- Do not return **actionable** balances without optional **client verification** hints (for example contract call template).

## Configuration

- **RPC URL**, **chain id**, **start block**, **contract address registry** per deployment.
- **Database URL** and migration directory.
- **Production (`INDEXER_PRODUCTION`)** — When truthy (same tokens as [CORS production mode](../../indexer/src/cors_config.rs)), [`Config::from_env`](../../indexer/src/config.rs) rejects **`DATABASE_URL`** values that contain known **placeholder substrings** ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142); **`INV-INDEXER-142`** in [invariants — production DB URL](../testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142), [indexer README](../../indexer/README.md)) and **fail-closes** on **`ADDRESS_REGISTRY`** / **`CHAIN_ID`** misconfiguration when ingestion is enabled ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156); **`INV-INDEXER-156`** in [invariants — production registry](../testing/invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)). Unset **`INDEXER_PRODUCTION`** for local/dev (including `postgres://yieldomega:password@…` from [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)).

## AGPL note

Indexer source in this repo is **AGPL-3.0**. Operators who modify and run it publicly should comply with source-offer requirements ([../licensing.md](../licensing.md)).

---

**Agent phase:** [Phase 12 — Indexer design (Rust + Postgres)](../agent-phases.md#phase-12)
