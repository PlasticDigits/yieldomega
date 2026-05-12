#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Contracts-only production deployment wrapper for MegaETH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_DEPLOY_ADMIN_ADDRESS="0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
VERIFY=true
ASSUME_YES=false
SALE_START_EPOCH="${SALE_START_EPOCH:-}"
RESERVE_ASSET_ADDRESS="${RESERVE_ASSET_ADDRESS:-}"
DEPLOY_ADMIN_ADDRESS="${DEPLOY_ADMIN_ADDRESS:-$DEFAULT_DEPLOY_ADMIN_ADDRESS}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-megaeth-contracts.sh [SALE_START_EPOCH] [options]

Quickstart:
  scripts/deploy-megaeth-contracts.sh

  # optional explicit epoch (else 1778760000 = 2026-05-14 12:00:00 UTC):
  scripts/deploy-megaeth-contracts.sh 1778760000

Defaults:
  RPC_URL=https://mainnet.megaeth.com/rpc
  CHAIN_ID=4326
  NETWORK_NAME=megaeth_mainnet
  DEPLOY_ADMIN_ADDRESS=0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c
  SALE_START_EPOCH=1778760000 when omitted (env, positional, and prompt)

Options:
  --rpc-url URL              Override target RPC_URL.
  --chain-id ID              Override target CHAIN_ID.
  --network NAME             Registry network label.
  --reserve-asset ADDRESS    CL8Y/reserve ERC-20 address.
  --admin ADDRESS            Final admin / owner address. Defaults to CL8Y manager.
  --skip-verify              Broadcast without explorer verification.
  -y, --yes                  Skip the final typed confirmation.
  -h, --help                 Show this help.

Optional environment:
  SALE_START_EPOCH (defaults to 1778760000 = 2026-05-14 12:00:00 UTC),
  TOTAL_TOKENS_FOR_SALE_WAD, TIMECURVE_BUY_COOLDOWN_SEC,
  REFERRAL_REGISTRATION_BURN_WAD, CHARM_PRICE_BASE_WAD,
  CHARM_PRICE_DAILY_INCREMENT_WAD, KUMBAYA_SWAP_ROUTER_ADDRESS,
  KUMBAYA_WETH_ADDRESS, KUMBAYA_STABLE_TOKEN_ADDRESS,
  CL8Y_PROTOCOL_TREASURY_ADDRESS, RABBIT_FEE_SINK_ADDRESS,
  PRESALE_BENEFICIARIES, PRESALE_AMOUNTS_WAD,
  PRESALE_TOTAL_ALLOCATION_WAD, START_PRESALE_VESTING,
  ENABLE_PRESALE_CLAIMS, LEPRECHAUN_BASE_URI.
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
    --skip-verify)
      VERIFY=false
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
      if [[ -n "$SALE_START_EPOCH" ]]; then
        echo "Unexpected positional argument: $1" >&2
        usage
        exit 1
      fi
      SALE_START_EPOCH="$1"
      shift
      ;;
  esac
done

# Default: 2026-05-14 12:00:00 UTC (TimeCurve `startSaleAt` anchor when unset — GitLab #114).
SALE_START_EPOCH="${SALE_START_EPOCH:-1778760000}"

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

prompt_secret PRIVATE_KEY "Private key (hidden, 0x-prefixed): "
prompt_secret ETHERSCAN_API_KEY "Etherscan API key (hidden; press Enter only if using --skip-verify): "
prompt_value SALE_START_EPOCH "Sale start epoch seconds: "
prompt_value RESERVE_ASSET_ADDRESS "CL8Y / reserve ERC-20 address: "

if [[ ! "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "PRIVATE_KEY must be a 0x-prefixed 32-byte hex key." >&2
  exit 1
fi
if [[ ! "$SALE_START_EPOCH" =~ ^[0-9]+$ ]] || [[ "$SALE_START_EPOCH" == "0" ]]; then
  echo "SALE_START_EPOCH must be a non-zero base-10 Unix timestamp." >&2
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

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY")"
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

LATEST_BLOCK_JSON="$(cast block latest --rpc-url "$RPC_URL" --json)"
LATEST_TIMESTAMP="$(jq -r '.timestamp' <<<"$LATEST_BLOCK_JSON")"
if [[ "$LATEST_TIMESTAMP" == 0x* ]]; then
  LATEST_TIMESTAMP="$(python3 - "$LATEST_TIMESTAMP" <<'PY'
import sys
print(int(sys.argv[1], 16))
PY
)"
fi
if (( SALE_START_EPOCH < LATEST_TIMESTAMP )); then
  echo "SALE_START_EPOCH is in the past for the target chain: latest=${LATEST_TIMESTAMP}, requested=${SALE_START_EPOCH}." >&2
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

YieldOmega contracts deployment
  Network:       ${NETWORK_NAME}
  RPC_URL:       ${RPC_URL}
  CHAIN_ID:      ${CHAIN_ID}
  Deployer:      ${DEPLOYER_ADDRESS}
  Final admin:   ${DEPLOY_ADMIN_ADDRESS}
  Reserve asset: ${RESERVE_ASSET_ADDRESS}
  Sale start:    ${SALE_START_EPOCH}
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

export PRIVATE_KEY
export ETHERSCAN_API_KEY
export SALE_START_EPOCH
export RESERVE_ASSET_ADDRESS
export DEPLOY_ADMIN_ADDRESS

cd "$CONTRACTS_DIR"
forge build

forge_args=(
  script/DeployProduction.s.sol:DeployProduction
  --rpc-url "$RPC_URL"
  --chain "$CHAIN_ID"
  --broadcast
  --slow
  -vvv
)

if [[ "$VERIFY" == true ]]; then
  forge_args+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi
if [[ "${YIELDOMEGA_SKIP_SIMULATION:-0}" =~ ^(1|true|yes)$ ]]; then
  forge_args+=(--skip-simulation)
fi

forge script "${forge_args[@]}" 2>&1 | tee "$LOG_FILE"

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
if [[ ! "$DEPLOY_BLOCK" =~ ^[0-9]+$ ]] || [[ "$DEPLOY_BLOCK" == "0" ]]; then
  echo "Invalid deploy block parsed from ${RUN_JSON}: ${DEPLOY_BLOCK}" >&2
  exit 1
fi

extract_addr() {
  local label="$1"
  awk -v label="$label" '
    $0 ~ "^[[:space:]]*" label ":" {
      for (i = 1; i <= NF; ++i) {
        if ($i ~ /^0x[0-9a-fA-F]{40}$/) value = $i
      }
    }
    END { print value }
  ' "$LOG_FILE"
}

zero_to_empty() {
  if [[ "${1:-}" == "0x0000000000000000000000000000000000000000" ]]; then
    echo ""
  else
    echo "${1:-}"
  fi
}

DOUB="$(extract_addr Doubloon)"
PODIUM="$(extract_addr PodiumPool)"
SALE_BURN="$(extract_addr SaleCl8yBurnSink)"
DOUB_LP="$(extract_addr DoubLPIncentives)"
ECO="$(extract_addr EcosystemTreasury)"
RT_VAULT="$(zero_to_empty "$(extract_addr RabbitTreasuryVault)")"
RABBIT_FEE_SINK="$(extract_addr RabbitFeeSink)"
RT="$(extract_addr RabbitTreasury)"
FEE_ROUTER="$(extract_addr FeeRouter)"
REFERRAL="$(extract_addr ReferralRegistry)"
CHARM_PRICE="$(extract_addr LinearCharmPrice)"
TC="$(extract_addr TimeCurve)"
DPV="$(zero_to_empty "$(extract_addr DoubPresaleVesting)")"
BUY_ROUTER="$(zero_to_empty "$(extract_addr TimeCurveBuyRouter)")"
NFT="$(extract_addr LeprechaunNFT)"

for required in DOUB PODIUM SALE_BURN DOUB_LP ECO RABBIT_FEE_SINK RT FEE_ROUTER REFERRAL CHARM_PRICE TC NFT; do
  if [[ -z "${!required:-}" ]]; then
    echo "Could not parse ${required} from deploy log: ${LOG_FILE}" >&2
    exit 1
  fi
done

ABI_HASH_TMP="$(mktemp)"
"$CONTRACTS_DIR/script/export_abi_hashes.sh" > "$ABI_HASH_TMP"

jq -n \
  --argjson chainId "$CHAIN_ID" \
  --arg network "$NETWORK_NAME" \
  --arg reserve "$RESERVE_ASSET_ADDRESS" \
  --arg doub "$DOUB" \
  --arg podium "$PODIUM" \
  --arg saleBurn "$SALE_BURN" \
  --arg doubLp "$DOUB_LP" \
  --arg eco "$ECO" \
  --arg rtVault "$RT_VAULT" \
  --arg rabbitFeeSink "$RABBIT_FEE_SINK" \
  --arg rt "$RT" \
  --arg feeRouter "$FEE_ROUTER" \
  --arg referral "$REFERRAL" \
  --arg charmPrice "$CHARM_PRICE" \
  --arg tc "$TC" \
  --arg buyRouter "$BUY_ROUTER" \
  --arg nft "$NFT" \
  --arg dpv "$DPV" \
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
      PodiumPool: $podium,
      CL8YProtocolTreasury: $saleBurn,
      DoubLPIncentives: $doubLp,
      EcosystemTreasury: $eco,
      RabbitTreasuryVault: $rtVault,
      RabbitFeeSink: $rabbitFeeSink,
      RabbitTreasury: $rt,
      FeeRouter: $feeRouter,
      TimeCurve: $tc,
      TimeCurveBuyRouter: $buyRouter,
      LeprechaunNFT: $nft,
      LaunchedToken: $doub,
      ReferralRegistry: $referral,
      DoubPresaleVesting: $dpv,
      LinearCharmPrice: $charmPrice
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
echo
echo "Frontend env:"
echo "  VITE_CHAIN_ID=${CHAIN_ID}"
echo "  VITE_RPC_URL=${RPC_URL}"
echo "  VITE_TIMECURVE_ADDRESS=${TC}"
echo "  VITE_RABBIT_TREASURY_ADDRESS=${RT}"
echo "  VITE_LEPRECHAUN_NFT_ADDRESS=${NFT}"
echo "  VITE_REFERRAL_REGISTRY_ADDRESS=${REFERRAL}"
echo "  VITE_FEE_ROUTER_ADDRESS=${FEE_ROUTER}"
if [[ -n "$DPV" ]]; then
  echo "  VITE_DOUB_PRESALE_VESTING_ADDRESS=${DPV}"
fi
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=${BUY_ROUTER}"
fi
