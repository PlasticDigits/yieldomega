#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #272 — flat REFERRAL_CRED_FLAT_WAD (5 CRED per side) on referred DOUB buys; buyWithCred has no referral path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
DEPLOY_LOG="$(mktemp)"
FLAT_WAD=5000000000000000000
CHARM_WAD=1000000000000000000
REF_CODE="verify272"

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-referral-flat-cred-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-referral-flat-cred-anvil: $*"
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
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify272_anvil.log 2>&1 &
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
[[ -n "${RR:-}" ]] || die "ReferralRegistry address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
REFERRER="${ANVIL_ACCOUNTS[1]}"
BUYER="${ANVIL_ACCOUNTS[2]}"
[[ -n "${REFERRER}" && -n "${BUYER}" ]] || die "need at least three Anvil accounts"

CL8Y="$(cast call "${RR}" "cl8yToken()(address)" --rpc-url "${RPC}" | awk '{print $1}')"
[[ -n "${CL8Y}" ]] || die "cl8yToken missing"

log "TimeArena=${TA} ReferralRegistry=${RR} PlayCred=${CRED} referrer=${REFERRER} buyer=${BUYER}"

flat="$(cast_u256 "${TA}" "REFERRAL_CRED_FLAT_WAD()(uint256)")"
assert_eq "${flat}" "${FLAT_WAD}" "REFERRAL_CRED_FLAT_WAD"
cred_per_buy="$(cast_u256 "${TA}" "CRED_PER_BUY()(uint256)")"
if [[ "${cred_per_buy}" == "${FLAT_WAD}" ]]; then
  die "CRED_PER_BUY must differ from REFERRAL_CRED_FLAT_WAD (decoupling)"
fi

anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${REFERRER}" "1000000000000000000000000"
anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${DEPLOYER}" "${CL8Y}" "mint(address,uint256)" "${REFERRER}" "10000000000000000000"
anvil_send "${REFERRER}" "${CL8Y}" "approve(address,uint256)" "${RR}" "10000000000000000000"
anvil_send "${REFERRER}" "${RR}" "registerCode(string)" "${REF_CODE}"

code_hash="$(cast call "${RR}" "hashCode(string)(bytes32)" "${REF_CODE}" --rpc-url "${RPC}" | awk '{print $1}')"
[[ -n "${code_hash}" ]] || die "hashCode failed"

anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"

ref_cred_before="$(cred_balance "${REFERRER}")"
buy_cred_before="$(cred_balance "${BUYER}")"
anvil_send "${BUYER}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" "${code_hash}"
ref_cred_after="$(cred_balance "${REFERRER}")"
buy_cred_after="$(cred_balance "${BUYER}")"

ref_delta="$(python3 -c "print(int('${ref_cred_after}') - int('${ref_cred_before}'))")"
buy_delta="$(python3 -c "print(int('${buy_cred_after}') - int('${buy_cred_before}'))")"
assert_eq "${ref_delta}" "${FLAT_WAD}" "referrer +5 CRED on referred buy"
assert_eq "${buy_delta}" "${FLAT_WAD}" "buyer +5 CRED on referred buy"

buyer_charm="$(cast call "${TA}" "charmWeight(address)(uint256)" "${BUYER}" --rpc-url "${RPC}" | awk '{print $1}')"
assert_eq "${buyer_charm}" "${CHARM_WAD}" "charmWeight equals purchased charm only"

warp_past_cooldown
anvil_send "${DEPLOYER}" "${CRED}" "mint(address,uint256)" "${BUYER}" "10000000000000000000000"
anvil_send "${BUYER}" "${TA}" "buyWithCred(uint256)" "${CHARM_WAD}"
ref_after_cred_buy="$(cred_balance "${REFERRER}")"
if [[ "$(python3 -c "print(int('${ref_after_cred_buy}') - int('${ref_cred_after}'))")" != "0" ]]; then
  die "buyWithCred must not mint referral CRED to referrer"
fi

log "forge test --match-test test_referred_buy_mints_cred_not_charm"
cd "${ROOT}/contracts"
FOUNDRY_PROFILE=ci forge test --match-test "test_referred_buy_mints_cred_not_charm|test_self_referral_reverts" --silent

echo "=== verify-referral-flat-cred-anvil: OK ==="
