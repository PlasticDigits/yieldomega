# Indexer JSON-RPC load benchmark (GitLab [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306))

Measure **average and peak JSON-RPC requests per minute** from a single indexer process on localnet (Anvil), broken down by **method** and **subsystem**, without guessing provider quotas.

Cross-links: [`indexer/README.md`](../../indexer/README.md) · [`design.md`](design.md) · [`invariants §306`](../testing/invariants-and-business-logic.md#indexer-json-rpc-load-benchmark-gitlab-306) · [`invariants §307`](../testing/invariants-and-business-logic.md#indexer-chain-timer-multicall-gitlab-307) · play skill [`skills/play-active-time-arena`](../../skills/play-active-time-arena/SKILL.md).

## Instrumentation

The indexer records every logical JSON-RPC call at the shared transport layer ([`indexer/src/rpc_http.rs`](../../indexer/src/rpc_http.rs), [`indexer/src/rpc_metrics.rs`](../../indexer/src/rpc_metrics.rs)):

| Field | Meaning |
|-------|---------|
| `by_method` | `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getLogs`, `eth_call` |
| `by_caller` | `ingestion`, `chain_timer`, `podium_live`, `warbow_score`, `reorg` |
| `calls_per_min_1m` / `calls_per_min_5m` | Rolling window rates |
| `peak_calls_10s` | Max calls in any 10s window (burst) |

**`GET /v1/status`** (schema **≥ 2.13.0**) includes an `rpc_metrics` object only when **`INDEXER_EXPOSE_OPS_METRICS=1`** (on **`GET /v1/status/ops`** and optionally on public status). Structured logs emit every **`INDEXER_RPC_METRICS_LOG_SEC`** seconds (default **60**) with target `indexer_rpc_metrics`.

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

1. Starts native Postgres + Anvil + **Multicall3** (canonical address; see [#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)) + DeployDev + indexer (ports **8548** / **3103** by default).
2. Runs three scenarios for `BENCHMARK_SCENARIO_SEC` each, sampling `/v1/status` every `BENCHMARK_SAMPLE_SEC`:
   - **idle** — chain advancing, no arena txs
   - **catch-up** — indexer stopped, Anvil mines ahead, indexer restarts `START_BLOCK` blocks behind tip
   - **active arena** — sustained `buy()` from three Anvil accounts
3. Writes JSON + markdown under `docs/indexer/benchmarks/` (override with `BENCHMARK_OUT_DIR`).

Env knobs documented in the issue: `RPC_URL`, `INGESTION_ENABLED`, `INDEXER_RPC_REQUEST_TIMEOUT_SEC`, Anvil block time (default instant mine). Chain-timer adaptive spacing ([#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308)): **`CHAIN_TIMER_IDLE_POLL_MS`** (default **3000**), **`CHAIN_TIMER_DEADLINE_PROXIMITY_SEC`** (default **30**).

## Baseline findings (Anvil, schema 2.11.0)

### Pre–Multicall3 batching (30s scenarios, [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306))

Sample run (`docs/indexer/benchmarks/rpc-benchmark-20260610T111415Z.json`):

| Scenario | calls/min (1m) | peak / 10s | Dominant caller | Dominant method |
|----------|----------------|------------|-----------------|-----------------|
| idle | **740** | **354** | `chain_timer` | `eth_call` |
| catch-up | **820** | **434** | `chain_timer` | `eth_call` |
| active arena | **1999** | **434** | `chain_timer` | `eth_call` |

**chain-timer** dominated steady-state RPC: ~**1 Hz** `poll_once` → **2** head reads plus **~30** sequential `eth_call`s per cycle.

### Post–Multicall3 batching (120s scenarios, [#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307))

Sample run (`docs/indexer/benchmarks/rpc-benchmark-20260613T071949Z.json`; harness deploys Multicall3 via [`scripts/lib/anvil_multicall3.sh`](../../scripts/lib/anvil_multicall3.sh)):

| Scenario | calls/min (1m) | peak / 10s | `eth_call:chain_timer` (cumulative) | Dominant method |
|----------|----------------|------------|--------------------------------------|-----------------|
| idle | **244** | **44** | **111** | `eth_getBlockByNumber` |
| catch-up | **244** | **124** | **111** | `eth_getBlockByNumber` |
| active arena | **439** | **124** | **235** | `eth_getBlockByNumber` |

With **`aggregate3`** batching, each healthy `poll_once` issues **one** logical `eth_call` (plus **2** head reads). Idle **`peak_calls_10s`** drops from **354** → **44** (~**88%**). **`eth_call:chain_timer`** per idle minute falls **~97%** vs the pre-change artifact.

**Operator note:** Production MegaETH and most EVM chains ship Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`. Fresh Anvil requires the signed-tx bootstrap in `yieldomega_ensure_anvil_multicall3` (also wired into `start-local-anvil-stack.sh`). Without Multicall3, the indexer falls back to sequential `eth_call`s ([#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)).

Refresh baselines with `bash scripts/benchmark-indexer-rpc-anvil.sh` (use `BENCHMARK_SCENARIO_SEC=600` for production-style runs).

### Post-#308 idle sample (20260613T071846Z, 120s scenario)

Adaptive spacing + idle `eth_blockNumber` short-circuit when the head block is unchanged:

| Metric | Pre-#308 baseline (`20260610T111415Z`) | Post-#308 |
|--------|----------------------------------------|-----------|
| idle `calls_per_min_1m` | **740** | **84** |
| idle `peak_calls_10s` | **354** | **51** |
| idle `eth_call` (chain_timer) | **672** / min | **32** total (one full poll + short-circuits) |

### Verification rerun (20260615T021945Z, 120s scenarios, #306 sign-off)

`BENCHMARK_SCENARIO_SEC=120 bash scripts/benchmark-indexer-rpc-anvil.sh` on main with [#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307) + [#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308) shipped:

| Scenario | calls/min (1m) | peak / 10s | Dominant caller | Dominant method |
|----------|----------------|------------|-----------------|-----------------|
| idle | **84** | **20** | `ingestion` | `eth_getBlockByNumber` |
| catch-up | **84** | **100** | `ingestion` | `eth_getBlockByNumber` |
| active arena | **305** | **100** | `ingestion` | `eth_getBlockByNumber` |

Idle **`peak_calls_10s` ≤ 50** operator target is met (**20**). Catch-up and active-arena bursts (**100** / 10s) come from ingestion (`eth_getBlockByNumber` + `eth_getLogs` + `podium_live` / `warbow_score` `eth_call`s), not chain-timer fan-out. Artifact: `docs/indexer/benchmarks/rpc-benchmark-20260615T021945Z.json`.

## Prioritized mitigation strategies

| Strategy | Est. RPC reduction | Status / reactivity |
|----------|-------------------|---------------------|
| **Batch/multicall** for chain-timer `eth_call` fan-out ([#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)) | **~90%** fewer `eth_call` round-trips per poll (measured idle) | **Shipped** — [`multicall.rs`](../../indexer/src/multicall.rs) + `aggregate3` in [`chain_timer.rs`](../../indexer/src/chain_timer.rs); Anvil bootstrap [`anvil_multicall3.sh`](../../scripts/lib/anvil_multicall3.sh) |
| **Coalesce duplicate `eth_call`** at same block tag within one `poll_once` | **10–20%** (dedupe `deadline` etc.) | **Shipped** with [#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307) batch builder |
| **Adaptive poll interval** when head unchanged and timer epochs stable | **30–50%** steady-state | **Shipped** ([#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308)): **1s** fast when head/epochs change or within **`CHAIN_TIMER_DEADLINE_PROXIMITY_SEC`**; **3s** idle otherwise (`CHAIN_TIMER_IDLE_POLL_MS`, max **3s** for timer freshness SLO) |
| **Derive live podium snapshots from logs** where `INV-INDEXER-PODIUM-PREDICT-LIVE` allows | **~30%** fewer `eth_call`s on active arena (297 `podium_live`+`warbow_score` in 120s sample) | Must preserve block-tagged parity with `podium()`; test via `verify-podium-live-anvil.sh` |
| **Separate read RPC URL** for head poller vs ingestion (operator config) | Isolates catch-up / arena bursts from latency-sensitive polls | Ops complexity; no per-process reduction |
| **Ingestion-side RPC coalescing** — batch `eth_getBlockByNumber` during catch-up; cap concurrent `podium_live`/`warbow_score` per block | **~40–60%** peak reduction on catch-up / active arena | Slightly higher indexer lag during burst; monitor `last_indexed_at_ms` ([#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)) |
| **Ship [#237](https://gitlab.com/PlasticDigits/yieldomega/-/issues/237) WSS/SSE** for head hints | Frontend-only relief | Best-effort mini-block; RPC remains authority |
| **Enforce indexer-first display ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301))** | Cuts **browser** RPC, not indexer RPC | Already shipped |

## Proposed operator SLOs (single indexer instance)

| Metric | Target |
|--------|--------|
| Steady-state `calls_per_min_1m` (idle, caught up) | Document baseline; alert if **>2×** baseline for 15m |
| `peak_calls_10s` | **≤ 50** idle (post–[#307](https://gitlab.com/PlasticDigits/yieldomega/-/issues/307)); alert if **>3×** idle peak during non-catch-up |
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
