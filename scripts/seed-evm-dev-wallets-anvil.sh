#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Seed KEY_EVM_1..3 public addresses on local Anvil: native ETH + DOUB / PlayCred / mock CL8Y.
#
# Requires DeployDev to have run (deployer holds DOUB MINTER_ROLE and PlayCred MINTER_ROLE).
#
# Usage (repo root):
#   RPC=http://127.0.0.1:8545 DOUB=0x... CRED=0x... CL8Y=0x... bash scripts/seed-evm-dev-wallets-anvil.sh
#
# Optional: DEPLOYER_PK (defaults to KEY_EVM_1 / Anvil account #0).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/evm_dev_keys.sh
source "${ROOT}/scripts/lib/evm_dev_keys.sh"

RPC="${RPC:-${RPC_URL:-http://127.0.0.1:8545}}"
DEPLOYER_PK="${DEPLOYER_PK:-${KEY_EVM_1}}"

die() {
  echo "seed-evm-dev-wallets-anvil.sh: $*" >&2
  exit 1
}

command -v cast >/dev/null || die "cast not on PATH (install Foundry)."
[[ -n "${DOUB:-}" ]] || die "Set DOUB (Doubloon proxy address from DeployDev log)."
[[ -n "${CRED:-}" ]] || die "Set CRED (PlayCred proxy address from DeployDev log)."

# 1000 ETH — matches Anvil default rich accounts.
ETH_WEI_HEX="0x3635C9ADC5DEA00000"
DOUB_MINT="1000000000000000000000000" # 1_000_000e18 — same as E2E mock wallet in DeployDev
CRED_MINT="1000000000000000000000"   # 1000e18
CL8Y_MINT="100000000000000000000000" # 100_000e18

echo "==> Seeding dev wallets on ${RPC}"
for addr in ${EVM_DEV_ADDRS}; do
  echo "    ${addr}"
  cast rpc anvil_setBalance "${addr}" "${ETH_WEI_HEX}" --rpc-url "${RPC}" >/dev/null
  cast send "${DOUB}" "mint(address,uint256)" "${addr}" "${DOUB_MINT}" \
    --rpc-url "${RPC}" --private-key "${DEPLOYER_PK}" --json >/dev/null
  cast send "${CRED}" "mint(address,uint256)" "${addr}" "${CRED_MINT}" \
    --rpc-url "${RPC}" --private-key "${DEPLOYER_PK}" --json >/dev/null
  if [[ -n "${CL8Y:-}" ]]; then
    cast send "${CL8Y}" "mint(address,uint256)" "${addr}" "${CL8Y_MINT}" \
      --rpc-url "${RPC}" --private-key "${DEPLOYER_PK}" --json >/dev/null
  fi
done

echo "==> Done (ETH + DOUB + CRED${CL8Y:+, CL8Y})."
