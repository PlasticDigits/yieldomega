#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #268 — CRED buy burn (100/CHARM) + first-buy 150 CRED bonus on fresh Anvil DeployDev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
DEPLOY_LOG="$(mktemp)"
WAD=1000000000000000000

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-cred-buy-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-cred-buy-anvil: $*"
}

cast_u256() {
  cast call "$1" "$2" --rpc-url "${RPC}" | awk '{print $1}'
}

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "${got}" != "${want}" ]]; then
    die "${label}: got ${got}, want ${want}"
  fi
}

cred_balance() {
  cast call "${CRED}" "balanceOf(address)(uint256)" "$1" --rpc-url "${RPC}" | awk '{print $1}'
}

warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

anvil_send() {
  local from="$1" to="$2" sig="$3" arg="$4"
  cast send "${to}" "${sig}" "${arg}" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

anvil_send_mint() {
  local to="$1" amount="$2"
  cast send "${CRED}" "mint(address,uint256)" "${to}" "${amount}" \
    --from "${DEPLOYER}" --unlocked --rpc-url "${RPC}" >/dev/null
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify268_anvil.log 2>&1 &
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
[[ -n "${CRED:-}" ]] || die "PlayCred address missing after deploy"

# Anvil dev accounts (unlocked; no private keys in this script — gitleaks-safe)
mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
ALICE="${ANVIL_ACCOUNTS[0]}"
BOB="${ANVIL_ACCOUNTS[1]}"
[[ -n "${BOB}" ]] || die "need at least two Anvil accounts"

log "TimeArena=${TA} PlayCred=${CRED} alice=${ALICE} bob=${BOB}"

rate="$(cast_u256 "${TA}" "CRED_PER_CHARM_WAD()(uint256)")"
assert_eq "${rate}" "100000000000000000000" "CRED_PER_CHARM_WAD"

anvil_send_mint "${ALICE}" "10000000000000000000000"
anvil_send_mint "${BOB}" "10000000000000000000000"

bal_before="$(cred_balance "${ALICE}")"
anvil_send "${ALICE}" "${TA}" "buyWithCred(uint256)" "${WAD}"
bal_after="$(cred_balance "${ALICE}")"
burned="$(python3 -c "print(int('${bal_before}') - int('${bal_after}'))")"
assert_eq "${burned}" "100000000000000000000" "buyWithCred(1e18) burn"

epoch="$(cast_u256 "${TA}" "lastBuyEpoch()(uint256)")"
target="$(python3 -c "print(int('${epoch}') + 1)")"
bonus="$(cast call "${TA}" "epochFixedCredBonus(uint256,address)(uint256)" "${target}" "${ALICE}" \
  --rpc-url "${RPC}" | awk '{print $1}')"
assert_eq "${bonus}" "150000000000000000000" "first-buy epochFixedCredBonus"
pending="$(cast call "${TA}" "pendingCred(address,uint256)(uint256)" "${ALICE}" "${target}" \
  --rpc-url "${RPC}" | awk '{print $1}')"
assert_eq "${pending}" "150000000000000000000" "first-buy pendingCred"

warp_past_cooldown
anvil_send "${ALICE}" "${TA}" "buyWithCred(uint256)" "${WAD}"
bonus2="$(cast call "${TA}" "epochFixedCredBonus(uint256,address)(uint256)" "${target}" "${ALICE}" \
  --rpc-url "${RPC}" | awk '{print $1}')"
assert_eq "${bonus2}" "150000000000000000000" "second buy must not add bonus"

bal_before="$(cred_balance "${BOB}")"
ten_charm="10000000000000000000"
anvil_send "${BOB}" "${TA}" "buyWithCred(uint256)" "${ten_charm}"
bal_after="$(cred_balance "${BOB}")"
burned="$(python3 -c "print(int('${bal_before}') - int('${bal_after}'))")"
assert_eq "${burned}" "1000000000000000000000" "buyWithCred(10e18) burn"

warp_past_cooldown
bal_before="$(cred_balance "${BOB}")"
min_charm="990000000000000000"
anvil_send "${BOB}" "${TA}" "buyWithCred(uint256)" "${min_charm}"
bal_after="$(cred_balance "${BOB}")"
burned="$(python3 -c "print(int('${bal_before}') - int('${bal_after}'))")"
assert_eq "${burned}" "99000000000000000000" "buyWithCred(99e16) burn"

log "forge test --match-contract TimeArena"
cd "${ROOT}/contracts"
forge test --match-contract TimeArena --silent

echo "=== verify-cred-buy-anvil: OK ==="
