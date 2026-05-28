#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared DeployDev.s.sol deploy + address extraction for Anvil workflows.
#
# After success, sets: TA, PV, AV, RR, DOUB, CRED (Arena v2 — GitLab #260).
# Optional Kumbaya only when YIELDOMEGA_DEPLOY_KUMBAYA=1 (#251).
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
  forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "${RPC}" \
    --code-size-limit 524288 -vv 2>&1 | tee "${DEPLOY_LOG}"

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
    KUMBAYA_LOG=$(mktemp)
    forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
      --rpc-url "${RPC}" --code-size-limit 524288 --sig "run(address)" "${TA}" 2>&1 | tee "${KUMBAYA_LOG}" || true
    _yieldomega_extract_k() {
      local label="$1"
      grep "${label}" "${KUMBAYA_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
    }
    KUMBAYA_WETH=$(_yieldomega_extract_k "AnvilWETH9:")
    KUMBAYA_USDM=$(_yieldomega_extract_k "AnvilMockUSDM:")
    KUMBAYA_ROUTER=$(_yieldomega_extract_k "AnvilKumbayaRouter")
    KUMBAYA_BUY_ROUTER=$(_yieldomega_extract_k "TimeCurveBuyRouter (single-tx")
    rm -f "${KUMBAYA_LOG}"
    echo "Kumbaya: WETH=${KUMBAYA_WETH} USDM=${KUMBAYA_USDM} Router=${KUMBAYA_ROUTER} BuyRouter=${KUMBAYA_BUY_ROUTER}"
  fi
}
