#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #262 — ingest PodiumPoolsToppedUp and assert GET /v1/arena/podium-pool-donations.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
INDEXER_PORT="${INDEXER_PORT:-3100}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
VERIFY_TAG=verify262

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
# shellcheck source=scripts/lib/verify_anvil_common.sh
source "${ROOT}/scripts/lib/verify_anvil_common.sh"
# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

cleanup() {
  rm -f "${DEPLOY_LOG}"
  verify_anvil_kill_children
}
trap cleanup EXIT

verify_anvil_stop_existing
verify_anvil_start

ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

verify_indexer_write_registry "verify-donate-pools-anvil.sh"
verify_indexer_reset_db
verify_indexer_start
verify_indexer_wait_status || {
  verify_indexer_log_tail
  exit 1
}

EMPTY="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podium-pool-donations")"
echo "${EMPTY}" | jq -e '.total_donated_doub_wad == "0" and (.recent | length) == 0' >/dev/null

PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DONOR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
AMOUNT="700000000000000000000"
cast send "${DOUB}" "mint(address,uint256)" "${DONOR}" "${AMOUNT}" \
  --rpc-url "${RPC}" --private-key "${PK}" >/dev/null
cast send "${DOUB}" "approve(address,uint256)(bool)" "${TA}" "${AMOUNT}" \
  --rpc-url "${RPC}" --private-key "${PK}" >/dev/null
cast send "${TA}" "topUpPodiumPools(uint256)" "${AMOUNT}" \
  --rpc-url "${RPC}" --private-key "${PK}" >/dev/null

for _ in $(seq 1 60); do
  TOTAL="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podium-pool-donations" | jq -r '.total_donated_doub_wad')"
  [[ "${TOTAL}" == "${AMOUNT}" ]] && break
  sleep 1
done
[[ "${TOTAL}" == "${AMOUNT}" ]] || {
  echo "Expected total ${AMOUNT}, got ${TOTAL}" >&2
  verify_indexer_log_tail
  exit 1
}

echo "verify-donate-pools-anvil: OK (total=${TOTAL})"
