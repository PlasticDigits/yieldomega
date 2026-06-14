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
  yieldomega_verify_kill_anvil_indexer_pids
}
trap cleanup EXIT

yieldomega_verify_stop_anvil_indexer
VERIFY_ANVIL_LOG=/tmp/yieldomega_verify306_anvil.log yieldomega_verify_start_anvil

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
yieldomega_verify_deploy_dev

[[ -n "${TA:-}" ]] || die "TimeArena missing after deploy"

yieldomega_verify_write_anvil_registry "${REGISTRY}" "verify-indexer-rpc-metrics.sh"
yieldomega_verify_pg_reset_db
yieldomega_verify_start_indexer /tmp/yieldomega_verify306_indexer.log INDEXER_RPC_METRICS_LOG_SEC=15
yieldomega_verify_wait_indexer_status die /tmp/yieldomega_verify306_indexer.log
STATUS_URL="http://127.0.0.1:${INDEXER_PORT}/v1/status"

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
