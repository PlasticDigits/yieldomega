#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Deploy + wire a fixed TimeCurveBuyRouter on MegaETH mainnet (Kumbaya IV3SwapRouter ABI).
set -euo pipefail

unset -v PRIVATE_KEY ADMIN_PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_DEPLOY_ADMIN_ADDRESS="0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c"
DEFAULT_TIMECURVE="0x1B68bb6789baEBa4bD28F53C10b52DBe1eF2bF71"
DEFAULT_LEGACY_BUY_ROUTER="0xB09542acae355C5Ea42345522D403c1742C75B61"
DEFAULT_KUMBAYA_SWAP_ROUTER="0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e"
DEFAULT_KUMBAYA_WETH="0x4200000000000000000000000000000000000006"
DEFAULT_KUMBAYA_STABLE="0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
DEFAULT_ETHERSCAN_VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=4326"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
TIMECURVE_ADDRESS="${TIMECURVE_ADDRESS:-$DEFAULT_TIMECURVE}"
LEGACY_BUY_ROUTER_ADDRESS="${LEGACY_BUY_ROUTER_ADDRESS:-$DEFAULT_LEGACY_BUY_ROUTER}"
DEPLOY_ADMIN_ADDRESS="${DEPLOY_ADMIN_ADDRESS:-$DEFAULT_DEPLOY_ADMIN_ADDRESS}"
KUMBAYA_SWAP_ROUTER_ADDRESS="${KUMBAYA_SWAP_ROUTER_ADDRESS:-$DEFAULT_KUMBAYA_SWAP_ROUTER}"
KUMBAYA_WETH_ADDRESS="${KUMBAYA_WETH_ADDRESS:-$DEFAULT_KUMBAYA_WETH}"
KUMBAYA_STABLE_TOKEN_ADDRESS="${KUMBAYA_STABLE_TOKEN_ADDRESS:-$DEFAULT_KUMBAYA_STABLE}"
VERIFY=true
WIRE_ROUTER=true
ASSUME_YES=false
DEPLOYER_PRIVATE_KEY=""
ADMIN_PRIVATE_KEY=""
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/upgrade-timecurve-buy-router.sh [options]

Deploys a new TimeCurveBuyRouter (IV3 Kumbaya swap ABI) and wires it on TimeCurve.

Defaults (MegaETH 4326):
  RPC_URL=https://mainnet.megaeth.com/rpc
  TIMECURVE_ADDRESS=0x1B68bb6789baEBa4bD28F53C10b52DBe1eF2bF71
  LEGACY_BUY_ROUTER_ADDRESS=0xB09542acae355C5Ea42345522D403c1742C75B61
  DEPLOY_ADMIN_ADDRESS=0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c
  Kumbaya router / WETH / USDm = production integrator-kit addresses

Options:
  --rpc-url URL
  --chain-id ID
  --timecurve ADDRESS
  --legacy-router ADDRESS     Read immutables when KUMBAYA_* / treasury unset
  --admin ADDRESS             TimeCurve owner + new router Ownable owner
  --skip-verify
  --deploy-only               Deploy router only; do not call setTimeCurveBuyRouter
  -y, --yes                   Skip typed confirmation
  -h, --help

Interactive prompts (hidden where noted):
  1. Deployer private key (must match 0xD5f3EFF25cAa075F1F33dbF9ca6883c741d408A2 for your ops)
  2. Etherscan API key (unless --skip-verify)
  3. Admin private key (TimeCurve owner; must match --admin) unless --deploy-only

After success, update:
  - README TimeCurveBuyRouter row
  - VITE_KUMBAYA_TIMECURVE_BUY_ROUTER in frontend production env
  - indexer ADDRESS_REGISTRY TimeCurveBuyRouter (if used)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) RPC_URL="${2:?}"; shift 2 ;;
    --chain-id) CHAIN_ID="${2:?}"; shift 2 ;;
    --timecurve) TIMECURVE_ADDRESS="${2:?}"; shift 2 ;;
    --legacy-router) LEGACY_BUY_ROUTER_ADDRESS="${2:?}"; shift 2 ;;
    --admin) DEPLOY_ADMIN_ADDRESS="${2:?}"; shift 2 ;;
    --skip-verify) VERIFY=false; shift ;;
    --deploy-only) WIRE_ROUTER=false; shift ;;
    -y|--yes) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }
is_address() { [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]; }

prompt_secret() {
  local var_name="$1" prompt="$2"
  local current="${!var_name:-}"
  if [[ -z "$current" ]]; then
    read -r -s -p "$prompt" current
    echo
    printf -v "$var_name" '%s' "$current"
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

echo "=== TimeCurveBuyRouter upgrade (Kumbaya IV3 ABI fix) ==="
prompt_secret DEPLOYER_PRIVATE_KEY "Deployer private key (hidden, 0x + 64 hex): "
if [[ "$VERIFY" == true ]]; then
  prompt_secret ETHERSCAN_API_KEY "Etherscan API key (hidden): "
fi
if [[ "$WIRE_ROUTER" == true ]]; then
  prompt_secret ADMIN_PRIVATE_KEY "Admin private key for setTimeCurveBuyRouter (hidden, 0x + 64 hex): "
fi

if [[ ! "$DEPLOYER_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Deployer key must be 0x-prefixed 32-byte hex." >&2
  exit 1
fi
if [[ "$WIRE_ROUTER" == true && ! "$ADMIN_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Admin key must be 0x-prefixed 32-byte hex (or use --deploy-only)." >&2
  exit 1
fi
if [[ "$VERIFY" == true && -z "$ETHERSCAN_API_KEY" ]]; then
  echo "ETHERSCAN_API_KEY required unless --skip-verify." >&2
  exit 1
fi

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
ADMIN_ADDRESS="$(cast wallet address --private-key "$ADMIN_PRIVATE_KEY" 2>/dev/null || true)"
if [[ "$WIRE_ROUTER" == true ]]; then
  ADMIN_ADDRESS="$(cast wallet address --private-key "$ADMIN_PRIVATE_KEY")"
fi

if ! is_address "$DEPLOY_ADMIN_ADDRESS"; then
  echo "Invalid DEPLOY_ADMIN_ADDRESS." >&2
  exit 1
fi
if [[ "$WIRE_ROUTER" == true && "${ADMIN_ADDRESS,,}" != "${DEPLOY_ADMIN_ADDRESS,,}" ]]; then
  echo "Admin key address ${ADMIN_ADDRESS} != DEPLOY_ADMIN_ADDRESS ${DEPLOY_ADMIN_ADDRESS}" >&2
  exit 1
fi

RPC_CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "RPC chain id ${RPC_CHAIN_ID} != expected ${CHAIN_ID}" >&2
  exit 1
fi

TC_OWNER="$(cast call "$TIMECURVE_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
if [[ "${TC_OWNER,,}" != "${DEPLOY_ADMIN_ADDRESS,,}" ]]; then
  echo "TimeCurve owner ${TC_OWNER} != admin ${DEPLOY_ADMIN_ADDRESS}" >&2
  exit 1
fi

ONCHAIN_ROUTER="$(cast call "$TIMECURVE_ADDRESS" "timeCurveBuyRouter()(address)" --rpc-url "$RPC_URL")"
CL8Y_TREASURY="$(cast call "$LEGACY_BUY_ROUTER_ADDRESS" "cl8yProtocolTreasury()(address)" --rpc-url "$RPC_URL")"

cat <<SUMMARY

Network:          ${NETWORK_NAME} (${CHAIN_ID})
RPC:              ${RPC_URL}
Deployer:         ${DEPLOYER_ADDRESS}
Admin (owner):    ${DEPLOY_ADMIN_ADDRESS}
TimeCurve:        ${TIMECURVE_ADDRESS}
Current router:   ${ONCHAIN_ROUTER}
Legacy router:    ${LEGACY_BUY_ROUTER_ADDRESS}
Kumbaya router:   ${KUMBAYA_SWAP_ROUTER_ADDRESS}
WETH:             ${KUMBAYA_WETH_ADDRESS}
Stable:           ${KUMBAYA_STABLE_TOKEN_ADDRESS}
CL8Y treasury:    ${CL8Y_TREASURY}
Verify:           ${VERIFY}
Wire on TimeCurve: ${WIRE_ROUTER}

SUMMARY

if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type UPGRADE BUY ROUTER to broadcast: " confirmation
  if [[ "$confirmation" != "UPGRADE BUY ROUTER" ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

mkdir -p "$DEPLOY_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${DEPLOY_DIR}/upgrade-buy-router-${NETWORK_NAME}-${RUN_ID}.log"

forge_args=(
  script/DeployUpgradeTimeCurveBuyRouter.s.sol:DeployUpgradeTimeCurveBuyRouter
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

(
  export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
  export ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY"
  export TIMECURVE_ADDRESS="$TIMECURVE_ADDRESS"
  export LEGACY_BUY_ROUTER_ADDRESS="$LEGACY_BUY_ROUTER_ADDRESS"
  export DEPLOY_ADMIN_ADDRESS="$DEPLOY_ADMIN_ADDRESS"
  export KUMBAYA_SWAP_ROUTER_ADDRESS="$KUMBAYA_SWAP_ROUTER_ADDRESS"
  export KUMBAYA_WETH_ADDRESS="$KUMBAYA_WETH_ADDRESS"
  export KUMBAYA_STABLE_TOKEN_ADDRESS="$KUMBAYA_STABLE_TOKEN_ADDRESS"
  export CL8Y_PROTOCOL_TREASURY_ADDRESS="$CL8Y_TREASURY"
  cd "$CONTRACTS_DIR"
  forge build
  forge script "${forge_args[@]}"
) 2>&1 | tee "$LOG_FILE"

RUN_JSON="${CONTRACTS_DIR}/broadcast/DeployUpgradeTimeCurveBuyRouter.s.sol/${CHAIN_ID}/run-latest.json"
NEW_ROUTER="$(jq -r '
  [.transactions[] | select(.transactionType == "CREATE" and .contractName == "TimeCurveBuyRouter") | .contractAddress] | last // empty
' "$RUN_JSON")"

if [[ -z "$NEW_ROUTER" || "$NEW_ROUTER" == "null" ]]; then
  echo "Could not parse new TimeCurveBuyRouter from ${RUN_JSON}" >&2
  exit 1
fi

if [[ "$WIRE_ROUTER" == true ]]; then
  echo
  echo "Wiring TimeCurve.setTimeCurveBuyRouter(${NEW_ROUTER}) ..."
  cast send "$TIMECURVE_ADDRESS" \
    "setTimeCurveBuyRouter(address)" "$NEW_ROUTER" \
    --rpc-url "$RPC_URL" \
    --chain "$CHAIN_ID" \
    --private-key "$ADMIN_PRIVATE_KEY" \
    2>&1 | tee -a "$LOG_FILE" || {
    echo "cast send failed; wire manually with admin key." >&2
    exit 1
  }
fi

AFTER_ROUTER="$(cast call "$TIMECURVE_ADDRESS" "timeCurveBuyRouter()(address)" --rpc-url "$RPC_URL")"

echo
echo "Upgrade complete."
echo "  Log:           ${LOG_FILE}"
echo "  New router:    ${NEW_ROUTER}"
echo "  Onchain wire:  ${AFTER_ROUTER}"
if [[ "${AFTER_ROUTER,,}" == "${NEW_ROUTER,,}" ]]; then
  echo "  Status:        wired"
else
  echo "  Status:        deploy only — wire manually with admin key"
fi
echo
echo "Frontend:"
echo "  VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=${NEW_ROUTER}"
echo "Explorer:"
echo "  https://mega.etherscan.io/address/${NEW_ROUTER}"

wipe_keys
trap - EXIT
