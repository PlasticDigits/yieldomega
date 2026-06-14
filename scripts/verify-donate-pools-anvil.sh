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

VERIFY_SCRIPT_PREFIX="verify-donate-pools-anvil"
VERIFY_ANVIL_LOG="/tmp/yieldomega_verify262_anvil.log"
VERIFY_INDEXER_LOG="/tmp/yieldomega_verify262_indexer.log"
VERIFY_REGISTRY_COMMENT="verify-donate-pools-anvil.sh"

# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

cleanup() {
  rm -f "${DEPLOY_LOG}"
  yieldomega_verify_kill_pid_if_set "${INDEXER_PID:-}"
  yieldomega_verify_kill_pid_if_set "${ANVIL_PID:-}"
}
trap cleanup EXIT

yieldomega_verify_boot_indexer_stack "${ROOT}"

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
  tail -40 "${VERIFY_INDEXER_LOG}" >&2
  exit 1
}

echo "verify-donate-pools-anvil: OK (total=${TOTAL})"
