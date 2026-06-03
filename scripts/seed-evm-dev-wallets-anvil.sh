#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Seed KEY_EVM_1..3 public addresses on local Anvil: native ETH + DOUB / PlayCred / mock CL8Y.
#
# Requires DeployDev to have run (deployer or YIELDOMEGA_SEED_MINTER_ADDRESS holds MINTER_ROLE).
# Idempotent: skips mint when balance already meets target (GitLab #281).
#
# Usage (repo root):
#   RPC=http://127.0.0.1:8545 DOUB=0x... CRED=0x... CL8Y=0x... bash scripts/seed-evm-dev-wallets-anvil.sh
#
# Minter key: DEPLOYER_PK > PRIVATE_KEY > Anvil #0 default (aligned with DeployDev.s.sol).
# Recipients: ADDR_EVM_1..3 from KEY_EVM_* (see scripts/lib/evm_dev_keys.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/evm_dev_keys.sh
source "${ROOT}/scripts/lib/evm_dev_keys.sh"
# shellcheck source=scripts/lib/anvil_deployer_key.sh
source "${ROOT}/scripts/lib/anvil_deployer_key.sh"

RPC="${RPC:-${RPC_URL:-http://127.0.0.1:8545}}"
DEPLOYER_PK="$(yieldomega_resolve_seed_minter_pk)"

# 1000 ETH — matches Anvil default rich accounts.
ETH_WEI_HEX="0x3635C9ADC5DEA00000"
DOUB_MINT="1000000000000000000000000" # 1_000_000e18 — same as E2E mock wallet in DeployDev
CRED_MINT="1000000000000000000000"   # 1000e18
CL8Y_MINT="100000000000000000000000" # 100_000e18

die() {
  echo "seed-evm-dev-wallets-anvil.sh: $*" >&2
  exit 1
}

command -v cast >/dev/null || die "cast not on PATH (install Foundry)."
[[ -n "${DOUB:-}" ]] || die "Set DOUB (Doubloon proxy address from DeployDev log)."
[[ -n "${CRED:-}" ]] || die "Set CRED (PlayCred proxy address from DeployDev log)."

_assert_dev_loopback_rpc() {
  local host
  host="$(python3 - "${RPC}" <<'PY'
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print((u.hostname or "").lower())
PY
)"
  case "${host}" in
    127.0.0.1 | localhost | ::1) ;;
    *)
      die "Refusing seed on non-loopback RPC (${RPC}). Dev-wallet seed is local-only."
      ;;
  esac
}

_assert_dev_chain_id() {
  local chain_id
  chain_id="$(cast chain-id --rpc-url "${RPC}" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "${chain_id}" ]] || die "Could not read chain id from ${RPC}."
  case "${chain_id}" in
    31337 | 6342 | 6343) ;;
    *)
      die "Refusing seed on chain id ${chain_id} (allowed: 31337, 6342, 6343 — DevOnlyChainGuard dev chains)."
      ;;
  esac
}

_erc20_balance() {
  cast call "$1" "balanceOf(address)(uint256)" "$2" --rpc-url "${RPC}" | awk '{print $1}' | tr -d '[],'
}

_balance_gte() {
  python3 -c "import sys; sys.exit(0 if int('${1}') >= int('${2}') else 1)"
}

_assert_minter_role() {
  local token="$1" label="$2"
  local role minter_addr has
  role="$(cast call "${token}" "MINTER_ROLE()(bytes32)" --rpc-url "${RPC}")"
  minter_addr="$(cast wallet address --private-key "${DEPLOYER_PK}")"
  has="$(cast call "${token}" "hasRole(bytes32,address)(bool)" "${role}" "${minter_addr}" --rpc-url "${RPC}" | tr -d '[:space:]')"
  if [[ "${has}" != "true" ]]; then
    die "$(cat <<EOF
${label} MINTER_ROLE missing for seed caller ${minter_addr}.
Fix: use the same PRIVATE_KEY as DeployDev (default Anvil account #0), or set DEPLOYER_PK to a key that received MINTER_ROLE.
If KEY_EVM_1 differs from the deploy broadcaster, re-run DeployDev with YIELDOMEGA_SEED_MINTER_ADDRESS set (via anvil_deploy_dev.sh) or align PRIVATE_KEY / DEPLOYER_PK.
DOUB=${DOUB} CRED=${CRED} RPC=${RPC}
EOF
)"
  fi
}

_maybe_mint() {
  local token="$1" addr="$2" amount="$3" label="$4"
  local bal
  bal="$(_erc20_balance "${token}" "${addr}")"
  if _balance_gte "${bal}" "${amount}"; then
    echo "    skip ${label} mint for ${addr} (balance >= target)"
    return 0
  fi
  cast send "${token}" "mint(address,uint256)" "${addr}" "${amount}" \
    --rpc-url "${RPC}" --private-key "${DEPLOYER_PK}" --json >/dev/null
}

_assert_dev_loopback_rpc
_assert_dev_chain_id

echo "==> Seeding dev wallets on ${RPC}"
echo "    minter $(cast wallet address --private-key "${DEPLOYER_PK}")"
_assert_minter_role "${DOUB}" "Doubloon"
_assert_minter_role "${CRED}" "PlayCred"

for addr in ${EVM_DEV_ADDRS}; do
  echo "    ${addr}"
  cast rpc anvil_setBalance "${addr}" "${ETH_WEI_HEX}" --rpc-url "${RPC}" >/dev/null
  _maybe_mint "${DOUB}" "${addr}" "${DOUB_MINT}" "DOUB"
  _maybe_mint "${CRED}" "${addr}" "${CRED_MINT}" "CRED"
  if [[ -n "${CL8Y:-}" ]]; then
    _maybe_mint "${CL8Y}" "${addr}" "${CL8Y_MINT}" "CL8Y"
  fi
done

echo "==> Done (ETH + DOUB + CRED${CL8Y:+, CL8Y})."
