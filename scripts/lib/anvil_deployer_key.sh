#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Resolve DeployDev broadcaster / dev-wallet seed minter key (GitLab #281).
# Must stay aligned with DeployDev.s.sol vm.envOr("PRIVATE_KEY", …).
#
# shellcheck shell=bash
# Usage: source scripts/lib/anvil_deployer_key.sh

# Foundry Anvil account #0 — same default as DeployDev.s.sol and E2E mock wallet.
ANVIL_DEFAULT_DEPLOYER_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Resolve forge-script broadcaster PK: PRIVATE_KEY > default (never KEY_EVM_1).
yieldomega_resolve_private_key() {
  if [[ -n "${PRIVATE_KEY:-}" ]]; then
    printf '%s' "${PRIVATE_KEY}"
    return 0
  fi
  printf '%s' "${ANVIL_DEFAULT_DEPLOYER_PK}"
}

# Resolve seed minter PK: explicit DEPLOYER_PK > PRIVATE_KEY > default.
# Recipients remain ADDR_EVM_1..3 from evm_dev_keys.sh — not the minter identity.
yieldomega_resolve_seed_minter_pk() {
  if [[ -n "${DEPLOYER_PK:-}" ]]; then
    printf '%s' "${DEPLOYER_PK}"
    return 0
  fi
  yieldomega_resolve_private_key
}

# Export PRIVATE_KEY for forge script when unset (DeployDev alignment).
yieldomega_export_deploy_private_key() {
  export PRIVATE_KEY="$(yieldomega_resolve_private_key)"
}

# When seed minter address differs from deploy broadcaster, DeployDev grants extra MINTER_ROLE.
yieldomega_export_seed_minter_address_if_needed() {
  command -v cast >/dev/null 2>&1 || return 0
  local deploy_pk seed_pk deploy_addr seed_addr
  deploy_pk="$(yieldomega_resolve_private_key)"
  seed_pk="$(yieldomega_resolve_seed_minter_pk)"
  deploy_addr="$(cast wallet address --private-key "${deploy_pk}")"
  seed_addr="$(cast wallet address --private-key "${seed_pk}")"
  if [[ "${deploy_addr,,}" != "${seed_addr,,}" ]]; then
    export YIELDOMEGA_SEED_MINTER_ADDRESS="${seed_addr}"
  else
    unset YIELDOMEGA_SEED_MINTER_ADDRESS 2>/dev/null || true
  fi
}
