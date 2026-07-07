#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #364 — arena event catalog API after Last Buy epoch ingest on Anvil.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8548}"
INDEXER_PORT="${INDEXER_PORT:-3103}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000

VERIFY_SCRIPT_PREFIX="verify-arena-events-anvil"
VERIFY_ANVIL_LOG="/tmp/yieldomega_verify364_anvil.log"
VERIFY_INDEXER_LOG="/tmp/yieldomega_verify364_indexer.log"
VERIFY_REGISTRY_COMMENT="verify-arena-events-anvil.sh"

# shellcheck source=scripts/lib/verify_indexer_stack.sh
source "${ROOT}/scripts/lib/verify_indexer_stack.sh"

die() {
  yieldomega_verify_die "$@"
}

log() {
  yieldomega_verify_log "$@"
}

cast_u256() {
  cast call "$1" "$2" --rpc-url "${RPC}" | awk '{print $1}'
}

warp_past_cooldown() {
  yieldomega_verify_warp_past_cooldown "${RPC}"
}

anvil_send() {
  yieldomega_verify_anvil_send "${RPC}" "$@"
}

wait_indexer_sync() {
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

cleanup() {
  rm -f "${DEPLOY_LOG}" /tmp/yieldomega_verify364_events.json
  yieldomega_verify_kill_pid_if_set "${INDEXER_PID:-}"
  yieldomega_verify_kill_pid_if_set "${ANVIL_PID:-}"
}
trap cleanup EXIT

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=0
yieldomega_verify_boot_indexer_stack "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
ALICE="${ANVIL_ACCOUNTS[0]}"
BOB="${ANVIL_ACCOUNTS[1]}"
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
[[ -n "${BOB}" ]] || die "need at least two Anvil accounts"

for acct in "${ALICE}" "${BOB}"; do
  anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${acct}" "1000000000000000000000000"
  anvil_send "${acct}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
done

anvil_send "${ALICE}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown
wait_indexer_sync "$(cast block-number --rpc-url "${RPC}")"

deadline="$(cast_u256 "${TA}" "deadline()(uint256)")"
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

epoch_started_count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_last_buy_epoch_started")"
[[ "${epoch_started_count}" -ge 1 ]] || die "missing idx_arena_last_buy_epoch_started rows (count=${epoch_started_count})"

code="$(curl -s -o /tmp/yieldomega_verify364_events.json -w '%{http_code}' \
  "http://127.0.0.1:${INDEXER_PORT}/v1/arena/events?limit=20")"
[[ "${code}" == "200" ]] || die "GET /v1/arena/events returned ${code}"
jq -e '.items | length >= 1' /tmp/yieldomega_verify364_events.json >/dev/null \
  || die "expected at least one arena event row (db=${epoch_started_count}, body=$(cat /tmp/yieldomega_verify364_events.json))"

jq -e '.items[] | select(.kind == "last_buy_epoch_start")' /tmp/yieldomega_verify364_events.json >/dev/null \
  || die "missing last_buy_epoch_start event in list"

EVENT_ID="$(jq -r '.items[] | select(.kind == "last_buy_epoch_start") | .id' /tmp/yieldomega_verify364_events.json | head -1)"
[[ -n "${EVENT_ID}" && "${EVENT_ID}" != "null" ]] || die "missing event id"

ENC_ID="${EVENT_ID//:/%3A}"
detail_code="$(curl -s -o /tmp/yieldomega_verify364_event_detail.json -w '%{http_code}' \
  "http://127.0.0.1:${INDEXER_PORT}/v1/arena/events/${ENC_ID}")"
[[ "${detail_code}" == "200" ]] || die "GET /v1/arena/events/{id} returned ${detail_code}"
jq -e '.chart_buys | type == "array"' /tmp/yieldomega_verify364_event_detail.json >/dev/null
jq -e '.title | length > 0' /tmp/yieldomega_verify364_event_detail.json >/dev/null

filter_code="$(curl -s -o /dev/null -w '%{http_code}' \
  "http://127.0.0.1:${INDEXER_PORT}/v1/arena/events?kind=last_buy_epoch_start&q=1")"
[[ "${filter_code}" == "200" ]] || die "filtered events query returned ${filter_code}"

bad_code="$(curl -s -o /dev/null -w '%{http_code}' \
  "http://127.0.0.1:${INDEXER_PORT}/v1/arena/events/not-valid")"
[[ "${bad_code}" == "400" ]] || die "invalid event id should 400, got ${bad_code}"

log "PASS — arena events list/detail API after Last Buy epoch ingest (#364)"
