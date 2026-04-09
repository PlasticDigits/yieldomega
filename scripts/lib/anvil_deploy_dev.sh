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
#   TC, RT, NFT — checksummed-style hex addresses for TimeCurve, RabbitTreasury, LeprechaunNFT
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
    grep "${label}:" "${DEPLOY_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
  }

  TC=$(_yieldomega_extract_addr "TimeCurve")
  RT=$(_yieldomega_extract_addr "RabbitTreasury")
  NFT=$(_yieldomega_extract_addr "LeprechaunNFT")

  if [ -z "${TC}" ] || [ -z "${RT}" ] || [ -z "${NFT}" ]; then
    echo "Could not parse deploy addresses from log. Expected TimeCurve, RabbitTreasury, LeprechaunNFT lines." >&2
    return 1
  fi

  echo "Addresses: TimeCurve=${TC} RabbitTreasury=${RT} LeprechaunNFT=${NFT}"
}
