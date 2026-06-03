#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #271 — per-podium timer params on fresh Anvil DeployDev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
DEPLOY_LOG="$(mktemp)"
WAD=1000000000000000000

# Product table from ArenaPodiumTimerConfig (seconds).
EXPECTED_EXT=(120 60 90 300)
EXPECTED_INIT=(86400 43200 64800 172800)
EXPECTED_RESET_BELOW=(780 240 510 3300)
EXPECTED_RESET_TO=(900 300 600 3600)

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-podium-timers-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-podium-timers-anvil: $*"
}

cast_u256() {
  local addr="$1" sig="$2"
  shift 2
  if [[ $# -gt 0 ]]; then
    cast call "${addr}" "${sig}" "$@" --rpc-url "${RPC}" | awk '{print $1}'
  else
    cast call "${addr}" "${sig}" --rpc-url "${RPC}" | awk '{print $1}'
  fi
}

anvil_send_mint_doub() {
  local to="$1" amount="$2"
  cast send "${DOUB}" "mint(address,uint256)" "${to}" "${amount}" \
    --from "${DEPLOYER}" --unlocked --rpc-url "${RPC}" >/dev/null
}

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "${got}" != "${want}" ]]; then
    die "${label}: got ${got}, want ${want}"
  fi
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify271_anvil.log 2>&1 &
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

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
ALICE="${ANVIL_ACCOUNTS[0]}"
[[ -n "${ALICE}" ]] || die "need at least one Anvil account"

log "TimeArena=${TA} alice=${ALICE}"

anvil_send_mint_doub "${ALICE}" "100000000000000000000000"
cast send "${DOUB}" "approve(address,uint256)" "${TA}" "100000000000000000000000" \
  --from "${ALICE}" --unlocked --rpc-url "${RPC}" >/dev/null

start="$(cast_u256 "${TA}" "arenaStart()(uint256)")"
[[ "${start}" != "0" ]] || die "arenaStart is zero"

prev_dl=""
for c in 0 1 2 3; do
  init="$(cast_u256 "${TA}" "podiumInitialTimerSec(uint256)(uint256)" "${c}")"
  ext="$(cast_u256 "${TA}" "podiumTimerExtensionSec(uint256)(uint256)" "${c}")"
  below="$(cast_u256 "${TA}" "podiumResetBelowRemainingSec(uint256)(uint256)" "${c}")"
  reset_to="$(cast_u256 "${TA}" "podiumResetToRemainingSec(uint256)(uint256)" "${c}")"
  dl="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "${c}")"
  want_dl="$(python3 -c "print(int('${start}') + ${EXPECTED_INIT[$c]})")"

  assert_eq "${init}" "${EXPECTED_INIT[$c]}" "podiumInitialTimerSec[${c}]"
  assert_eq "${ext}" "${EXPECTED_EXT[$c]}" "podiumTimerExtensionSec[${c}]"
  assert_eq "${below}" "${EXPECTED_RESET_BELOW[$c]}" "podiumResetBelowRemainingSec[${c}]"
  assert_eq "${reset_to}" "${EXPECTED_RESET_TO[$c]}" "podiumResetToRemainingSec[${c}]"
  assert_eq "${dl}" "${want_dl}" "podiumDeadline[${c}] at startArena"

  if [[ -n "${prev_dl}" && "${dl}" == "${prev_dl}" ]]; then
    die "podiumDeadline[${c}] equals previous category — expected distinct initial deadlines"
  fi
  prev_dl="${dl}"
done

before=()
for c in 0 1 2 3; do
  before[c]="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "${c}")"
done

cast send "${TA}" "buy(uint256)" "${WAD}" --from "${ALICE}" --unlocked --rpc-url "${RPC}" >/dev/null

for c in 0 1 2 3; do
  after="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "${c}")"
  want_after="$(python3 -c "print(int('${before[$c]}') + ${EXPECTED_EXT[$c]})")"
  assert_eq "${after}" "${want_after}" "podiumDeadline[${c}] after buy (+${EXPECTED_EXT[$c]}s)"
done

epoch_before="$(cast_u256 "${TA}" "lastBuyEpoch()(uint256)")"
assert_eq "${epoch_before}" "0" "lastBuyEpoch before Last Buy hard reset"

# Time Booster hard-reset band: remaining < 240s → snap to 300s from now.
booster_dl="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "1")"
warp_to="$(python3 -c "print(int('${booster_dl}') - 200)")"
cast rpc anvil_setNextBlockTimestamp "${warp_to}" --rpc-url "${RPC}" >/dev/null
cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
before_booster="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "1")"
cast rpc anvil_increaseTime 2 --rpc-url "${RPC}" >/dev/null
cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
cast send "${TA}" "buy(uint256)" "${WAD}" --from "${ALICE}" --unlocked --rpc-url "${RPC}" >/dev/null
after_booster="$(cast_u256 "${TA}" "podiumDeadline(uint256)(uint256)" "1")"
now_ts="$(cast block latest --rpc-url "${RPC}" --json | jq -r '.timestamp')"
now_ts="$(python3 -c "print(int('${now_ts}', 0))")"
want_booster="$(python3 -c "print(int('${now_ts}') + ${EXPECTED_RESET_TO[1]})")"
assert_eq "${after_booster}" "${want_booster}" "Time Booster hard-reset band (240→300s)"

log "forge test --match-contract TimeArenaTest (#271 subset)"
cd "${ROOT}/contracts"
FOUNDRY_PROFILE=ci forge test --match-test "test_start_arena_initial_deadlines_differ_by_category|test_multi_podium_deadline_extend|test_time_booster_hard_reset_band_240_to_300|test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer|test_defended_streak_uses_last_buy_timer_not_other_podium|test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll" --silent

echo "=== verify-podium-timers-anvil: OK ==="
