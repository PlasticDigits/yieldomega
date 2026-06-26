#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #351 — live Anvil reorg: find_common_ancestor + rollback + re-ingest (level history).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8549}"
INDEXER_PORT="${INDEXER_PORT:-3104}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000
HEAL_TIMEOUT_SEC="${YIELDOMEGA_REORG_HEAL_TIMEOUT_SEC:-90}"

VERIFY_SCRIPT_PREFIX="verify-indexer-reorg-anvil"
VERIFY_ANVIL_LOG="/tmp/yieldomega_verify351_anvil.log"
VERIFY_INDEXER_LOG="/tmp/yieldomega_verify351_indexer.log"
VERIFY_REGISTRY_COMMENT="verify-indexer-reorg-anvil.sh"

# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  yieldomega_verify_die "$@"
}

log() {
  yieldomega_verify_log "$@"
}

warp_past_cooldown() {
  yieldomega_verify_warp_past_cooldown "${RPC}"
}

anvil_send() {
  yieldomega_verify_anvil_send "${RPC}" "$@"
}

pg_scalar() {
  psql "${PG_URL}" -tAc "$1"
}

pg_chain_pointer_block() {
  pg_scalar "SELECT (value->>'block_number')::bigint FROM indexer_state WHERE key = 'chain_pointer'"
}

pg_chain_pointer_hash() {
  pg_scalar "SELECT lower(value->>'block_hash') FROM indexer_state WHERE key = 'chain_pointer'"
}

wait_indexer_through() {
  local want="$1"
  for _ in $(seq 1 90); do
    local tip
    tip="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" | jq -r '.max_indexed_block // 0')"
    if [[ "${tip}" -ge "${want}" ]]; then
      return 0
    fi
    sleep 1
  done
  tail -40 "${VERIFY_INDEXER_LOG}" >&2
  die "indexer did not reach block ${want}"
}

assert_no_ingest_divergence() {
  local label="$1"
  local buy_rows buy_distinct level_up_rows ptr_block chain_tip ptr_hash rpc_hash
  buy_rows="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_buy")"
  buy_distinct="$(pg_scalar "SELECT COUNT(DISTINCT tx_hash) FROM idx_arena_buy")"
  level_up_rows="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_level_up")"
  ptr_block="$(pg_chain_pointer_block)"
  chain_tip="$(cast block-number --rpc-url "${RPC}")"
  ptr_hash="$(pg_chain_pointer_hash)"
  rpc_hash="$(cast block "${ptr_block}" --field hash --rpc-url "${RPC}" | tr '[:upper:]' '[:lower:]')"

  if [[ "${buy_rows}" != "${buy_distinct}" ]]; then
    die "${label}: duplicate idx_arena_buy rows (count=${buy_rows} distinct_tx=${buy_distinct})"
  fi
  if [[ "${level_up_rows}" != "0" ]]; then
    die "${label}: idx_arena_level_up expected 0 after reorg heal, got ${level_up_rows}"
  fi
  if [[ "${buy_rows}" != "1" ]]; then
    die "${label}: idx_arena_buy expected 1 after reorg heal, got ${buy_rows}"
  fi
  if [[ "${ptr_block}" != "${chain_tip}" ]]; then
    die "${label}: chain_pointer block ${ptr_block} != chain tip ${chain_tip}"
  fi
  if [[ "${ptr_hash}" != "${rpc_hash}" ]]; then
    die "${label}: chain_pointer hash mismatch db=${ptr_hash} rpc=${rpc_hash}"
  fi
}

wait_for_reorg_heal() {
  local want_ancestor="$1"
  for _ in $(seq 1 "${HEAL_TIMEOUT_SEC}"); do
    if grep -q "rolled back after reorg" "${VERIFY_INDEXER_LOG}" 2>/dev/null; then
      local level_up_rows buy_rows ptr_block
      level_up_rows="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_level_up")"
      buy_rows="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_buy")"
      ptr_block="$(pg_chain_pointer_block)"
      if [[ "${level_up_rows}" == "0" && "${buy_rows}" == "1" ]]; then
        if [[ "${ptr_block}" -ge "${want_ancestor}" ]]; then
          return 0
        fi
      fi
    fi
    sleep 1
  done
  tail -60 "${VERIFY_INDEXER_LOG}" >&2
  die "indexer did not heal after reorg within ${HEAL_TIMEOUT_SEC}s (level_up=$(pg_scalar 'SELECT COUNT(*) FROM idx_arena_level_up') buys=$(pg_scalar 'SELECT COUNT(*) FROM idx_arena_buy'))"
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  yieldomega_verify_kill_pid_if_set "${INDEXER_PID:-}"
  yieldomega_verify_kill_pid_if_set "${ANVIL_PID:-}"
}
trap cleanup EXIT

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=0
yieldomega_verify_boot_indexer_stack "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"
[[ -n "${CRED:-}" ]] || die "PlayCred address missing after deploy"

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
BUYER="${ANVIL_ACCOUNTS[1]}"
[[ -n "${BUYER}" ]] || die "need at least two Anvil accounts"
BUYER_LC="$(echo "${BUYER}" | tr '[:upper:]' '[:lower:]')"

anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
anvil_send "${BUYER}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown
wait_indexer_through "$(cast block-number --rpc-url "${RPC}")"

BUY_ROWS="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_buy")"
[[ "${BUY_ROWS}" == "1" ]] || die "expected one DOUB buy row before fork, got ${BUY_ROWS}"

POINTER_BEFORE_FORK="$(pg_chain_pointer_block)"
log "DOUB buy indexed through block ${POINTER_BEFORE_FORK}"

SNAPSHOT_ID="$(cast rpc evm_snapshot --rpc-url "${RPC}")"
[[ -n "${SNAPSHOT_ID}" && "${SNAPSHOT_ID}" != "null" ]] || die "evm_snapshot failed"

STARTER_CHARM="$(cast call "${TA}" "ONBOARDING_STARTER_CHARM_WAD()(uint256)" --rpc-url "${RPC}" | awk '{print $1}')"
anvil_send "${DEPLOYER}" "${CRED}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${BUYER}" "${TA}" "buyWithCred(uint256)" "${STARTER_CHARM}"
warp_past_cooldown
wait_indexer_through "$(cast block-number --rpc-url "${RPC}")"

LEVEL_UP_ROWS="$(pg_scalar "SELECT COUNT(*) FROM idx_arena_level_up")"
[[ "${LEVEL_UP_ROWS}" -ge 1 ]] || die "expected idx_arena_level_up row on orphan fork"
POINTER_ORPHAN="$(pg_chain_pointer_block)"
[[ "${POINTER_ORPHAN}" -gt "${POINTER_BEFORE_FORK}" ]] || die "orphan fork pointer ${POINTER_ORPHAN} not ahead of ${POINTER_BEFORE_FORK}"

STATS_ORPHAN="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/wallet/${BUYER_LC}/stats")"
level2_reached="$(echo "${STATS_ORPHAN}" | jq -r '.level_history[1].reached_at // empty')"
[[ -n "${level2_reached}" && "${level2_reached}" != "null" ]] || die "level_history[1].reached_at missing on orphan fork"
log "orphan fork indexed through ${POINTER_ORPHAN} (level_up rows=${LEVEL_UP_ROWS})"

cast rpc evm_revert "${SNAPSHOT_ID}" --rpc-url "${RPC}" >/dev/null \
  || die "evm_revert failed"

MINE_COUNT=$((POINTER_ORPHAN - POINTER_BEFORE_FORK + 1))
[[ "${MINE_COUNT}" -ge 1 ]] || die "invalid mine count ${MINE_COUNT}"
log "reorg drill: revert to block ${POINTER_BEFORE_FORK}, mining ${MINE_COUNT} empty blocks"
for _ in $(seq 1 "${MINE_COUNT}"); do
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
done

wait_for_reorg_heal "${POINTER_BEFORE_FORK}"
assert_no_ingest_divergence "post-reorg heal"

ONCHAIN_LEVEL="$(cast call "${TA}" "level(address)(uint256)" "${BUYER}" --rpc-url "${RPC}" | awk '{print $1}')"
[[ "${ONCHAIN_LEVEL}" == "1" ]] || die "onchain level expected 1 after canonical fork, got ${ONCHAIN_LEVEL}"

STATS_CANON="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/wallet/${BUYER_LC}/stats")"
buy_count="$(echo "${STATS_CANON}" | jq -r '.buy_count')"
[[ "${buy_count}" == "1" ]] || die "wallet stats buy_count expected 1, got ${buy_count}"
level1_reached="$(echo "${STATS_CANON}" | jq -r '.level_history[0].reached_at // empty')"
level2_after="$(echo "${STATS_CANON}" | jq -r '.level_history[1].reached_at // "null"')"
[[ -n "${level1_reached}" && "${level1_reached}" != "null" ]] || die "level_history[0] L1 reached_at missing after reorg"
[[ "${level2_after}" == "null" ]] || die "level_history[1].reached_at expected null after reorg, got ${level2_after}"

grep -q "reorg detected" "${VERIFY_INDEXER_LOG}" \
  || die "indexer log missing reorg detected (see ${VERIFY_INDEXER_LOG})"

log "PASS — reorg rollback cleared level_up; buy_count=1; pointer=$(pg_chain_pointer_block) matches chain tip"

echo "=== verify-indexer-reorg-anvil: OK (buyer=${BUYER_LC}, ancestor>=${POINTER_BEFORE_FORK}, buy_count=${buy_count}) ==="
