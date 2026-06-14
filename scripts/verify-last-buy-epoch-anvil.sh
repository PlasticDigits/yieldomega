#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #278 — persist LastBuyEpochStarted + global last_buy_epoch on arena buys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8547}"
INDEXER_PORT="${INDEXER_PORT:-3102}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
VERIFY_TAG=verify278
CHARM_WAD=1000000000000000000

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
# shellcheck source=scripts/lib/verify_anvil_common.sh
source "${ROOT}/scripts/lib/verify_anvil_common.sh"
# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  echo "verify-last-buy-epoch-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-last-buy-epoch-anvil: $*"
}

cast_u256() {
  cast call "$1" "$2" --rpc-url "${RPC}" | awk '{print $1}'
}

warp_past_cooldown() { verify_anvil_warp_past_cooldown; }
anvil_send() { verify_anvil_send "$@"; }

wait_indexer_sync() {
  local want="$1"
  for _ in $(seq 1 90); do
    local tip
    tip="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" | jq -r '.chain_pointer.block_number // 0')"
    if [[ "${tip}" -ge "${want}" ]]; then
      return 0
    fi
    sleep 1
  done
  verify_indexer_log_tail
  die "indexer did not reach block ${want}"
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  verify_anvil_kill_children
}
trap cleanup EXIT

verify_anvil_stop_existing
verify_anvil_start

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=0
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

verify_indexer_write_registry "verify-last-buy-epoch-anvil.sh"
verify_indexer_reset_db
verify_indexer_start
verify_indexer_wait_status || {
  verify_indexer_log_tail
  die "indexer /v1/status unavailable"
}

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
ALICE="${ANVIL_ACCOUNTS[0]}"
BOB="${ANVIL_ACCOUNTS[1]}"
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
[[ -n "${BOB}" ]] || die "need at least two Anvil accounts"

for acct in "${ALICE}" "${BOB}"; do
  anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${acct}" "1000000000000000000000000"
  anvil_send "${acct}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
done

# Epoch 0 buy (Alice)
anvil_send "${ALICE}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown
wait_indexer_sync "$(cast block-number --rpc-url "${RPC}")"

epoch0_rows="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_buy WHERE last_buy_epoch = 0")"
[[ "${epoch0_rows}" -ge 1 ]] || die "expected epoch-0 buy row"

# Hard reset → epoch 1 (Alice), then Bob buys in epoch 1
deadline="$(cast_u256 "${TA}" "deadline()(uint256)")"
# Warp to <13m remaining (forge tests use deadline - 600)
warp_target=$((deadline - 600))
cast rpc anvil_setNextBlockTimestamp "${warp_target}" --rpc-url "${RPC}" >/dev/null
cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
warp_past_cooldown

anvil_send "${ALICE}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown
anvil_send "${BOB}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown
wait_indexer_sync "$(cast block-number --rpc-url "${RPC}")"

chain_epoch="$(cast_u256 "${TA}" "lastBuyEpoch()(uint256)")"
[[ "${chain_epoch}" == "1" ]] || die "onchain lastBuyEpoch expected 1, got ${chain_epoch}"

epoch_rows="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_last_buy_epoch_started WHERE epoch = 1")"
[[ "${epoch_rows}" -ge 1 ]] || die "missing idx_arena_last_buy_epoch_started row for epoch 1"

bob_epoch="$(psql "${PG_URL}" -tAc "SELECT last_buy_epoch FROM idx_arena_buy WHERE buyer = lower('${BOB}')")"
[[ "${bob_epoch}" == "1" ]] || die "Bob buy last_buy_epoch expected 1, got ${bob_epoch}"

bob_lower="$(echo "${BOB}" | tr '[:upper:]' '[:lower:]')"
stats="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/wallet/${bob_lower}/stats")"
participated="$(echo "${stats}" | jq -r '.epochs_participated')"
[[ "${participated}" == "1" ]] || die "Bob epochs_participated expected 1, got ${participated}"

log "PASS — LastBuyEpochStarted persisted; Bob last_buy_epoch=1; wallet stats epochs_participated=1"
