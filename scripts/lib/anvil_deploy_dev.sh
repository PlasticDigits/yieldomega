#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared DeployDev.s.sol deploy + address extraction for Anvil workflows.
#
# Source this file from repo root context. Before calling yieldomega_anvil_deploy_dev:
#   - ROOT   — absolute path to repository root
#   - RPC    — JSON-RPC URL (e.g. http://127.0.0.1:8545)
#   - DEPLOY_LOG — path to a writable file (forge script output is teed here)
#
# After success, sets shell variables:
#   TC, RT, NFT — TimeCurve, RabbitTreasury, LeprechaunNFT
#   KUMBAYA_WETH, KUMBAYA_USDM, KUMBAYA_ROUTER — issue #41 Anvil DEX fixtures (same address for router+quoter)
#   KUMBAYA_BUY_ROUTER — issue #65/66 TimeCurveBuyRouter (optional single-tx ETH/USDM; same deploy as Kumbaya fixtures)
#
# Exits non-zero if forge fails or addresses cannot be parsed.

yieldomega_anvil_deploy_dev() {
  if [ -z "${ROOT:-}" ] || [ -z "${RPC:-}" ] || [ -z "${DEPLOY_LOG:-}" ]; then
    echo "yieldomega_anvil_deploy_dev: need ROOT, RPC, and DEPLOY_LOG set." >&2
    return 1
  fi
  echo "Building contracts and deploying DeployDev..."
  cd "${ROOT}/contracts"
  export FOUNDRY_OUT="${ROOT}/contracts/out-e2e-anvil"
  mkdir -p "${FOUNDRY_OUT}"
  forge build
  forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "${RPC}" -vv 2>&1 | tee "${DEPLOY_LOG}"

  _yieldomega_extract_addr() {
    local label="$1"
    # Anchor like start-local-anvil-stack.sh so verbose forge output cannot pick a stale/wrong line.
    grep -E "^[[:space:]]*${label}:" "${DEPLOY_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
  }

  TC=$(_yieldomega_extract_addr "TimeCurve")
  RT=$(_yieldomega_extract_addr "RabbitTreasury")
  NFT=$(_yieldomega_extract_addr "LeprechaunNFT")

  if [ -z "${TC}" ] || [ -z "${RT}" ] || [ -z "${NFT}" ]; then
    echo "Could not parse deploy addresses from log. Expected TimeCurve, RabbitTreasury, LeprechaunNFT lines." >&2
    return 1
  fi

  echo "Addresses: TimeCurve=${TC} RabbitTreasury=${RT} LeprechaunNFT=${NFT}"

  echo "Deploying Kumbaya Anvil fixtures (issue #41; see docs/integrations/kumbaya.md issue #46)..."
  KUMBAYA_LOG=$(mktemp)
  forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
    --rpc-url "${RPC}" --sig "run(address)" "${TC}" 2>&1 | tee "${KUMBAYA_LOG}"

  _yieldomega_extract_k() {
    local label="$1"
    grep "${label}" "${KUMBAYA_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
  }

  KUMBAYA_WETH=$(_yieldomega_extract_k "AnvilWETH9:")
  KUMBAYA_USDM=$(_yieldomega_extract_k "AnvilMockUSDM:")
  KUMBAYA_ROUTER=$(_yieldomega_extract_k "AnvilKumbayaRouter")
  KUMBAYA_BUY_ROUTER=$(_yieldomega_extract_k "TimeCurveBuyRouter (single-tx")
  rm -f "${KUMBAYA_LOG}"

  if [ -z "${KUMBAYA_WETH}" ] || [ -z "${KUMBAYA_USDM}" ] || [ -z "${KUMBAYA_ROUTER}" ]; then
    echo "Could not parse Kumbaya fixture addresses from deploy log." >&2
    return 1
  fi
  echo "Kumbaya fixtures: WETH=${KUMBAYA_WETH} USDM=${KUMBAYA_USDM} Router=${KUMBAYA_ROUTER} TimeCurveBuyRouter=${KUMBAYA_BUY_ROUTER}"
}
