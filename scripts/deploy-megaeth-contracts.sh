#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Contracts-only production deployment wrapper for MegaETH (Arena v2 — GitLab #259).
set -euo pipefail

# Deployer key: never read from the environment (avoids leaking via `export` / dotfiles).
unset -v PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_DEPLOY_ADMIN_ADDRESS="0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c"
# Canonical CL8Y (referral registration burn asset) on MegaETH mainnet.
DEFAULT_MEGAETH_MAINNET_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
# Arena v2 defaults — match DeployProduction.s.sol / DeployDev.s.sol.
# Leave unset on mainnet to use Kumbaya TWAP in DeployProduction (#303). Dev rehearsal may set explicitly.
DEFAULT_ARENA_CHARM_PRICE_WAD=""
DEFAULT_ARENA_TIMER_EXTENSION_SEC="120"
DEFAULT_ARENA_INITIAL_TIMER_SEC="86400"
DEFAULT_ARENA_TIMER_CAP_SEC="345600"
DEFAULT_ARENA_BUY_COOLDOWN_SEC="300"
DEFAULT_REFERRAL_REGISTRATION_BURN_WAD="1000000000000000000"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
VERIFY=true
ASSUME_YES=false
FORGE_RESUME=false
RESERVE_ASSET_ADDRESS="${RESERVE_ASSET_ADDRESS:-}"
DEPLOY_ADMIN_ADDRESS="${DEPLOY_ADMIN_ADDRESS:-$DEFAULT_DEPLOY_ADMIN_ADDRESS}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"
START_ARENA="${START_ARENA:-0}"
DEPLOYER_PRIVATE_KEY=""

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-megaeth-contracts.sh [options]

Quickstart:
  scripts/deploy-megaeth-contracts.sh

Defaults:
  RPC_URL=https://mainnet.megaeth.com/rpc
  CHAIN_ID=4326
  NETWORK_NAME=megaeth_mainnet
  DEPLOY_ADMIN_ADDRESS=0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c
  RESERVE_ASSET_ADDRESS=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D when CHAIN_ID=4326 and unset
  ARENA_* timer/charm/cooldown params — see DeployProduction.s.sol
  START_ARENA=0 (owner must call TimeArena.startArena(); set 1 to start in-script)

Options:
  --rpc-url URL              Override target RPC_URL.
  --chain-id ID              Override target CHAIN_ID.
  --network NAME             Registry network label.
  --reserve-asset ADDRESS    CL8Y/reserve ERC-20 address.
  --admin ADDRESS            Final admin / owner address. Defaults to CL8Y manager.
  --start-arena              Call TimeArena.startArena() during deploy (START_ARENA=1).
  --skip-verify              Broadcast without explorer verification.
  --resume                   Resume a partial DeployProduction broadcast.
  -y, --yes                  Skip the final typed confirmation.
  -h, --help                 Show this help.

Security:
  The deployer private key is always requested as a hidden terminal prompt (like a password).

Optional environment:
  RESERVE_ASSET_ADDRESS, DEPLOY_ADMIN_ADDRESS, START_ARENA,
  ARENA_CHARM_PRICE_WAD, ARENA_TIMER_EXTENSION_SEC, ARENA_INITIAL_TIMER_SEC,
  ARENA_TIMER_CAP_SEC, ARENA_BUY_COOLDOWN_SEC, REFERRAL_REGISTRATION_BURN_WAD.

Partial broadcast: re-run with --resume (same RPC / CHAIN_ID / env as the failed run).

Registry JSON only (no forge script):
  scripts/write-production-registry-from-broadcast.sh
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url)
      RPC_URL="${2:?missing value for --rpc-url}"
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
    --reserve-asset)
      RESERVE_ASSET_ADDRESS="${2:?missing value for --reserve-asset}"
      shift 2
      ;;
    --admin)
      DEPLOY_ADMIN_ADDRESS="${2:?missing value for --admin}"
      shift 2
      ;;
    --start-arena)
      START_ARENA=1
      shift
      ;;
    --skip-verify)
      VERIFY=false
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
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      echo "Unexpected positional argument: $1 (Arena v2 deploy takes no positional args)" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RESERVE_ASSET_ADDRESS" && "$CHAIN_ID" == "4326" ]]; then
  RESERVE_ASSET_ADDRESS="$DEFAULT_MEGAETH_MAINNET_CL8Y"
fi

# Only export override when operator set ARENA_CHARM_PRICE_WAD (non-empty). Unset → TWAP on chain 4326.
if [[ -n "${ARENA_CHARM_PRICE_WAD:-}" ]]; then
  export ARENA_CHARM_PRICE_WAD
fi
ARENA_TIMER_EXTENSION_SEC="${ARENA_TIMER_EXTENSION_SEC:-$DEFAULT_ARENA_TIMER_EXTENSION_SEC}"
ARENA_INITIAL_TIMER_SEC="${ARENA_INITIAL_TIMER_SEC:-$DEFAULT_ARENA_INITIAL_TIMER_SEC}"
ARENA_TIMER_CAP_SEC="${ARENA_TIMER_CAP_SEC:-$DEFAULT_ARENA_TIMER_CAP_SEC}"
ARENA_BUY_COOLDOWN_SEC="${ARENA_BUY_COOLDOWN_SEC:-$DEFAULT_ARENA_BUY_COOLDOWN_SEC}"
REFERRAL_REGISTRATION_BURN_WAD="${REFERRAL_REGISTRATION_BURN_WAD:-$DEFAULT_REFERRAL_REGISTRATION_BURN_WAD}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
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

prompt_value() {
  local var_name="$1"
  local prompt="$2"
  local current="${!var_name:-}"
  if [[ -z "$current" ]]; then
    read -r -p "$prompt" current
    export "$var_name=$current"
  fi
}

is_address() {
  [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]
}

need_cmd forge
need_cmd cast
need_cmd jq
need_cmd python3
need_cmd git

read_deployer_private_key() {
  read -r -s -p "Deployer private key (hidden, 0x + 64 hex): " DEPLOYER_PRIVATE_KEY
  echo
}

read_deployer_private_key
prompt_secret ETHERSCAN_API_KEY "Etherscan API key (hidden; press Enter only if using --skip-verify): "
prompt_value RESERVE_ASSET_ADDRESS "CL8Y / reserve ERC-20 address: "

wipe_deployer_key() {
  DEPLOYER_PRIVATE_KEY=""
  unset -v DEPLOYER_PRIVATE_KEY PRIVATE_KEY 2>/dev/null || true
}
trap wipe_deployer_key EXIT

if [[ ! "$DEPLOYER_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Deployer private key must be a 0x-prefixed 32-byte hex key." >&2
  exit 1
fi
if ! is_address "$RESERVE_ASSET_ADDRESS"; then
  echo "RESERVE_ASSET_ADDRESS must be a 0x + 40 hex address." >&2
  exit 1
fi
if [[ "$VERIFY" == true && -z "$ETHERSCAN_API_KEY" ]]; then
  echo "ETHERSCAN_API_KEY is required unless --skip-verify is set." >&2
  exit 1
fi

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
if [[ -z "$DEPLOY_ADMIN_ADDRESS" ]]; then
  DEPLOY_ADMIN_ADDRESS="$DEFAULT_DEPLOY_ADMIN_ADDRESS"
fi
if ! is_address "$DEPLOY_ADMIN_ADDRESS"; then
  echo "DEPLOY_ADMIN_ADDRESS must be a 0x + 40 hex address." >&2
  exit 1
fi
if [[ ! "$CHAIN_ID" =~ ^[0-9]+$ ]] || [[ "$CHAIN_ID" == "0" ]]; then
  echo "CHAIN_ID must be a non-zero base-10 integer." >&2
  exit 1
fi

RPC_CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "RPC chain id mismatch: RPC returned ${RPC_CHAIN_ID}, expected ${CHAIN_ID}." >&2
  exit 1
fi

DEPLOYER_BALANCE_WEI="$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL")"
if [[ "$DEPLOYER_BALANCE_WEI" == "0" ]]; then
  echo "Deployer has zero native balance on ${NETWORK_NAME} (${CHAIN_ID})." >&2
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${DEPLOY_DIR}/yieldomega-${NETWORK_NAME}-${RUN_ID}.log"
REGISTRY_FILE="${DEPLOY_DIR}/yieldomega-${NETWORK_NAME}-${RUN_ID}.json"
PRECHECK_BLOCK="$(cast block-number --rpc-url "$RPC_URL")"
GIT_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"

cat <<SUMMARY

YieldOmega Arena v2 contracts deployment
  Network:       ${NETWORK_NAME}
  RPC_URL:       ${RPC_URL}
  CHAIN_ID:      ${CHAIN_ID}
  Deployer:      ${DEPLOYER_ADDRESS}
  Final admin:   ${DEPLOY_ADMIN_ADDRESS}
  Reserve asset: ${RESERVE_ASSET_ADDRESS}
  Charm price:   ${ARENA_CHARM_PRICE_WAD:-Kumbaya TWAP (Sir 15m, #303)}
  Buy cooldown:  ${ARENA_BUY_COOLDOWN_SEC} s
  Start arena:   ${START_ARENA}
  Precheck block:${PRECHECK_BLOCK}
  Verify:        ${VERIFY}
  Log:           ${LOG_FILE}
  Registry:      ${REGISTRY_FILE}

SUMMARY

if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type DEPLOY YIELDOMEGA to broadcast: " confirmation
  if [[ "$confirmation" != "DEPLOY YIELDOMEGA" ]]; then
    echo "Deployment cancelled."
    exit 1
  fi
fi

forge_args=(
  script/DeployProduction.s.sol:DeployProduction
  --rpc-url "$RPC_URL"
  --chain "$CHAIN_ID"
  --broadcast
  --slow
  --code-size-limit 524288
  -vvv
)

if [[ "$VERIFY" == true ]]; then
  forge_args+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi
if [[ "${YIELDOMEGA_SKIP_SIMULATION:-0}" =~ ^(1|true|yes)$ ]]; then
  forge_args+=(--skip-simulation)
fi
if [[ "$FORGE_RESUME" == true ]]; then
  forge_args+=(--resume)
fi

(
  export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
  export ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY"
  export RESERVE_ASSET_ADDRESS="$RESERVE_ASSET_ADDRESS"
  export DEPLOY_ADMIN_ADDRESS="$DEPLOY_ADMIN_ADDRESS"
  export START_ARENA="$START_ARENA"
  if [[ -n "${ARENA_CHARM_PRICE_WAD:-}" ]]; then
    export ARENA_CHARM_PRICE_WAD="$ARENA_CHARM_PRICE_WAD"
  else
    unset -v ARENA_CHARM_PRICE_WAD 2>/dev/null || true
  fi
  export ARENA_TIMER_EXTENSION_SEC="$ARENA_TIMER_EXTENSION_SEC"
  export ARENA_INITIAL_TIMER_SEC="$ARENA_INITIAL_TIMER_SEC"
  export ARENA_TIMER_CAP_SEC="$ARENA_TIMER_CAP_SEC"
  export ARENA_BUY_COOLDOWN_SEC="$ARENA_BUY_COOLDOWN_SEC"
  export REFERRAL_REGISTRATION_BURN_WAD="$REFERRAL_REGISTRATION_BURN_WAD"
  cd "$CONTRACTS_DIR"
  forge build
  forge script "${forge_args[@]}"
) 2>&1 | tee "$LOG_FILE"

wipe_deployer_key
trap - EXIT

RUN_JSON="${CONTRACTS_DIR}/broadcast/DeployProduction.s.sol/${CHAIN_ID}/run-latest.json"
if [[ ! -f "$RUN_JSON" ]]; then
  echo "Broadcast artifact not found: ${RUN_JSON}" >&2
  exit 1
fi

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

ABI_HASH_TMP="$(mktemp)"
"$CONTRACTS_DIR/script/export_abi_hashes.sh" > "$ABI_HASH_TMP"

jq -n \
  --argjson chainId "$CHAIN_ID" \
  --arg network "$NETWORK_NAME" \
  --arg reserve "$RESERVE_ASSET_ADDRESS" \
  --arg doub "$DOUB" \
  --arg cred "$CRED" \
  --arg pv "$PV" \
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
      ReferralRegistry: $rr,
      TimeArena: $ta,
      TimeArenaBuyRouter: $buyRouter,
      LaunchedToken: $doub
    },
    deployer: $deployer,
    deployBlock: $deployBlock,
    gitCommit: $gitCommit
  }' > "$REGISTRY_FILE"
rm -f "$ABI_HASH_TMP"

echo
echo "Deployment complete."
echo "Registry: ${REGISTRY_FILE}"
echo "Log:      ${LOG_FILE}"
echo
echo "Indexer env:"
echo "  CHAIN_ID=${CHAIN_ID}"
echo "  RPC_URL=${RPC_URL}"
echo "  START_BLOCK=${DEPLOY_BLOCK}"
echo "  ADDRESS_REGISTRY_PATH=${REGISTRY_FILE}"
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
fi
echo
echo "Frontend env:"
echo "  VITE_CHAIN_ID=${CHAIN_ID}"
echo "  VITE_RPC_URL=${RPC_URL}"
echo "  VITE_TIME_ARENA_ADDRESS=${TA}"
echo "  VITE_PODIUM_VAULTS_ADDRESS=${PV}"
echo "  VITE_REFERRAL_REGISTRY_ADDRESS=${RR}"
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER=${BUY_ROUTER}"
fi
if [[ "$START_ARENA" != "1" ]]; then
  echo
  echo "Note: START_ARENA was 0 — owner must call TimeArena.startArena() before buys."
fi
