#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Smoke: DeployDev on fresh Anvil seeds KEY_EVM_1..3 (ETH + DOUB + CRED + mock CL8Y).
# No Docker, Postgres, or indexer — Foundry only.
#
# Usage (repo root):
#   bash scripts/verify-evm-dev-wallet-seed-anvil.sh
#
# Reuse an existing listener (skip Anvil spawn/kill):
#   REUSE_ANVIL=1 RPC=http://127.0.0.1:8545 bash scripts/verify-evm-dev-wallet-seed-anvil.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
RPC="${RPC:-http://127.0.0.1:${PORT}}"
DEPLOY_LOG="$(mktemp)"
REUSE_ANVIL="${REUSE_ANVIL:-0}"

# Documented defaults (Anvil accounts #0–#2) — ignore Cloud KEY_EVM_* overrides for this smoke.
unset KEY_EVM_1 KEY_EVM_2 KEY_EVM_3 ADDR_EVM_1 ADDR_EVM_2 ADDR_EVM_3 EVM_DEV_ADDRS

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
# shellcheck source=scripts/lib/evm_dev_keys.sh
source "${ROOT}/scripts/lib/evm_dev_keys.sh"

ETH_WEI="1000000000000000000000" # 1000e18 (matches seed script anvil_setBalance)
DOUB_WANT="1000000000000000000000000"
CRED_WANT="1000000000000000000000"
CL8Y_WANT="100000000000000000000000"

die() {
  echo "verify-evm-dev-wallet-seed-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-evm-dev-wallet-seed-anvil: $*"
}

erc20_balance() {
  cast call "$1" "balanceOf(address)(uint256)" "$2" --rpc-url "${RPC}" | awk '{print $1}' | tr -d '[],'
}

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "${got}" != "${want}" ]]; then
    die "${label}: got ${got}, want ${want}"
  fi
}

assert_uint_gte() {
  local got="$1" min="$2" label="$3"
  if ! python3 -c "import sys; sys.exit(0 if int('${got}') >= int('${min}') else 1)"; then
    die "${label}: got ${got}, want >= ${min}"
  fi
}

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ "${REUSE_ANVIL}" != "1" && -n "${ANVIL_PID:-}" ]]; then
    kill "${ANVIL_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

export PATH="${HOME}/.foundry/bin:${PATH}"
command -v cast >/dev/null || die "cast not on PATH (install Foundry)."
command -v forge >/dev/null || die "forge not on PATH (install Foundry)."

if [[ "${REUSE_ANVIL}" != "1" ]]; then
  pkill -f "anvil.*${PORT}" 2>/dev/null || true
  sleep 1
  anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
    >/tmp/yieldomega_verify_evm_dev_seed_anvil.log 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 40); do
    cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
    sleep 0.5
  done
  cast block-number --rpc-url "${RPC}" >/dev/null || die "Anvil did not start on ${RPC}"
fi

_extract_deploy_addr() {
  local label="$1"
  grep -E "${label}" "${DEPLOY_LOG}" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1 || true
}

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=1
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev

# yieldomega_anvil_deploy_dev sets TA/DOUB/CRED in function scope only — re-parse log here.
DOUB="$(_extract_deploy_addr "Doubloon")"
CRED="$(_extract_deploy_addr "PlayCred")"
CL8Y="$(_extract_deploy_addr "MockReserveCl8y")"
[[ -n "${DOUB}" ]] || die "Doubloon address missing after deploy"
[[ -n "${CRED}" ]] || die "PlayCred address missing after deploy"
[[ -n "${CL8Y}" ]] || die "MockReserveCl8y address missing (expected from DeployDev)"

log "DOUB=${DOUB} CRED=${CRED} CL8Y=${CL8Y}"
log "ADDR_EVM_1=${ADDR_EVM_1} ADDR_EVM_2=${ADDR_EVM_2} ADDR_EVM_3=${ADDR_EVM_3}"

# Account #0 (ADDR_EVM_1) pays gas for mint txs; #1–#2 should have exact 1000 ETH after anvil_setBalance.
ETH_MIN_DEPLOYER="900000000000000000000" # 900e18 — floor after seed mint gas

for addr in ${EVM_DEV_ADDRS}; do
  eth_bal="$(cast balance "${addr}" --rpc-url "${RPC}")"
  doub_bal="$(erc20_balance "${DOUB}" "${addr}")"
  cred_bal="$(erc20_balance "${CRED}" "${addr}")"
  cl8y_bal="$(erc20_balance "${CL8Y}" "${addr}")"
  if [[ "${addr}" == "${ADDR_EVM_1}" ]]; then
    # DeployDev also mints to Anvil #0 (E2E mock wallet) before seed runs.
    assert_uint_gte "${eth_bal}" "${ETH_MIN_DEPLOYER}" "ETH balance ${addr}"
    assert_uint_gte "${doub_bal}" "${DOUB_WANT}" "DOUB balance ${addr}"
    assert_uint_gte "${cred_bal}" "${CRED_WANT}" "CRED balance ${addr}"
    assert_uint_gte "${cl8y_bal}" "${CL8Y_WANT}" "CL8Y balance ${addr}"
  else
    assert_eq "${eth_bal}" "${ETH_WEI}" "ETH balance ${addr}"
    assert_eq "${doub_bal}" "${DOUB_WANT}" "DOUB balance ${addr}"
    assert_eq "${cred_bal}" "${CRED_WANT}" "CRED balance ${addr}"
    assert_eq "${cl8y_bal}" "${CL8Y_WANT}" "CL8Y balance ${addr}"
  fi
done

log "PASS — KEY_EVM_1..3 seeded on Anvil (ETH + DOUB + CRED + CL8Y)"
