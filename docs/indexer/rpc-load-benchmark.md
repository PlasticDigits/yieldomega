# Indexer JSON-RPC load benchmark (GitLab [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306))

Measure **average and peak JSON-RPC requests per minute** from a single indexer process on localnet (Anvil), broken down by **method** and **subsystem**, without guessing provider quotas.

Cross-links: [`indexer/README.md`](../../indexer/README.md) · [`design.md`](design.md) · [`invariants §306`](../testing/invariants-and-business-logic.md#indexer-json-rpc-load-benchmark-gitlab-306) · play skill [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md).

## Instrumentation

The indexer records every logical JSON-RPC call at the shared transport layer ([`indexer/src/rpc_http.rs`](../../indexer/src/rpc_http.rs), [`indexer/src/rpc_metrics.rs`](../../indexer/src/rpc_metrics.rs)):

| Field | Meaning |
|-------|---------|
| `by_method` | `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getLogs`, `eth_call` |
| `by_caller` | `ingestion`, `chain_timer`, `podium_live`, `warbow_score`, `reorg` |
| `calls_per_min_1m` / `calls_per_min_5m` | Rolling window rates |
| `peak_calls_10s` | Max calls in any 10s window (burst) |

**`GET /v1/status`** (schema **≥ 2.11.0**) includes an `rpc_metrics` object. Structured logs emit every **`INDEXER_RPC_METRICS_LOG_SEC`** seconds (default **60**) with target `indexer_rpc_metrics`.

Smoke: `bash scripts/verify-indexer-rpc-metrics.sh` (**`INV-INDEXER-306-STATUS-METRICS`**).

## Benchmark harness

```bash
export PATH="$HOME/.foundry/bin:$PATH"
# Optional: longer runs for operator reports (default 120s per scenario)
# export BENCHMARK_SCENARIO_SEC=600
# export BENCHMARK_SAMPLE_SEC=15
bash scripts/benchmark-indexer-rpc-anvil.sh
```

The script:

1. Starts native Postgres + Anvil + DeployDev + indexer (ports **8548** / **3103** by default).
2. Runs three scenarios for `BENCHMARK_SCENARIO_SEC` each, sampling `/v1/status` every `BENCHMARK_SAMPLE_SEC`:
   - **idle** — chain advancing, no arena txs
   - **catch-up** — indexer stopped, Anvil mines ahead, indexer restarts `START_BLOCK` blocks behind tip
   - **active arena** — sustained `buy()` from three Anvil accounts
3. Writes JSON + markdown under `docs/indexer/benchmarks/` (override with `BENCHMARK_OUT_DIR`).

Env knobs documented in the issue: `RPC_URL`, `INGESTION_ENABLED`, `INDEXER_RPC_REQUEST_TIMEOUT_SEC`, Anvil block time (default instant mine). Chain-timer adaptive spacing ([#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308)): **`CHAIN_TIMER_IDLE_POLL_MS`** (default **3000**), **`CHAIN_TIMER_DEADLINE_PROXIMITY_SEC`** (default **30**).

## Baseline findings (Anvil, schema 2.11.0)

Sample run (`docs/indexer/benchmarks/rpc-benchmark-20260610T111415Z.json`, 30s scenarios):

| Scenario | calls/min (1m) | peak / 10s | Dominant caller | Dominant method |
|----------|----------------|------------|-----------------|-----------------|
| idle | **740** | **354** | `chain_timer` | `eth_call` |
| catch-up | **820** | **434** | `chain_timer` | `eth_call` |
| active arena | **1999** | **434** | `chain_timer` | `eth_call` |

**chain-timer** dominates steady-state RPC: ~**1 Hz** `poll_once` → **2** head reads plus **~30** `eth_call`s per cycle. **Ingestion** adds **2** calls per indexed block while caught up; **catch-up** and **active arena** raise `eth_getBlockByNumber` / `eth_getLogs` and ingest-side `podium_live` / `warbow_score` `eth_call`s.

Refresh baselines with `bash scripts/benchmark-indexer-rpc-anvil.sh` (use `BENCHMARK_SCENARIO_SEC=600` for production-style runs).

### Post-#308 idle sample (20260613T071846Z, 120s scenario)

Adaptive spacing + idle `eth_blockNumber` short-circuit when the head block is unchanged:

| Metric | Pre-#308 baseline (`20260610T111415Z`) | Post-#308 |
|--------|----------------------------------------|-----------|
| idle `calls_per_min_1m` | **740** | **84** |
| idle `peak_calls_10s` | **354** | **51** |
| idle `eth_call` (chain_timer) | **672** / min | **32** total (one full poll + short-circuits) |

## Prioritized mitigation strategies

| Strategy | Est. RPC reduction | Reactivity impact |
|----------|-------------------|-------------------|
| **Batch/multicall** for chain-timer `eth_call` fan-out | **40–60%** fewer round-trips per poll | Low if batched at same block tag; decode complexity |
| **Adaptive poll interval** when head unchanged and timer epochs stable | **30–50%** steady-state | Shipped ([#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308)): **1s** fast when head/epochs change or within **`CHAIN_TIMER_DEADLINE_PROXIMITY_SEC`**; **3s** idle otherwise (`CHAIN_TIMER_IDLE_POLL_MS`, max **3s** for timer freshness SLO) |
| **Coalesce duplicate `eth_call`** at same block tag within one `poll_once` | **10–20%** | None |
| **Derive live podium snapshots from logs** where `INV-INDEXER-PODIUM-PREDICT-LIVE` allows | Hot-path reduction on arena traffic | Verify parity with block-tagged `podium()` |
| **Separate read RPC URL** for head poller vs ingestion (operator config) | Isolates bursts | Ops complexity; no per-process reduction |
| **Ship [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237) WSS/SSE** for head hints | Frontend-only relief | Best-effort mini-block; RPC remains authority |
| **Enforce indexer-first display ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301))** | Cuts **browser** RPC, not indexer RPC | Already shipped |

## Proposed operator SLOs (single indexer instance)

| Metric | Target |
|--------|--------|
| Steady-state `calls_per_min_1m` (idle, caught up) | Document baseline; alert if **>2×** baseline for 15m |
| `peak_calls_10s` | Document baseline; investigate if **>3×** idle peak during non-catch-up |
| `GET /v1/arena/timers` freshness | `polled_at_ms` within **3s** of wall clock when RPC healthy |
| Ingestion liveness | **`ingestion_alive`** + **`last_indexed_at_ms`** per [#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168) |

## Regression checks

Must stay green after changes:

```bash
bash scripts/verify-indexer-rpc-metrics.sh
bash scripts/verify-podium-live-anvil.sh
cd indexer && cargo test
```

Arena head API contracts ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)) and ingestion liveness ([#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)) are unchanged by metrics-only instrumentation.
