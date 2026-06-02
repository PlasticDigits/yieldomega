#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Standard local Anvil dev keys for cloud agent / manual QA (Foundry default accounts 0–2).
# Override with KEY_EVM_1, KEY_EVM_2, KEY_EVM_3 in the environment (e.g. Cursor Cloud secrets).
#
# shellcheck shell=bash
# Usage: source scripts/lib/evm_dev_keys.sh

# Account #0 — same as DeployDev E2E mock wallet and Foundry's first Anvil key.
export KEY_EVM_1="${KEY_EVM_1:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
# Accounts #1–#2 (Anvil 1.7+ default mnemonic keys for the classic dev addresses).
export KEY_EVM_2="${KEY_EVM_2:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
export KEY_EVM_3="${KEY_EVM_3:-0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a}"

if ! command -v cast >/dev/null 2>&1; then
  echo "evm_dev_keys.sh: cast not on PATH; cannot derive addresses." >&2
  return 1 2>/dev/null || exit 1
fi

export ADDR_EVM_1="${ADDR_EVM_1:-$(cast wallet address --private-key "${KEY_EVM_1}")}"
export ADDR_EVM_2="${ADDR_EVM_2:-$(cast wallet address --private-key "${KEY_EVM_2}")}"
export ADDR_EVM_3="${ADDR_EVM_3:-$(cast wallet address --private-key "${KEY_EVM_3}")}"

# Space-separated list for loops in seed / setup scripts.
export EVM_DEV_ADDRS="${ADDR_EVM_1} ${ADDR_EVM_2} ${ADDR_EVM_3}"
