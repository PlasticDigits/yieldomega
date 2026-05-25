#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Broadcast UUPS upgradeToAndCall on the DoubPresaleVesting ERC1967 proxy (MegaETH mainnet by default).
# Deploy a fresh implementation first: from contracts/, `forge build` then
# `forge create src/vesting/DoubPresaleVesting.sol:DoubPresaleVesting …` (see docs/operations/presale-doub-instant-distribution.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_REGISTRY="${ROOT}/indexer/address-registry.megaeth-mainnet.json"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-4326}"
ADDRESS_REGISTRY_PATH="${ADDRESS_REGISTRY_PATH:-$DEFAULT_REGISTRY}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/uups-upgrade-doub-presale-vesting-mainnet.sh <NEW_IMPLEMENTATION> [UPGRADE_CALLDATA_HEX]

Defaults:
  RPC_URL=https://mainnet.megaeth.com/rpc
  CHAIN_ID=4326
  ADDRESS_REGISTRY_PATH=indexer/address-registry.megaeth-mainnet.json (DoubPresaleVesting proxy)

Environment overrides:
  RPC_URL, CHAIN_ID, ADDRESS_REGISTRY_PATH, DOUB_PRESALE_VESTING_PROXY
  CAST_GAS_LIMIT — passed to cast send when set

Signing:
  Always uses cast --interactive (hidden key prompt).

Examples:
  scripts/uups-upgrade-doub-presale-vesting-mainnet.sh 0xYourNewDoubPresaleVestingImpl
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi
if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

NEW_IMPL="$1"
CALLDATA="${2:-0x}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}
need_cmd cast
need_cmd jq

if [[ "$CHAIN_ID" == "4326" ]]; then
  if [[ ! -f "$ADDRESS_REGISTRY_PATH" ]]; then
    echo "Registry not found: $ADDRESS_REGISTRY_PATH" >&2
    exit 1
  fi
  VESTING_PROXY="${DOUB_PRESALE_VESTING_PROXY:-$(jq -r '.contracts.DoubPresaleVesting' "$ADDRESS_REGISTRY_PATH")}"
else
  VESTING_PROXY="${DOUB_PRESALE_VESTING_PROXY:-}"
  if [[ -z "$VESTING_PROXY" ]]; then
    echo "CHAIN_ID=${CHAIN_ID}: set DOUB_PRESALE_VESTING_PROXY." >&2
    exit 1
  fi
fi

if [[ -z "$VESTING_PROXY" || "$VESTING_PROXY" == "null" ]]; then
  echo "Could not resolve DoubPresaleVesting proxy address." >&2
  exit 1
fi

ACTUAL_CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$ACTUAL_CHAIN" != "$CHAIN_ID" ]]; then
  echo "RPC chain id ${ACTUAL_CHAIN} does not match CHAIN_ID=${CHAIN_ID}." >&2
  exit 1
fi

PROXY_CS="$(cast to-checksum "$VESTING_PROXY" 2>/dev/null || echo "$VESTING_PROXY")"
IMPL_CS="$(cast to-checksum "$NEW_IMPL" 2>/dev/null || echo "$NEW_IMPL")"

OWNER_HEX="$(tr -d '[:space:]' <<<"$(cast call "$PROXY_CS" "owner()(address)" --rpc-url "$RPC_URL")")"
OWNER_CS="$(cast to-checksum "$OWNER_HEX" 2>/dev/null || echo "$OWNER_HEX")"

echo "Network:              chain id ${CHAIN_ID} @ ${RPC_URL}"
echo "DoubPresaleVesting:   ${PROXY_CS} (proxy)"
echo "New impl:             ${IMPL_CS}"
echo "Call data:            ${CALLDATA}"
echo "owner():              ${OWNER_CS}"
echo
echo "Signer must be vesting owner. Starting cast send with interactive key prompt…"

cast_args=(
  send "$PROXY_CS"
  "upgradeToAndCall(address,bytes)" "$IMPL_CS" "$CALLDATA"
  --rpc-url "$RPC_URL"
  --interactive
)
if [[ -n "${CAST_GAS_LIMIT:-}" ]]; then
  cast_args+=(--gas-limit "$CAST_GAS_LIMIT")
fi

cast "${cast_args[@]}"
