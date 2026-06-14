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
VERIFY_TAG=verify306

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
# shellcheck source=scripts/lib/verify_anvil_common.sh
source "${ROOT}/scripts/lib/verify_anvil_common.sh"
# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  echo "verify-indexer-rpc-metrics: $*" >&2
  exit 1
}

log() {
  echo "verify-indexer-rpc-metrics: $*"
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  verify_anvil_kill_children
}
trap cleanup EXIT

verify_anvil_stop_existing
verify_anvil_start

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena missing after deploy"

verify_indexer_write_registry "verify-indexer-rpc-metrics.sh"
verify_indexer_reset_db

export INDEXER_RPC_METRICS_LOG_SEC=15
verify_indexer_start
verify_indexer_wait_status || {
  verify_indexer_log_tail
  die "/v1/status unavailable"
}

# Allow chain-timer ~1 Hz polls to accumulate metrics.
STATUS_URL="http://127.0.0.1:${INDEXER_PORT}/v1/status"
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
