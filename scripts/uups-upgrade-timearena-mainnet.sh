#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Broadcast UUPS upgradeToAndCall on the TimeArena ERC1967 proxy (MegaETH mainnet by default).
# Deploy a fresh implementation first — see docs/operations/deployment-guide.md § TimeArena UUPS upgrade.
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
  scripts/uups-upgrade-timearena-mainnet.sh <NEW_IMPLEMENTATION> [UPGRADE_CALLDATA_HEX]

Defaults:
  RPC_URL=https://mainnet.megaeth.com/rpc
  CHAIN_ID=4326
  ADDRESS_REGISTRY_PATH=indexer/address-registry.megaeth-mainnet.json (TimeArena proxy from .contracts.TimeArena)

Environment overrides:
  RPC_URL, CHAIN_ID, ADDRESS_REGISTRY_PATH, TIME_ARENA_PROXY (skip registry; required if CHAIN_ID != 4326)
  CAST_GAS_LIMIT — passed to cast send as --gas-limit when set

Signing:
  Always uses cast --interactive (hidden key prompt). Do not pass private keys on the CLI.

Examples:
  scripts/uups-upgrade-timearena-mainnet.sh 0xYourNewTimeArenaImplementation

  CHAIN_ID=6343 RPC_URL=https://carrot.megaeth.com/rpc TIME_ARENA_PROXY=0x… \\
    scripts/uups-upgrade-timearena-mainnet.sh 0xNewImpl
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
  TIME_ARENA_PROXY="${TIME_ARENA_PROXY:-$(jq -r '.contracts.TimeArena' "$ADDRESS_REGISTRY_PATH")}"
else
  TIME_ARENA_PROXY="${TIME_ARENA_PROXY:-}"
  if [[ -z "$TIME_ARENA_PROXY" ]]; then
    echo "CHAIN_ID=${CHAIN_ID}: set TIME_ARENA_PROXY to the TimeArena proxy on that network." >&2
    exit 1
  fi
fi

if [[ -z "$TIME_ARENA_PROXY" || "$TIME_ARENA_PROXY" == "null" ]]; then
  echo "Could not resolve TimeArena proxy address." >&2
  exit 1
fi

ACTUAL_CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$ACTUAL_CHAIN" != "$CHAIN_ID" ]]; then
  echo "RPC chain id ${ACTUAL_CHAIN} does not match CHAIN_ID=${CHAIN_ID}." >&2
  exit 1
fi

PROXY_CS="$(cast to-checksum "$TIME_ARENA_PROXY" 2>/dev/null || echo "$TIME_ARENA_PROXY")"
IMPL_CS="$(cast to-checksum "$NEW_IMPL" 2>/dev/null || echo "$NEW_IMPL")"

OWNER_HEX="$(tr -d '[:space:]' <<<"$(cast call "$PROXY_CS" "owner()(address)" --rpc-url "$RPC_URL")")"
OWNER_CS="$(cast to-checksum "$OWNER_HEX" 2>/dev/null || echo "$OWNER_HEX")"

echo "Network:     chain id ${CHAIN_ID} @ ${RPC_URL}"
echo "TimeArena:   ${PROXY_CS} (proxy — call upgrade here, not the implementation row)"
echo "New impl:    ${IMPL_CS}"
echo "Call data:   ${CALLDATA}"
echo "owner():     ${OWNER_CS}"
echo
echo "Signer must be TimeArena owner (UUPS _authorizeUpgrade). Starting cast send with interactive key prompt…"

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
