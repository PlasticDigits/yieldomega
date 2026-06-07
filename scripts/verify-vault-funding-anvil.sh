#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #267 — ingest PodiumFunded / SeedFunded / AdminVaultFunded and assert GET /v1/arena/vault-funding/*.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8547}"
INDEXER_PORT="${INDEXER_PORT:-3102}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000
BUY_DOUB=1000000000000000000000

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-vault-funding-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-vault-funding-anvil: $*"
}

warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

anvil_send() {
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
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
  >/tmp/yieldomega_verify267_anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "${RPC}" >/dev/null

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"
[[ -n "${PV:-}" ]] || die "PodiumVaults address missing after deploy"
[[ -n "${AV:-}" ]] || die "AdminSellVault address missing after deploy"
[[ -n "${CRED:-}" ]] || die "PlayCred address missing after deploy"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg av "${AV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-vault-funding-anvil.sh",
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
cargo run --release >/tmp/yieldomega_verify267_indexer.log 2>&1 &
INDEXER_PID=$!

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null || {
  tail -40 /tmp/yieldomega_verify267_indexer.log >&2
  die "indexer /v1/status unavailable"
}

EMPTY="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/vault-funding/totals")"
echo "${EMPTY}" | jq -e '.by_kind | length == 0' >/dev/null

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
ALICE="${ANVIL_ACCOUNTS[1]}"
[[ -n "${ALICE}" ]] || die "need at least two Anvil accounts"

anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${ALICE}" "1000000000000000000000000"
anvil_send "${ALICE}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"

BUY_TX="$(cast send "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --from "${ALICE}" --unlocked --rpc-url "${RPC}" --json | jq -r '.transactionHash')"
[[ -n "${BUY_TX}" && "${BUY_TX}" != "null" ]] || die "DOUB buy tx hash missing"
log "DOUB buy tx=${BUY_TX}"

synced=0
for _ in $(seq 1 90); do
  count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_vault_funding WHERE tx_hash = '${BUY_TX}'")"
  if [[ "${count}" -ge 12 ]]; then
    synced=1
    break
  fi
  sleep 1
done
[[ "${synced}" -eq 1 ]] || {
  tail -40 /tmp/yieldomega_verify267_indexer.log >&2
  die "indexer did not ingest 12 vault funding rows for buy tx"
}

BY_TX="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/vault-funding/by-tx/${BUY_TX}")"
echo "${BY_TX}" | jq -e '.items | length == 12' >/dev/null
echo "${BY_TX}" | jq -e ".total_funded_doub_wad == \"${BUY_DOUB}\"" >/dev/null
echo "${BY_TX}" | jq -e '[.items[].kind] | (map(select(. == "podium_epoch")) | length) == 12' >/dev/null
echo "${BY_TX}" | jq -e '[.items[].target_epoch] | map(select(. != null)) | length == 12' >/dev/null
echo "${BY_TX}" | jq -e '[.items[].kind] | (map(select(. == "admin")) | length) == 0' >/dev/null

RECEIPT_LOGS="$(cast receipt "${BUY_TX}" --json --rpc-url "${RPC}")"
CAST_VAULT_COUNT="$(echo "${RECEIPT_LOGS}" | jq -r \
  --arg pv "${PV,,}" --arg av "${AV,,}" \
  '[.logs[] | select((.address | ascii_downcase) == $pv or (.address | ascii_downcase) == $av)] | length')"
[[ "${CAST_VAULT_COUNT}" -eq 12 ]] || die "expected 12 PodiumEpochFunded logs in buy receipt, got ${CAST_VAULT_COUNT}"

DB_SUM="$(psql "${PG_URL}" -tAc "SELECT COALESCE(SUM(amount_doub_wad), 0)::text FROM idx_arena_vault_funding WHERE tx_hash = '${BUY_TX}'")"
[[ "${DB_SUM}" == "${BUY_DOUB}" ]] || die "DB sum ${DB_SUM} != buy amount ${BUY_DOUB}"

TOTALS="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/vault-funding/totals")"
TOTALS_SUM="$(python3 -c "
import json, sys
j = json.load(sys.stdin)
print(sum(int(r['total_doub_wad']) for r in j.get('by_kind', [])))
" <<<"${TOTALS}")"
[[ "${TOTALS_SUM}" == "${BUY_DOUB}" ]] || die "totals sum ${TOTALS_SUM} != buy amount ${BUY_DOUB}"

# CRED buy: no vault funding rows in same tx
anvil_send "${DEPLOYER}" "${CRED}" "mint(address,uint256)" "${ALICE}" "10000000000000000000000"
warp_past_cooldown
CRED_TX="$(cast send "${TA}" "buyWithCred(uint256)" "${CHARM_WAD}" \
  --from "${ALICE}" --unlocked --rpc-url "${RPC}" --json | jq -r '.transactionHash')"
[[ -n "${CRED_TX}" && "${CRED_TX}" != "null" ]] || die "CRED buy tx hash missing"

cred_synced=0
for _ in $(seq 1 60); do
  buy_count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_buy WHERE tx_hash = '${CRED_TX}'")"
  fund_count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_vault_funding WHERE tx_hash = '${CRED_TX}'")"
  if [[ "${buy_count}" -ge 1 && "${fund_count}" -eq 0 ]]; then
    cred_synced=1
    break
  fi
  sleep 1
done
[[ "${cred_synced}" -eq 1 ]] || die "CRED buy should have buy row but zero funding rows"

CRED_BY_TX="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/vault-funding/by-tx/${CRED_TX}")"
echo "${CRED_BY_TX}" | jq -e '.items | length == 0' >/dev/null

# No regression on donate-pools API (#262)
DONATE="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podium-pool-donations")"
echo "${DONATE}" | jq -e '.total_donated_doub_wad == "0" and (.recent | length) == 0' >/dev/null

log "integration_stage2 (includes api_vault_funding_smoke)"
export YIELDOMEGA_PG_TEST_URL="${PG_URL%/*}/yieldomega_indexer_test"
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer_test;" >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;" >/dev/null
cargo test --test integration_stage2 --quiet

echo "=== verify-vault-funding-anvil: OK (buy_tx=${BUY_TX}, cred_tx=${CRED_TX}) ==="
