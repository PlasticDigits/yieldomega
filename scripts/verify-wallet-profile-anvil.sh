#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #282 / #283 — GET /v1/arena/buys exposes buy-row fields (seconds + log identity); wallet stats (#258 QA).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8548}"
INDEXER_PORT="${INDEXER_PORT:-3103}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000
TOPUP_DOUB=700000000000000000000

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
# shellcheck source=scripts/lib/verify_anvil_common.sh
source "${ROOT}/scripts/lib/verify_anvil_common.sh"
# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  echo "verify-wallet-profile-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-wallet-profile-anvil: $*"
}

warp_past_cooldown() { yieldomega_verify_warp_past_cooldown; }
anvil_send() { yieldomega_verify_anvil_send "$@"; }

cleanup() {
  rm -f "${DEPLOY_LOG}"
  yieldomega_verify_kill_anvil_indexer_pids
}
trap cleanup EXIT

yieldomega_verify_stop_anvil_indexer
VERIFY_ANVIL_LOG=/tmp/yieldomega_verify282_anvil.log yieldomega_verify_start_anvil

chain_id="$(cast chain-id --rpc-url "${RPC}")"
[[ "${chain_id}" == "31337" ]] || die "expected chainId 31337, got ${chain_id}"

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=0
yieldomega_verify_deploy_dev

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

yieldomega_verify_write_anvil_registry "${REGISTRY}" "verify-wallet-profile-anvil.sh"
yieldomega_verify_pg_reset_db
yieldomega_verify_start_indexer /tmp/yieldomega_verify282_indexer.log
yieldomega_verify_wait_indexer_status die /tmp/yieldomega_verify282_indexer.log

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
BUYER="${ANVIL_ACCOUNTS[1]}"
[[ -n "${BUYER}" ]] || die "need at least two Anvil accounts"
BUYER_LC="$(echo "${BUYER}" | tr '[:upper:]' '[:lower:]')"

anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"

BUY_TX="$(cast send "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --from "${BUYER}" --unlocked --rpc-url "${RPC}" --json | jq -r '.transactionHash')"
[[ -n "${BUY_TX}" && "${BUY_TX}" != "null" ]] || die "DOUB buy tx hash missing"
log "DOUB buy tx=${BUY_TX} buyer=${BUYER_LC}"

synced=0
for _ in $(seq 1 90); do
  count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}'")"
  if [[ "${count}" -ge 1 ]]; then
    synced=1
    break
  fi
  sleep 1
done
[[ "${synced}" -eq 1 ]] || {
  tail -40 /tmp/yieldomega_verify282_indexer.log >&2
  die "indexer did not ingest buy row"
}

BUYS_JSON="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/buys?limit=5")"
API_SECS="$(echo "${BUYS_JSON}" | jq -r --arg tx "${BUY_TX,,}" \
  '.items[] | select((.tx_hash | ascii_downcase) == $tx) | .actual_seconds_added' | head -1)"
[[ -n "${API_SECS}" && "${API_SECS}" != "null" ]] || die "actual_seconds_added missing in GET /v1/arena/buys"
DB_SECS="$(psql "${PG_URL}" -tAc \
  "SELECT actual_seconds_added::text FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}' LIMIT 1")"
[[ "${API_SECS}" == "${DB_SECS}" ]] || die "API/DB seconds mismatch: api=${API_SECS} db=${DB_SECS}"
if [[ "${API_SECS}" == "0" ]]; then
  hard_reset="$(echo "${BUYS_JSON}" | jq -r --arg tx "${BUY_TX,,}" \
    '.items[] | select((.tx_hash | ascii_downcase) == $tx) | .timer_hard_reset')"
  [[ "${hard_reset}" == "true" ]] || die "expected actual_seconds_added > 0 or timer_hard_reset on extending buy"
else
  [[ "${API_SECS}" =~ ^[0-9]+$ && "${API_SECS}" -gt 0 ]] || die "expected positive actual_seconds_added, got ${API_SECS}"
fi
log "actual_seconds_added=${API_SECS} (matches idx_arena_buy)"

parity_field() {
  local field="$1"
  local api_val db_val
  api_val="$(echo "${BUYS_JSON}" | jq -r --arg tx "${BUY_TX,,}" --arg f "${field}" \
    '.items[] | select((.tx_hash | ascii_downcase) == $tx) | .[$f]' | head -1)"
  [[ -n "${api_val}" && "${api_val}" != "null" ]] || die "${field} missing in GET /v1/arena/buys"
  case "${field}" in
    new_deadline|buy_index)
      db_val="$(psql "${PG_URL}" -tAc \
        "SELECT ${field}::text FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}' LIMIT 1")"
      ;;
    log_index)
      db_val="$(psql "${PG_URL}" -tAc \
        "SELECT log_index FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}' LIMIT 1")"
      ;;
    block_timestamp)
      db_val="$(psql "${PG_URL}" -tAc \
        "SELECT EXTRACT(EPOCH FROM block_timestamp)::text FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}' LIMIT 1")"
      ;;
    *) die "unknown parity field ${field}" ;;
  esac
  [[ "${api_val}" == "${db_val}" ]] || die "API/DB ${field} mismatch: api=${api_val} db=${db_val}"
  log "${field}=${api_val} (matches idx_arena_buy)"
}

parity_field new_deadline
parity_field buy_index
parity_field log_index
parity_field block_timestamp

STATS="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/wallet/${BUYER_LC}/stats")"
buy_count="$(echo "${STATS}" | jq -r '.buy_count')"
[[ "${buy_count}" =~ ^[0-9]+$ && "${buy_count}" -ge 1 ]] || die "wallet stats buy_count expected >= 1, got ${buy_count}"
log "wallet stats buy_count=${buy_count}"

anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "${TOPUP_DOUB}"
cast send "${TA}" "topUpPodiumPools(uint256)" "${TOPUP_DOUB}" \
  --from "${BUYER}" --unlocked --rpc-url "${RPC}" >/dev/null
warp_past_cooldown

donate_ok=0
for _ in $(seq 1 60); do
  donor_count="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podium-pool-donations?donor=${BUYER_LC}" \
    | jq -r '.donor_summary.donation_count // "0"')"
  if [[ "${donor_count}" =~ ^[0-9]+$ && "${donor_count}" -ge 1 ]]; then
    donate_ok=1
    break
  fi
  sleep 1
done
[[ "${donate_ok}" -eq 1 ]] || die "donor_summary.donation_count never reached 1 after topUpPodiumPools"
log "podium-pool-donations donor_summary ok"

log "Manual QA (#258): start stack (or reuse INDEXER_URL), open /arena with sale active;"
log "  confirm data-testid=arena-simple-last-extension after an extending buy;"
log "  click buyer on extension chip or live-buy row → WalletProfileModal (seven sections)."

export YIELDOMEGA_PG_TEST_URL="${PG_URL%/*}/yieldomega_indexer_test"
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer_test;" >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;" >/dev/null
log "integration_stage2 (includes api_arena_buys parity smoke #282/#283)"
cargo test --test integration_stage2 --quiet

echo "=== verify-wallet-profile-anvil: OK (buyer=${BUYER_LC}, actual_seconds_added=${API_SECS}, buy_count=${buy_count}) ==="
