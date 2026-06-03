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

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

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
  >/tmp/yieldomega_verify262_anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "${RPC}" >/dev/null

ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg av "${AV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-donate-pools-anvil.sh",
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
cd "${ROOT}/indexer"
cargo run --release >/tmp/yieldomega_verify262_indexer.log 2>&1 &
INDEXER_PID=$!

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null

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
  tail -40 /tmp/yieldomega_verify262_indexer.log >&2
  exit 1
}

echo "verify-donate-pools-anvil: OK (total=${TOTAL})"
