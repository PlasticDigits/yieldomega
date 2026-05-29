#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Build the Stage-3 address registry JSON from an existing DeployProduction broadcast
# (`run-latest.json`) without running `forge script` or `forge build`.
# Arena v2 contract set — GitLab #259.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_MEGAETH_MAINNET_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"

RUN_JSON=""
OUT_FILE=""
CHAIN_ID=""
NETWORK_NAME=""
RESERVE_ASSET_ADDRESS=""
DEPLOYER_ADDRESS=""
RPC_URL=""
WITH_FORGE_BUILD=false
HANDOFF_DIR=""

usage() {
  cat <<'USAGE'
Write `.deploy` address registry JSON from `DeployProduction` broadcast artifacts (no forge script).

Usage:
  scripts/write-production-registry-from-broadcast.sh [run-latest.json] [options]

Defaults:
  run-latest.json → contracts/broadcast/DeployProduction.s.sol/<chain>/run-latest.json
  chain id        → value of `chain` in the broadcast JSON (else 4326)
  network         → megaeth_mainnet
  reserve asset   → canonical MegaETH CL8Y when chain is 4326 (else required via --reserve)
  deployer        → `transactions[0].transaction.from` from the broadcast
  output path     → .deploy/yieldomega-<network>-registry-<UTC>.json

Options:
  --run-json PATH       Path to run-latest.json (overrides positional).
  --out PATH            Registry JSON output path.
  --chain-id ID         Override chain id embedded in the registry.
  --network NAME        Registry `network` label.
  --reserve ADDRESS     CL8Y / reserve ERC-20 (required when chain is not 4326).
  --deployer ADDRESS    Override first-tx deployer (defaults to broadcast `from`).
  --rpc-url URL         Shown in printed Frontend/Indexer hints (default: MegaETH mainnet RPC).
  --with-forge-build    Run `forge build` before ABI hash export (default: skip build).
  -h, --help            Show this help.

  --handoff DIR         Write DIR with address-registry.json, indexer.env, vite-frontend.env,
                        and README.txt for scp to production (DIR relative to repo root OK).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-json)
      RUN_JSON="${2:?missing value for --run-json}"
      shift 2
      ;;
    --out)
      OUT_FILE="${2:?missing value for --out}"
      shift 2
      ;;
    --chain-id)
      CHAIN_ID="${2:?missing value for --chain-id}"
      shift 2
      ;;
    --network)
      NETWORK_NAME="${2:?missing value for --network}"
      shift 2
      ;;
    --reserve)
      RESERVE_ASSET_ADDRESS="${2:?missing value for --reserve}"
      shift 2
      ;;
    --deployer)
      DEPLOYER_ADDRESS="${2:?missing value for --deployer}"
      shift 2
      ;;
    --rpc-url)
      RPC_URL="${2:?missing value for --rpc-url}"
      shift 2
      ;;
    --with-forge-build)
      WITH_FORGE_BUILD=true
      shift
      ;;
    --handoff)
      HANDOFF_DIR="${2:?missing value for --handoff}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -n "$RUN_JSON" ]]; then
        echo "Unexpected extra argument: $1" >&2
        usage
        exit 1
      fi
      RUN_JSON="$1"
      shift
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

is_address() {
  [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]
}

need_cmd jq
need_cmd python3
need_cmd cast
need_cmd git
need_cmd forge

if [[ -z "$RUN_JSON" ]]; then
  CID_TRY="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
  RUN_JSON="${CONTRACTS_DIR}/broadcast/DeployProduction.s.sol/${CID_TRY}/run-latest.json"
fi
if [[ ! -f "$RUN_JSON" ]]; then
  echo "Broadcast file not found: ${RUN_JSON}" >&2
  exit 1
fi

if [[ -z "$CHAIN_ID" ]]; then
  CHAIN_ID="$(jq -r '.chain // empty' "$RUN_JSON")"
  if [[ -z "$CHAIN_ID" || "$CHAIN_ID" == "null" ]]; then
    CHAIN_ID="$DEFAULT_CHAIN_ID"
  fi
fi
if [[ ! "$CHAIN_ID" =~ ^[0-9]+$ ]] || [[ "$CHAIN_ID" == "0" ]]; then
  echo "Invalid or missing CHAIN_ID: ${CHAIN_ID}" >&2
  exit 1
fi

NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"

if [[ -z "$RESERVE_ASSET_ADDRESS" && "$CHAIN_ID" == "4326" ]]; then
  RESERVE_ASSET_ADDRESS="$DEFAULT_MEGAETH_MAINNET_CL8Y"
fi
if [[ -z "$RESERVE_ASSET_ADDRESS" ]]; then
  echo "RESERVE_ASSET_ADDRESS is required (use --reserve) when CHAIN_ID is not 4326." >&2
  exit 1
fi
if ! is_address "$RESERVE_ASSET_ADDRESS"; then
  echo "RESERVE_ASSET_ADDRESS must be a 0x + 40 hex address." >&2
  exit 1
fi

if [[ -z "$DEPLOYER_ADDRESS" ]]; then
  DEPLOYER_ADDRESS="$(jq -r '.transactions[0].transaction.from // empty' "$RUN_JSON")"
fi
if ! is_address "$DEPLOYER_ADDRESS"; then
  echo "Could not read a valid deployer address from ${RUN_JSON} (use --deployer)." >&2
  exit 1
fi

if [[ -z "$OUT_FILE" ]]; then
  mkdir -p "$DEPLOY_DIR"
  OUT_FILE="${DEPLOY_DIR}/yieldomega-${NETWORK_NAME}-registry-$(date -u +%Y%m%dT%H%M%SZ).json"
fi

if [[ -n "$HANDOFF_DIR" && "$HANDOFF_DIR" != /* ]]; then
  HANDOFF_DIR="$ROOT/$HANDOFF_DIR"
fi

GIT_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"

if ! DEPLOY_BLOCK="$(
  python3 - "$RUN_JSON" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    run = json.load(fh)

values = []
for receipt in run.get("receipts", []):
    value = receipt.get("blockNumber")
    if isinstance(value, int):
        values.append(value)
        continue
    value = str(value or "").strip()
    if not value or value == "null":
        continue
    values.append(int(value, 16) if value.startswith("0x") else int(value))

if not values:
    sys.exit(1)
print(min(values))
PY
)"; then
  echo "Could not read receipt block numbers from ${RUN_JSON}" >&2
  exit 1
fi

BROADCAST_ADDR_LIB="${ROOT}/scripts/lib/broadcast_proxy_addresses.sh"
ARENA_REGISTRY_LIB="${ROOT}/scripts/lib/arena_v2_registry_from_broadcast.sh"
# shellcheck source=lib/broadcast_proxy_addresses.sh
source "$BROADCAST_ADDR_LIB"
# shellcheck source=lib/arena_v2_registry_from_broadcast.sh
source "$ARENA_REGISTRY_LIB"
yieldomega_arena_v2_extract_registry_addresses "$RUN_JSON"

export_abi_env=()
if [[ "$WITH_FORGE_BUILD" == true ]]; then
  export_abi_env=()
else
  export_abi_env=(env YIELDOMEGA_EXPORT_ABI_SKIP_FORGE_BUILD=1)
fi

ABI_HASH_TMP="$(mktemp)"
(
  cd "$CONTRACTS_DIR"
  "${export_abi_env[@]}" "$CONTRACTS_DIR/script/export_abi_hashes.sh" >"$ABI_HASH_TMP"
)

jq -n \
  --argjson chainId "$CHAIN_ID" \
  --arg network "$NETWORK_NAME" \
  --arg reserve "$RESERVE_ASSET_ADDRESS" \
  --arg doub "$DOUB" \
  --arg cred "$CRED" \
  --arg pv "$PV" \
  --arg av "$AV" \
  --arg rr "$RR" \
  --arg ta "$TA" \
  --arg buyRouter "$BUY_ROUTER" \
  --arg deployer "$DEPLOYER_ADDRESS" \
  --argjson deployBlock "$DEPLOY_BLOCK" \
  --arg gitCommit "$GIT_COMMIT" \
  --argjson abiHashes "{$(<"$ABI_HASH_TMP")}" \
  '{
    chainId: $chainId,
    network: $network,
    abiHashesSha256: $abiHashes.abiHashesSha256,
    contracts: {
      CL8Y_reserve: $reserve,
      Doubloon: $doub,
      PlayCred: $cred,
      PodiumVaults: $pv,
      AdminSellVault: $av,
      ReferralRegistry: $rr,
      TimeArena: $ta,
      TimeArenaBuyRouter: $buyRouter,
      LaunchedToken: $doub
    },
    deployer: $deployer,
    deployBlock: $deployBlock,
    gitCommit: $gitCommit
  }' >"$OUT_FILE"
rm -f "$ABI_HASH_TMP"

RPC_HINT="${RPC_URL:-$DEFAULT_RPC_URL}"

if [[ "$OUT_FILE" == "$ROOT"/* ]]; then
  REGISTRY_REPO_REL=".${OUT_FILE#"$ROOT"}"
else
  REGISTRY_REPO_REL="$OUT_FILE"
fi

echo "Wrote registry (path inside this repo): ${REGISTRY_REPO_REL}"
echo "  ${OUT_FILE}"
echo
echo "Indexer env:"
echo "  CHAIN_ID=${CHAIN_ID}"
echo "  RPC_URL=${RPC_HINT}"
echo "  START_BLOCK=${DEPLOY_BLOCK}"
echo "  ADDRESS_REGISTRY_PATH=/your/server/path/to/$(basename "$OUT_FILE")"
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
fi
echo
echo "Frontend env:"
echo "  VITE_CHAIN_ID=${CHAIN_ID}"
echo "  VITE_RPC_URL=${RPC_HINT}"
echo "  VITE_TIME_ARENA_ADDRESS=${TA}"
echo "  VITE_PODIUM_VAULTS_ADDRESS=${PV}"
echo "  VITE_ADMIN_SELL_VAULT_ADDRESS=${AV}"
echo "  VITE_REFERRAL_REGISTRY_ADDRESS=${RR}"
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER=${BUY_ROUTER}"
fi
echo
echo "Also set: VITE_INDEXER_URL, VITE_EXPLORER_BASE_URL, VITE_WALLETCONNECT_PROJECT_ID — see frontend/.env.example."

if [[ -n "$HANDOFF_DIR" ]]; then
  mkdir -p "$HANDOFF_DIR"
  HANDOFF_REL="$HANDOFF_DIR"
  if [[ "$HANDOFF_DIR" == "$ROOT"/* ]]; then
    HANDOFF_REL=".${HANDOFF_DIR#"$ROOT"}"
  fi
  cp -f "$OUT_FILE" "${HANDOFF_DIR}/address-registry.json"
  cat >"${HANDOFF_DIR}/README.txt" <<EOF
YieldOmega Arena v2 — files for your production server

1. Copy this folder to the server, e.g.:
     scp -r ${HANDOFF_REL} user@your-server:/opt/yieldomega/
2. On the server, edit indexer.env: set ADDRESS_REGISTRY_PATH to address-registry.json.
3. Merge vite-frontend.env into frontend/.env.production.
4. Add DATABASE_URL and other indexer settings per indexer/README.md.
EOF

  {
    echo "ADDRESS_REGISTRY_PATH=/opt/yieldomega/$(basename "$HANDOFF_DIR")/address-registry.json"
    echo "CHAIN_ID=${CHAIN_ID}"
    echo "RPC_URL=${RPC_HINT}"
    echo "START_BLOCK=${DEPLOY_BLOCK}"
    if [[ -n "$BUY_ROUTER" ]]; then
      echo "INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
    fi
  } >"${HANDOFF_DIR}/indexer.env"

  {
    echo "VITE_CHAIN_ID=${CHAIN_ID}"
    echo "VITE_RPC_URL=${RPC_HINT}"
    echo "VITE_TIME_ARENA_ADDRESS=${TA}"
    echo "VITE_PODIUM_VAULTS_ADDRESS=${PV}"
    echo "VITE_ADMIN_SELL_VAULT_ADDRESS=${AV}"
    echo "VITE_REFERRAL_REGISTRY_ADDRESS=${RR}"
    if [[ -n "$BUY_ROUTER" ]]; then
      echo "VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER=${BUY_ROUTER}"
    fi
  } >"${HANDOFF_DIR}/vite-frontend.env"

  echo
  echo "Handoff folder: ${HANDOFF_REL}/"
fi
