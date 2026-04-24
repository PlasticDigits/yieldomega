#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Rich Anvil simulation: Part1 (buys + deposits) → warp past TimeCurve deadline → Part2
# (end sale, claims, prizes, NFTs, ParamsUpdated) → warp/mine per epoch → finalizeEpoch x3.
#
# Prerequisites: Foundry (forge, cast), jq optional for loading addresses from broadcast JSON.
# Usage (from repo root or contracts/):
#   export RPC_URL=http://127.0.0.1:8545
#   export RESERVE_ASSET_ADDRESS=0x... TIMECURVE_ADDRESS=0x... RABBIT_TREASURY_ADDRESS=0x... LEPRECHAUN_NFT_ADDRESS=0x...
#   (legacy: USDM_ADDRESS is accepted as the same value)
#   bash contracts/script/anvil_rich_state.sh
#
# Or omit addresses if contracts/broadcast/DeployDev.s.sol/31337/run-latest.json exists (jq required).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT="$(cd "${CONTRACTS_ROOT}/.." && pwd)"
RPC="${RPC_URL:-http://127.0.0.1:8545}"
export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS_ROOT}/out-local-dev}"
mkdir -p "${FOUNDRY_OUT}"

# shellcheck source=../../scripts/lib/broadcast_proxy_addresses.sh
source "${ROOT}/scripts/lib/broadcast_proxy_addresses.sh"

# Default Anvil account #0 (matches DeployDev broadcast signer)
PK_DEPLOYER="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

load_addresses_from_broadcast() {
  local RUN="${CONTRACTS_ROOT}/broadcast/DeployDev.s.sol/31337/run-latest.json"
  if [[ ! -f "$RUN" ]] || ! command -v jq >/dev/null 2>&1; then
    return 0
  fi
  # UUPS: broadcast `contractName` "TimeCurve" / "RabbitTreasury" is the **implementation**;
  # canonical addresses are ERC1967Proxy rows (see scripts/lib/broadcast_proxy_addresses.sh, GitLab #61).
  if [[ -z "${TIMECURVE_ADDRESS:-}" ]]; then
    TIMECURVE_ADDRESS="$(broadcast_erc1967_proxy_address "$RUN" TimeCurve)" || return 1
  fi
  if [[ -z "${RABBIT_TREASURY_ADDRESS:-}" ]]; then
    RABBIT_TREASURY_ADDRESS="$(broadcast_erc1967_proxy_address "$RUN" RabbitTreasury)" || return 1
  fi
  if [[ -z "${LEPRECHAUN_NFT_ADDRESS:-}" ]]; then
    LEPRECHAUN_NFT_ADDRESS="$(broadcast_direct_create_address "$RUN" LeprechaunNFT)"
    if [[ -z "${LEPRECHAUN_NFT_ADDRESS}" || "${LEPRECHAUN_NFT_ADDRESS}" == "null" ]]; then
      echo "load_addresses_from_broadcast: missing LeprechaunNFT in ${RUN}" >&2
      return 1
    fi
  fi
}

# Reserve token must match TimeCurve.acceptedAsset (same as RabbitTreasury reserve).
resolve_reserve_from_timecurve() {
  : "${TIMECURVE_ADDRESS:?}"
  RESERVE_ASSET_ADDRESS="$(cast call "$TIMECURVE_ADDRESS" "acceptedAsset()(address)" --rpc-url "$RPC")"
  USDM_ADDRESS="${RESERVE_ASSET_ADDRESS}"
  echo "RESERVE_ASSET_ADDRESS (from TimeCurve.acceptedAsset)=$RESERVE_ASSET_ADDRESS"
}

block_ts() {
  cast block latest --rpc-url "$RPC" --json | jq -r '.timestamp' | head -1 | cast to-dec
}

# Decode uint256 from cast call (cast may append human-readable "[1.774e9]" — take first field only).
cast_u256_dec() {
  local addr="$1"
  local sig="$2"
  local raw
  raw="$(cast call "$addr" "$sig" --rpc-url "$RPC" 2>/dev/null | awk '{print $1}' | tr -d '[:space:]')"
  cast to-dec "$raw"
}

# Increase chain time by (target_unix_ts - now) if positive.
warp_to_at_least() {
  local target="$1"
  local now
  now="$(block_ts)"
  local delta=$((target - now))
  if [[ "$delta" -le 0 ]]; then
    echo "chain time ${now} already >= target ${target}, skip warp"
    return 0
  fi
  echo "anvil_increaseTime ${delta}s (target block time ${target}, was ${now})"
  cast rpc --rpc-url "$RPC" anvil_increaseTime "$(printf '0x%x' "$delta")"
  cast rpc --rpc-url "$RPC" anvil_mine 1
}

warp_past_timcurve_deadline() {
  local tc="$1"
  local deadline
  deadline="$(cast_u256_dec "$tc" "deadline()(uint256)")"
  warp_to_at_least "$((deadline + 1))"
}

finalize_epochs() {
  local rt="$1"
  local rounds="${2:-3}"
  local i
  for ((i = 0; i < rounds; i++)); do
    local end
    end="$(cast_u256_dec "$rt" "epochEnd()(uint256)")"
    warp_to_at_least "$((end + 1))"
    echo "finalizeEpoch ($((i + 1))/${rounds})"
    cast send "$rt" "finalizeEpoch()" --rpc-url "$RPC" --private-key "$PK_DEPLOYER"
  done
}

load_addresses_from_broadcast

: "${TIMECURVE_ADDRESS:?Set TIMECURVE_ADDRESS or run DeployDev so broadcast JSON exists}"
: "${RABBIT_TREASURY_ADDRESS:?Set RABBIT_TREASURY_ADDRESS or run DeployDev so broadcast JSON exists}"
: "${LEPRECHAUN_NFT_ADDRESS:?Set LEPRECHAUN_NFT_ADDRESS or run DeployDev so broadcast JSON exists}"

resolve_reserve_from_timecurve

export RESERVE_ASSET_ADDRESS USDM_ADDRESS TIMECURVE_ADDRESS RABBIT_TREASURY_ADDRESS LEPRECHAUN_NFT_ADDRESS

echo "=== SimulateAnvilRichState Part1 ==="
cd "${CONTRACTS_ROOT}"
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart1 \
  --rpc-url "$RPC" --broadcast --slow -vv

echo "=== Warp past TimeCurve deadline ==="
warp_past_timcurve_deadline "$TIMECURVE_ADDRESS"

echo "=== SimulateAnvilRichState Part2 ==="
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart2 \
  --rpc-url "$RPC" --broadcast --slow -vv

echo "=== Finalize Rabbit epochs (3x) ==="
finalize_epochs "$RABBIT_TREASURY_ADDRESS" 3

echo "Done. Indexer should pick up Buy, Burrow*, SaleEnded, CharmsRedeemed, PrizesDistributed, Minted, ParamsUpdated, etc."
