#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Interactive MegaETH mainnet deploy for TimeArenaBuyRouter + TimeArena.setTimeArenaBuyRouter (#251 / #270).
set -euo pipefail

unset -v PRIVATE_KEY DEPLOYER_PRIVATE_KEY ADMIN_PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"

DEFAULT_RPC_URL="https://rpc-megaeth-mainnet.globalstake.io"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_DEPLOY_ADMIN_ADDRESS="0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c"
DEFAULT_KUMBAYA_SWAP_ROUTER="0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e"
DEFAULT_DOUB="0xc3654b4f879937b767afbb64b7c230ff436d2342"
DEFAULT_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
DEFAULT_WETH="0x4200000000000000000000000000000000000006"
DEFAULT_USDM="0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
DEFAULT_ETHERSCAN_VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=4326"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
TIME_ARENA_ADDRESS="${TIME_ARENA_ADDRESS:-}"
REGISTRY_PATH="${REGISTRY_PATH:-}"
DEPLOY_ADMIN_ADDRESS="${DEPLOY_ADMIN_ADDRESS:-$DEFAULT_DEPLOY_ADMIN_ADDRESS}"
KUMBAYA_SWAP_ROUTER_ADDRESS="${KUMBAYA_SWAP_ROUTER_ADDRESS:-$DEFAULT_KUMBAYA_SWAP_ROUTER}"
DOUB_ADDRESS="${DOUB_ADDRESS:-$DEFAULT_DOUB}"
CL8Y_ADDRESS="${CL8Y_ADDRESS:-$DEFAULT_CL8Y}"
KUMBAYA_WETH_ADDRESS="${KUMBAYA_WETH_ADDRESS:-$DEFAULT_WETH}"
KUMBAYA_STABLE_TOKEN_ADDRESS="${KUMBAYA_STABLE_TOKEN_ADDRESS:-$DEFAULT_USDM}"
DOUB_SURPLUS_RECIPIENT_ADDRESS="${DOUB_SURPLUS_RECIPIENT_ADDRESS:-}"
VERIFY=true
WIRE_ROUTER=true
ASSUME_YES=false
FORGE_RESUME=false
DEPLOYER_PRIVATE_KEY=""
ADMIN_PRIVATE_KEY=""
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-megaeth-buy-router.sh [options]

Interactive deploy for TimeArenaBuyRouter on MegaETH mainnet (forge script — MegaEVM code-size safe).

Defaults (chain 4326):
  RPC_URL=https://rpc-megaeth-mainnet.globalstake.io
  Kumbaya SwapRouter02=0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e
  DOUB / CL8Y / WETH / USDm = production integrator-kit addresses
  DEPLOY_ADMIN_ADDRESS=0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c (router Ownable owner)

Options:
  --time-arena ADDRESS       TimeArena proxy (required unless REGISTRY_PATH / TIME_ARENA_ADDRESS set)
  --registry PATH            Read TimeArena from registry JSON; optional --update-registry writes router back
  --update-registry          Patch TimeArenaBuyRouter into --registry JSON after deploy
  --admin ADDRESS            TimeArena owner + router Ownable owner
  --doub-surplus ADDRESS     doubSurplusRecipient (default: deployer address)
  --rpc-url URL
  --chain-id ID
  --skip-verify
  --deploy-only              Skip setTimeArenaBuyRouter (admin tx)
  --resume                   Resume partial forge broadcast
  -y, --yes                  Skip typed confirmation
  -h, --help

Prompts (hidden): deployer key, Etherscan API key (unless --skip-verify), admin key (unless --deploy-only).

Do not use `forge create` on MegaETH — use this script (`forge script` + --code-size-limit 524288).
USAGE
}

UPDATE_REGISTRY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --time-arena)
      TIME_ARENA_ADDRESS="${2:?missing value for --time-arena}"
      shift 2
      ;;
    --registry)
      REGISTRY_PATH="${2:?missing value for --registry}"
      shift 2
      ;;
    --update-registry)
      UPDATE_REGISTRY=true
      shift
      ;;
    --admin)
      DEPLOY_ADMIN_ADDRESS="${2:?missing value for --admin}"
      shift 2
      ;;
    --doub-surplus)
      DOUB_SURPLUS_RECIPIENT_ADDRESS="${2:?missing value for --doub-surplus}"
      shift 2
      ;;
    --rpc-url)
      RPC_URL="${2:?missing value for --rpc-url}"
      shift 2
      ;;
    --chain-id)
      CHAIN_ID="${2:?missing value for --chain-id}"
      shift 2
      ;;
    --skip-verify)
      VERIFY=false
      shift
      ;;
    --deploy-only)
      WIRE_ROUTER=false
      shift
      ;;
    --resume)
      FORGE_RESUME=true
      shift
      ;;
    -y|--yes)
      ASSUME_YES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
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

prompt_secret() {
  local var_name="$1"
  local prompt="$2"
  local current="${!var_name:-}"
  if [[ -z "$current" ]]; then
    read -r -s -p "$prompt" current
    echo
    export "$var_name=$current"
  fi
}

wipe_keys() {
  DEPLOYER_PRIVATE_KEY=""
  ADMIN_PRIVATE_KEY=""
  unset -v DEPLOYER_PRIVATE_KEY ADMIN_PRIVATE_KEY PRIVATE_KEY 2>/dev/null || true
}
trap wipe_keys EXIT

need_cmd forge
need_cmd cast
need_cmd jq

if [[ -z "$TIME_ARENA_ADDRESS" && -n "$REGISTRY_PATH" && -f "$REGISTRY_PATH" ]]; then
  TIME_ARENA_ADDRESS="$(jq -r '.contracts.TimeArena // empty' "$REGISTRY_PATH")"
fi

if [[ -z "$TIME_ARENA_ADDRESS" ]]; then
  echo "TIME_ARENA_ADDRESS is required (--time-arena or --registry with contracts.TimeArena)." >&2
  exit 1
fi
if ! is_address "$TIME_ARENA_ADDRESS"; then
  echo "Invalid TIME_ARENA_ADDRESS: ${TIME_ARENA_ADDRESS}" >&2
  exit 1
fi
if ! is_address "$DEPLOY_ADMIN_ADDRESS"; then
  echo "Invalid DEPLOY_ADMIN_ADDRESS." >&2
  exit 1
fi

echo "=== TimeArenaBuyRouter deploy (MegaETH mainnet) ==="
prompt_secret DEPLOYER_PRIVATE_KEY "Deployer private key (hidden, 0x + 64 hex): "
if [[ "$VERIFY" == true ]]; then
  prompt_secret ETHERSCAN_API_KEY "Etherscan API key (hidden; Enter only with --skip-verify): "
fi
if [[ "$WIRE_ROUTER" == true ]]; then
  prompt_secret ADMIN_PRIVATE_KEY "Admin private key for setTimeArenaBuyRouter (hidden, 0x + 64 hex): "
fi

if [[ ! "$DEPLOYER_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Deployer private key must be 0x-prefixed 32-byte hex." >&2
  exit 1
fi
if [[ "$WIRE_ROUTER" == true && ! "$ADMIN_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Admin private key must be 0x-prefixed 32-byte hex (or use --deploy-only)." >&2
  exit 1
fi
if [[ "$VERIFY" == true && -z "$ETHERSCAN_API_KEY" ]]; then
  echo "ETHERSCAN_API_KEY is required unless --skip-verify is set." >&2
  exit 1
fi

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
if [[ -z "$DOUB_SURPLUS_RECIPIENT_ADDRESS" ]]; then
  DOUB_SURPLUS_RECIPIENT_ADDRESS="$DEPLOYER_ADDRESS"
fi
if [[ "$WIRE_ROUTER" == true ]]; then
  ADMIN_ADDRESS="$(cast wallet address --private-key "$ADMIN_PRIVATE_KEY")"
  if [[ "${ADMIN_ADDRESS,,}" != "${DEPLOY_ADMIN_ADDRESS,,}" ]]; then
    echo "Admin key ${ADMIN_ADDRESS} != DEPLOY_ADMIN_ADDRESS ${DEPLOY_ADMIN_ADDRESS}" >&2
    exit 1
  fi
fi

RPC_CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "RPC chain id ${RPC_CHAIN_ID} != expected ${CHAIN_ID}" >&2
  exit 1
fi

TA_OWNER="$(cast call "$TIME_ARENA_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
if [[ "${TA_OWNER,,}" != "${DEPLOY_ADMIN_ADDRESS,,}" ]]; then
  echo "TimeArena owner ${TA_OWNER} != admin ${DEPLOY_ADMIN_ADDRESS}" >&2
  exit 1
fi

ONCHAIN_ROUTER="$(cast call "$TIME_ARENA_ADDRESS" "timeArenaBuyRouter()(address)" --rpc-url "$RPC_URL")"

cat <<SUMMARY

Network:            ${NETWORK_NAME} (${CHAIN_ID})
RPC:                ${RPC_URL}
Deployer:           ${DEPLOYER_ADDRESS}
Admin (owner):      ${DEPLOY_ADMIN_ADDRESS}
TimeArena:          ${TIME_ARENA_ADDRESS}
Current buy router: ${ONCHAIN_ROUTER}
Kumbaya router:     ${KUMBAYA_SWAP_ROUTER_ADDRESS}
DOUB:               ${DOUB_ADDRESS}
CL8Y:               ${CL8Y_ADDRESS}
doubSurplusRecipient: ${DOUB_SURPLUS_RECIPIENT_ADDRESS}
Verify:             ${VERIFY}
Wire TimeArena:     ${WIRE_ROUTER}

SUMMARY

if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type DEPLOY BUY ROUTER to broadcast: " confirmation
  if [[ "$confirmation" != "DEPLOY BUY ROUTER" ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

mkdir -p "$DEPLOY_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${DEPLOY_DIR}/buy-router-${NETWORK_NAME}-${RUN_ID}.log"

forge_args=(
  script/DeployProductionBuyRouter.s.sol:DeployProductionBuyRouter
  --rpc-url "$RPC_URL"
  --chain "$CHAIN_ID"
  --broadcast
  --slow
  --code-size-limit 524288
  -vvv
)

if [[ "$VERIFY" == true ]]; then
  forge_args+=(
    --verify
    --verifier etherscan
    --verifier-url "$DEFAULT_ETHERSCAN_VERIFIER_URL"
    --etherscan-api-key "$ETHERSCAN_API_KEY"
  )
fi
if [[ "$FORGE_RESUME" == true ]]; then
  forge_args+=(--resume)
fi

(
  export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
  export ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY"
  export TIME_ARENA_ADDRESS="$TIME_ARENA_ADDRESS"
  export DEPLOY_ADMIN_ADDRESS="$DEPLOY_ADMIN_ADDRESS"
  export KUMBAYA_SWAP_ROUTER_ADDRESS="$KUMBAYA_SWAP_ROUTER_ADDRESS"
  export DOUB_ADDRESS="$DOUB_ADDRESS"
  export CL8Y_ADDRESS="$CL8Y_ADDRESS"
  export KUMBAYA_WETH_ADDRESS="$KUMBAYA_WETH_ADDRESS"
  export KUMBAYA_STABLE_TOKEN_ADDRESS="$KUMBAYA_STABLE_TOKEN_ADDRESS"
  export DOUB_SURPLUS_RECIPIENT_ADDRESS="$DOUB_SURPLUS_RECIPIENT_ADDRESS"
  cd "$CONTRACTS_DIR"
  forge build
  forge script "${forge_args[@]}"
) 2>&1 | tee "$LOG_FILE"

RUN_JSON="${CONTRACTS_DIR}/broadcast/DeployProductionBuyRouter.s.sol/${CHAIN_ID}/run-latest.json"
NEW_ROUTER="$(jq -r '
  [.transactions[] | select(.transactionType == "CREATE" and .contractName == "TimeArenaBuyRouter") | .contractAddress] | last // empty
' "$RUN_JSON")"

if [[ -z "$NEW_ROUTER" || "$NEW_ROUTER" == "null" ]]; then
  echo "Could not parse TimeArenaBuyRouter from ${RUN_JSON}" >&2
  exit 1
fi

if [[ "$WIRE_ROUTER" == true ]]; then
  echo
  echo "Wiring TimeArena.setTimeArenaBuyRouter(${NEW_ROUTER}) ..."
  cast send "$TIME_ARENA_ADDRESS" \
    "setTimeArenaBuyRouter(address)" "$NEW_ROUTER" \
    --rpc-url "$RPC_URL" \
    --chain "$CHAIN_ID" \
    --private-key "$ADMIN_PRIVATE_KEY" \
    2>&1 | tee -a "$LOG_FILE"
fi

AFTER_ROUTER="$(cast call "$TIME_ARENA_ADDRESS" "timeArenaBuyRouter()(address)" --rpc-url "$RPC_URL")"

if [[ "$UPDATE_REGISTRY" == true && -n "$REGISTRY_PATH" && -f "$REGISTRY_PATH" ]]; then
  tmp="$(mktemp)"
  jq --arg br "$NEW_ROUTER" '.contracts.TimeArenaBuyRouter = $br' "$REGISTRY_PATH" >"$tmp"
  mv "$tmp" "$REGISTRY_PATH"
  echo "Updated registry: ${REGISTRY_PATH}"
fi

echo
echo "Deploy complete."
echo "  Log:            ${LOG_FILE}"
echo "  Buy router:     ${NEW_ROUTER}"
echo "  Onchain wire:   ${AFTER_ROUTER}"
if [[ "${AFTER_ROUTER,,}" == "${NEW_ROUTER,,}" ]]; then
  echo "  Status:         wired"
else
  echo "  Status:         deploy only — wire manually with admin key"
fi
echo
echo "Indexer:"
echo "  INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
echo "  (patch ADDRESS_REGISTRY JSON contracts.TimeArenaBuyRouter=${NEW_ROUTER})"
echo
echo "Frontend:"
echo "  VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER=${NEW_ROUTER}"
echo
echo "Explorer:"
echo "  https://mega.etherscan.io/address/${NEW_ROUTER}"

wipe_keys
trap - EXIT
