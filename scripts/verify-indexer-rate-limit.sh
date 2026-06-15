#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #328 — smoke: per-IP rate limiting returns 429 under abuse.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8549}"
INDEXER_PORT="${INDEXER_PORT:-3104}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry-rate-limit.json"

VERIFY_SCRIPT_PREFIX="verify-indexer-rate-limit"
VERIFY_ANVIL_LOG="/tmp/yieldomega_verify328_anvil.log"
VERIFY_INDEXER_LOG="/tmp/yieldomega_verify328_indexer.log"
VERIFY_REGISTRY_COMMENT="verify-indexer-rate-limit.sh"

# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  yieldomega_verify_die "$@"
}

log() {
  yieldomega_verify_log "$@"
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  yieldomega_verify_kill_pid_if_set "${INDEXER_PID:-}"
  yieldomega_verify_kill_pid_if_set "${ANVIL_PID:-}"
}
trap cleanup EXIT

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export INDEXER_RATE_LIMIT_PER_MIN=120
export INDEXER_RATE_LIMIT_BURST=3
yieldomega_verify_boot_indexer_stack "${ROOT}"

TARGET="http://127.0.0.1:${INDEXER_PORT}/v1/arena/buys?limit=1"
OK_COUNT=0
RATE_LIMITED=0
for _ in $(seq 1 8); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${TARGET}")"
  if [[ "${code}" == "200" ]]; then
    OK_COUNT=$((OK_COUNT + 1))
  elif [[ "${code}" == "429" ]]; then
    RATE_LIMITED=$((RATE_LIMITED + 1))
  else
    die "unexpected HTTP ${code} from ${TARGET}"
  fi
done

[[ "${OK_COUNT}" -ge 1 ]] || die "expected at least one 200 before throttle"
[[ "${RATE_LIMITED}" -ge 1 ]] || die "expected 429 after burst=${INDEXER_RATE_LIMIT_BURST}"

HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${INDEXER_PORT}/healthz")"
[[ "${HEALTH_CODE}" == "200" ]] || die "/healthz must stay reachable (got ${HEALTH_CODE})"

log "PASS — ok=${OK_COUNT} throttled=${RATE_LIMITED} healthz=${HEALTH_CODE}"
