#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #306 — localnet JSON-RPC load benchmark for a single indexer process.
#
# Samples GET /v1/status rpc_metrics across idle, catch-up, and active-arena scenarios.
# Writes JSON + markdown under docs/indexer/benchmarks/ (override with BENCHMARK_OUT_DIR).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8548}"
INDEXER_PORT="${INDEXER_PORT:-3103}"
RPC="http://127.0.0.1:${PORT}"
STATUS_URL="http://127.0.0.1:${INDEXER_PORT}/v1/status"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
SCENARIO_SEC="${BENCHMARK_SCENARIO_SEC:-120}"
SAMPLE_SEC="${BENCHMARK_SAMPLE_SEC:-10}"
OUT_DIR="${BENCHMARK_OUT_DIR:-${ROOT}/docs/indexer/benchmarks}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry-rpc-bench.json"
CHARM_WAD=1000000000000000000
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
JSON_OUT="${OUT_DIR}/rpc-benchmark-${STAMP}.json"
MD_OUT="${OUT_DIR}/rpc-benchmark-${STAMP}.md"

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "benchmark-indexer-rpc-anvil: $*" >&2
  exit 1
}

log() {
  echo "benchmark-indexer-rpc-anvil: $*"
}

anvil_send() {
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

sample_status_metrics() {
  curl -sf "${STATUS_URL}" | jq '.rpc_metrics'
}

scenario_sample_loop() {
  local name="$1"
  local duration="$2"
  local samples=()
  local elapsed=0
  while [[ "${elapsed}" -lt "${duration}" ]]; do
    local snap
    snap="$(sample_status_metrics)"
    samples+=("${snap}")
    sleep "${SAMPLE_SEC}"
    elapsed=$((elapsed + SAMPLE_SEC))
  done
  jq -n \
    --arg name "${name}" \
    --argjson duration "${duration}" \
    --argjson sample_sec "${SAMPLE_SEC}" \
    --argjson samples "$(printf '%s\n' "${samples[@]}" | jq -s '.')" \
    '{scenario: $name, duration_sec: $duration, sample_interval_sec: $sample_sec, samples: $samples}'
}

reset_indexer_db() {
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yieldomega_indexer' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer;" >/dev/null
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer OWNER yieldomega;" >/dev/null
}

start_anvil_and_deploy() {
  pkill -f "anvil.*${PORT}" 2>/dev/null || true
  sleep 1

  anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
    >/tmp/yieldomega_bench306_anvil.log 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
    sleep 0.5
  done

  export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
  ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
  yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"
  [[ -n "${TA:-}" ]] || die "TimeArena missing"

  DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
  jq -n \
    --argjson chainId 31337 \
    --arg ta "${TA}" \
    --arg pv "${PV}" \
    --arg av "${AV}" \
    --arg rr "${RR}" \
    --argjson deployBlock "${DEPLOY_BLOCK}" \
    '{
      _comment: "benchmark-indexer-rpc-anvil.sh",
      chainId: $chainId,
      contracts: { TimeArena: $ta, PodiumVaults: $pv, AdminSellVault: $av, ReferralRegistry: $rr },
      deployBlock: $deployBlock
    }' >"${REGISTRY}"
}

start_indexer() {
  local start_block="${1:-0}"
  stop_indexer
  reset_indexer_db

  export DATABASE_URL="${PG_URL}"
  export CHAIN_ID=31337
  export START_BLOCK="${start_block}"
  export ADDRESS_REGISTRY_PATH="${REGISTRY}"
  export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
  export INGESTION_ENABLED=true
  export RPC_URL="${RPC}"
  export INDEXER_RPC_METRICS_LOG_SEC=30
  cd "${ROOT}/indexer"
  cargo run --release >/tmp/yieldomega_bench306_indexer.log 2>&1 &
  INDEXER_PID=$!

  for _ in $(seq 1 120); do
    curl -sf "${STATUS_URL}" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf "${STATUS_URL}" >/dev/null || {
    tail -40 /tmp/yieldomega_bench306_indexer.log >&2
    die "indexer /v1/status unavailable"
  }
}

stop_indexer() {
  if [[ -n "${INDEXER_PID:-}" ]]; then
    kill "${INDEXER_PID}" 2>/dev/null || true
    wait "${INDEXER_PID}" 2>/dev/null || true
    INDEXER_PID=""
  fi
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  stop_indexer
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

mkdir -p "${OUT_DIR}"

log "starting stack (scenario=${SCENARIO_SEC}s sample=${SAMPLE_SEC}s)"
pkill -f 'yieldomega-indexer' 2>/dev/null || true
start_anvil_and_deploy
start_indexer 0

log "scenario: idle"
IDLE_JSON="$(scenario_sample_loop idle "${SCENARIO_SEC}")"

log "scenario: catch-up (indexer paused, mine ahead, restart on same Anvil)"
stop_indexer
TIP="$(cast block-number --rpc-url "${RPC}")"
for _ in $(seq 1 40); do
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
done
NEW_TIP="$(cast block-number --rpc-url "${RPC}")"
LAG_BLOCK=$((TIP > 5 ? TIP - 5 : 0))
log "catch-up lag: indexer restarts at block ${LAG_BLOCK}, tip ${NEW_TIP}"
start_indexer "${LAG_BLOCK}"
CATCHUP_JSON="$(scenario_sample_loop catch_up "${SCENARIO_SEC}")"

log "scenario: active arena (sustained buys)"
mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
BUYERS=("${ANVIL_ACCOUNTS[1]}" "${ANVIL_ACCOUNTS[2]}" "${ANVIL_ACCOUNTS[3]}")
for acct in "${BUYERS[@]}"; do
  anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${acct}" "1000000000000000000000000"
  anvil_send "${acct}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
done

ACTIVE_START=$(date +%s)
ACTIVE_SAMPLES=()
elapsed=0
while [[ "${elapsed}" -lt "${SCENARIO_SEC}" ]]; do
  for buyer in "${BUYERS[@]}"; do
    anvil_send "${buyer}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
      "0x0000000000000000000000000000000000000000000000000000000000000000" || true
    warp_past_cooldown
  done
  ACTIVE_SAMPLES+=("$(sample_status_metrics)")
  sleep "${SAMPLE_SEC}"
  elapsed=$((elapsed + SAMPLE_SEC))
done
ACTIVE_JSON="$(jq -n \
  --argjson duration "${SCENARIO_SEC}" \
  --argjson sample_sec "${SAMPLE_SEC}" \
  --argjson samples "$(printf '%s\n' "${ACTIVE_SAMPLES[@]}" | jq -s '.')" \
  '{scenario: "active_arena", duration_sec: $duration, sample_interval_sec: $sample_sec, samples: $samples}')"

REPORT="$(jq -n \
  --arg generated_at "${STAMP}" \
  --arg rpc_url "${RPC}" \
  --argjson scenario_sec "${SCENARIO_SEC}" \
  --argjson sample_sec "${SAMPLE_SEC}" \
  --argjson idle "${IDLE_JSON}" \
  --argjson catch_up "${CATCHUP_JSON}" \
  --argjson active "${ACTIVE_JSON}" \
  '{
    issue: 306,
    generated_at: $generated_at,
    rpc_url: $rpc_url,
    scenario_sec: $scenario_sec,
    sample_sec: $sample_sec,
    scenarios: [$idle, $catch_up, $active]
  }')"

echo "${REPORT}" >"${JSON_OUT}"

avg_peak() {
  local scenario_json="$1"
  echo "${scenario_json}" | jq '[
    .samples[]
    | {cpm: .calls_per_min_1m, peak: .peak_calls_10s, by_method: .by_method, by_caller: .by_caller}
  ]'
}

{
  echo "# Indexer JSON-RPC benchmark (${STAMP})"
  echo ""
  echo "GitLab [#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306). Single indexer on Anvil (\`${RPC}\`)."
  echo ""
  echo "| Setting | Value |"
  echo "|---------|-------|"
  echo "| Scenario duration | ${SCENARIO_SEC}s |"
  echo "| Sample interval | ${SAMPLE_SEC}s |"
  echo "| JSON artifact | \`${JSON_OUT#${ROOT}/}\` |"
  echo ""
  for label in idle catch_up active_arena; do
    echo "## ${label}"
    echo ""
    echo '```json'
    echo "${REPORT}" | jq --arg s "${label}" '.scenarios[] | select(.scenario == $s) | .samples[-1]'
    echo '```'
    echo ""
  done
  echo "## Summary (last sample per scenario)"
  echo ""
  echo "| Scenario | calls/min (1m) | peak / 10s | top method | top caller |"
  echo "|----------|----------------|------------|------------|------------|"
  while IFS= read -r row; do
    echo "${row}"
  done < <(echo "${REPORT}" | jq -r '.scenarios[] |
    "| \(.scenario) | \(.samples[-1].calls_per_min_1m) | \(.samples[-1].peak_calls_10s) | " +
    (.samples[-1].by_method | to_entries | max_by(.value) | .key // "?") + " | " +
    (.samples[-1].by_caller | to_entries | max_by(.value) | .key // "?") + " |"')
  echo ""
  echo "See [rpc-load-benchmark.md](../rpc-load-benchmark.md) for mitigation strategies and operator SLOs."
} >"${MD_OUT}"

log "PASS — wrote ${JSON_OUT}"
log "PASS — wrote ${MD_OUT}"
