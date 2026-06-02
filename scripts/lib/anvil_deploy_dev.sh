#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared DeployDev.s.sol deploy + address extraction for Anvil workflows.
#
# After success, sets: TA, PV, AV, RR, DOUB, CRED (Arena v2 — GitLab #260).
# Kumbaya + TimeArenaBuyRouter when YIELDOMEGA_DEPLOY_KUMBAYA=1 (default in e2e-anvil.sh — GitLab #270).
#
# TimeArena buy cooldown: YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 / YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC (#88).

yieldomega_anvil_deploy_dev() {
  if [ -z "${ROOT:-}" ] || [ -z "${RPC:-}" ] || [ -z "${DEPLOY_LOG:-}" ]; then
    echo "yieldomega_anvil_deploy_dev: need ROOT, RPC, and DEPLOY_LOG set." >&2
    return 1
  fi
  echo "Building contracts and deploying DeployDev (Arena v2)..."
  cd "${ROOT}/contracts"
  export FOUNDRY_OUT="${ROOT}/contracts/out-e2e-anvil"
  mkdir -p "${FOUNDRY_OUT}"
  forge build
  if ! forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "${RPC}" \
    --code-size-limit 524288 -vv 2>&1 | tee "${DEPLOY_LOG}"; then
    echo "DeployDev broadcast failed (see ${DEPLOY_LOG})." >&2
    return 1
  fi

  _yieldomega_extract_addr() {
    local label="$1"
    grep -E "^[[:space:]]*${label}:" "${DEPLOY_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
  }

  TA=$(_yieldomega_extract_addr "TimeArena")
  PV=$(_yieldomega_extract_addr "PodiumVaults")
  AV=$(_yieldomega_extract_addr "AdminSellVault")
  RR=$(_yieldomega_extract_addr "ReferralRegistry")
  DOUB=$(_yieldomega_extract_addr "Doubloon")
  CRED=$(_yieldomega_extract_addr "PlayCred")

  if [ -z "${TA}" ] || [ -z "${PV}" ] || [ -z "${AV}" ] || [ -z "${RR}" ]; then
    echo "Could not parse deploy addresses. Expected TimeArena, PodiumVaults, AdminSellVault, ReferralRegistry." >&2
    return 1
  fi

  echo "Addresses: TimeArena=${TA} PodiumVaults=${PV} AdminSellVault=${AV} ReferralRegistry=${RR} Doubloon=${DOUB} PlayCred=${CRED}"

  KUMBAYA_WETH=""
  KUMBAYA_USDM=""
  KUMBAYA_ROUTER=""
  KUMBAYA_BUY_ROUTER=""
  if [ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" = "1" ]; then
    echo "Deploying Kumbaya Anvil fixtures (YIELDOMEGA_DEPLOY_KUMBAYA=1)..."
    # Let DeployDev txs settle before the second broadcast (avoids Anvil nonce races).
    sleep 2
    KUMBAYA_LOG=$(mktemp)
    _yieldomega_kumbaya_deploy_once() {
      forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
        --rpc-url "${RPC}" --code-size-limit 524288 --sig "run(address)" "${TA}" 2>&1 | tee "${KUMBAYA_LOG}"
    }
    if ! _yieldomega_kumbaya_deploy_once; then
      echo "Kumbaya deploy failed; retrying once after 3s..." >&2
      sleep 3
      _yieldomega_kumbaya_deploy_once || return 1
    fi
    # shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
    source "${ROOT}/scripts/lib/kumbaya_local_anvil_env.sh"
    yieldomega_kumbaya_extract_from_deploy_log "${KUMBAYA_LOG}"
    rm -f "${KUMBAYA_LOG}"
    if [ -z "${KUMBAYA_BUY_ROUTER}" ]; then
      echo "DeployKumbayaAnvilFixtures: could not parse TimeArenaBuyRouter from log." >&2
      return 1
    fi
    ONCHAIN_BR="$(cast call "${TA}" "timeArenaBuyRouter()(address)" --rpc-url "${RPC}" 2>/dev/null | tr -d '[:space:]')"
    ONCHAIN_BR="$(cast to-checksum "${ONCHAIN_BR}" 2>/dev/null || echo "")"
    EXP_BR="$(cast to-checksum "${KUMBAYA_BUY_ROUTER}" 2>/dev/null || echo "${KUMBAYA_BUY_ROUTER}")"
    if [ -z "${ONCHAIN_BR}" ] || [ "${ONCHAIN_BR,,}" != "${EXP_BR,,}" ]; then
      echo "TimeArena.timeArenaBuyRouter (${ONCHAIN_BR}) != deployed ${EXP_BR}" >&2
      return 1
    fi
    echo "Kumbaya: WETH=${KUMBAYA_WETH} USDM=${KUMBAYA_USDM} Router=${KUMBAYA_ROUTER} TimeArenaBuyRouter=${KUMBAYA_BUY_ROUTER}"
  fi

  if [ "${YIELDOMEGA_SEED_EVM_DEV_WALLETS:-1}" = "1" ] && [ -n "${DOUB:-}" ] && [ -n "${CRED:-}" ]; then
    CL8Y=$(_yieldomega_extract_addr "MockReserveCl8y")
    # shellcheck disable=SC1091
    source "${ROOT}/scripts/lib/evm_dev_keys.sh" 2>/dev/null || true
    if command -v cast >/dev/null 2>&1; then
      echo "Seeding KEY_EVM_1..3 wallets (DOUB/CRED/ETH${CL8Y:+, CL8Y})..."
      RPC="${RPC}" DOUB="${DOUB}" CRED="${CRED}" CL8Y="${CL8Y:-}" \
        bash "${ROOT}/scripts/seed-evm-dev-wallets-anvil.sh"
    fi
  fi
}
