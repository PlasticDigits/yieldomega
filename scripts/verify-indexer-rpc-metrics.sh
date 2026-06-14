#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #306 — smoke: GET /v1/status exposes rpc_metrics after chain-timer polls.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8547}"
INDEXER_PORT="${INDEXER_PORT:-3102}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry-rpc-metrics.json"

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-indexer-rpc-metrics: $*" >&2
  exit 1
}

log() {
  echo "verify-indexer-rpc-metrics: $*"
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
pkill -f 'yieldomega-indexer' 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify306_anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "${RPC}" >/dev/null

# shellcheck source=scripts/lib/anvil_multicall3.sh
source "${ROOT}/scripts/lib/anvil_multicall3.sh"
yieldomega_anvil_install_multicall3 "${RPC}"

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena missing after deploy"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg av "${AV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-indexer-rpc-metrics.sh",
    chainId: $chainId,
    contracts: { TimeArena: $ta, PodiumVaults: $pv, AdminSellVault: $av, ReferralRegistry: $rr },
    deployBlock: $deployBlock
  }' >"${REGISTRY}"

psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yieldomega_indexer' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer;" >/dev/null
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer OWNER yieldomega;" >/dev/null

export DATABASE_URL="${PG_URL}"
export CHAIN_ID=31337
export START_BLOCK=0
export ADDRESS_REGISTRY_PATH="${REGISTRY}"
export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
export INGESTION_ENABLED=true
export RPC_URL="${RPC}"
export INDEXER_RPC_METRICS_LOG_SEC=15
cd "${ROOT}/indexer"
cargo run --release >/tmp/yieldomega_verify306_indexer.log 2>&1 &
INDEXER_PID=$!

STATUS_URL="http://127.0.0.1:${INDEXER_PORT}/v1/status"
for _ in $(seq 1 90); do
  curl -sf "${STATUS_URL}" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "${STATUS_URL}" >/dev/null || {
  tail -40 /tmp/yieldomega_verify306_indexer.log >&2
  die "/v1/status unavailable"
}

# Allow chain-timer ~1 Hz polls to accumulate metrics.
sleep 35

RESP="$(curl -sf "${STATUS_URL}")"
echo "${RESP}" | jq -e '.rpc_metrics' >/dev/null || die "rpc_metrics missing from /v1/status"
echo "${RESP}" | jq -e '.rpc_metrics.total_calls > 0' >/dev/null \
  || die "rpc_metrics.total_calls still zero after warm-up"
echo "${RESP}" | jq -e '.rpc_metrics.by_caller.chain_timer != null' >/dev/null \
  || die "chain_timer caller missing from rpc_metrics.by_caller"
echo "${RESP}" | jq -e '.rpc_metrics.by_method.eth_call != null' >/dev/null \
  || die "eth_call missing from rpc_metrics.by_method"

SCHEMA="$(echo "${RESP}" | jq -r '.schema_version')"
log "PASS — schema=${SCHEMA} total_calls=$(echo "${RESP}" | jq -r '.rpc_metrics.total_calls') peak_10s=$(echo "${RESP}" | jq -r '.rpc_metrics.peak_calls_10s')"
