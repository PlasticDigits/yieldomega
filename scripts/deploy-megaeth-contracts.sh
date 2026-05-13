#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Contracts-only production deployment wrapper for MegaETH.
set -euo pipefail

# Deployer key: never read from the environment (avoids leaking via `export` / dotfiles).
# The script keeps it in a shell variable and passes it only to the Forge child process.
unset -v PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_DEPLOY_ADMIN_ADDRESS="0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c"
# Canonical CL8Y (TimeCurve / Rabbit / referral reserve) on MegaETH mainnet — override for other chains or test doubles.
DEFAULT_MEGAETH_MAINNET_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
# Kumbaya mainnet routing for ETH / USDm → CL8Y TimeCurve entry. These mirror
# frontend/src/lib/kumbayaRoutes.ts and docs/integrations/kumbaya.md.
DEFAULT_MEGAETH_MAINNET_KUMBAYA_SWAP_ROUTER="0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_WETH="0x4200000000000000000000000000000000000006"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_STABLE="0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_QUOTER="0x1F1a8dC7E138C34b503Ca080962aC10B75384a27"
# Canonical TimeCurve +15% CHARM presale wallets (MegaETH 4326). First wallet may differ from vesting DOUB recipient — see DEFAULT_MEGAETH_MAINNET_PRESALE_BENEFICIARIES.
DEFAULT_MEGAETH_MAINNET_PRESALE_CHARM_BOOST_ADDRESSES="0xA5F424182E8E94c328EC6441ebf508e1cb48f8bA,0x7fb70BC1d5D30945f64a91B4a9C84792dfA9403b,0x45999a8Dd96b4df3AadBC395669b2b0928a7aF17,0x6186290B28D511bFF971631c916244A9fC539cfE,0x212D17402321BD15D092A3444766649d00c5A9F4"
# Canonical DoubPresaleVesting allocation wallets (4326): first tranche (10M DOUB) to delegate wallet; others match CHARM boost list.
DEFAULT_MEGAETH_MAINNET_PRESALE_BENEFICIARIES="0x0965a4Ce0e6eDDd87eA8F6cF73a8462b8B47fc7D,0x7fb70BC1d5D30945f64a91B4a9C84792dfA9403b,0x45999a8Dd96b4df3AadBC395669b2b0928a7aF17,0x6186290B28D511bFF971631c916244A9fC539cfE,0x212D17402321BD15D092A3444766649d00c5A9F4"
DEFAULT_MEGAETH_MAINNET_PRESALE_AMOUNTS_WAD="10000000000000000000000000,4000000000000000000000000,5000000000000000000000000,2000000000000000000000000,500000000000000000000000"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
VERIFY=true
ASSUME_YES=false
SALE_START_EPOCH="${SALE_START_EPOCH:-}"
RESERVE_ASSET_ADDRESS="${RESERVE_ASSET_ADDRESS:-}"
DEPLOY_ADMIN_ADDRESS="${DEPLOY_ADMIN_ADDRESS:-$DEFAULT_DEPLOY_ADMIN_ADDRESS}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"
# Populated only by password-style prompt; never exported to the parent shell.
DEPLOYER_PRIVATE_KEY=""

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-megaeth-contracts.sh [SALE_START_EPOCH] [options]

Quickstart:
  scripts/deploy-megaeth-contracts.sh

  # optional explicit epoch (else 1779105600 = 2026-05-18 12:00:00 UTC Monday):
  scripts/deploy-megaeth-contracts.sh 1779105600

Defaults:
  RPC_URL=https://mainnet.megaeth.com/rpc
  CHAIN_ID=4326
  NETWORK_NAME=megaeth_mainnet
  DEPLOY_ADMIN_ADDRESS=0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c
  SALE_START_EPOCH=1779105600 when omitted (env, positional, and prompt)
  RESERVE_ASSET_ADDRESS=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D when CHAIN_ID=4326 and unset
  KUMBAYA_SWAP_ROUTER_ADDRESS / KUMBAYA_WETH_ADDRESS / KUMBAYA_STABLE_TOKEN_ADDRESS=mainnet Kumbaya ETH/USDm routing when CHAIN_ID=4326 and unset (export KUMBAYA_SWAP_ROUTER_ADDRESS='' to skip TimeCurveBuyRouter)
  PRESALE_CHARM_BOOST_ADDRESSES=five canonical CHARM boost wallets when CHAIN_ID=4326 and unset (export empty to skip registry)
  PRESALE_BENEFICIARIES / PRESALE_AMOUNTS_WAD=canonical vesting row (first wallet may differ from boost #1) when CHAIN_ID=4326 and PRESALE_BENEFICIARIES unset (export empty to skip vesting)

Options:
  --rpc-url URL              Override target RPC_URL.
  --chain-id ID              Override target CHAIN_ID.
  --network NAME             Registry network label.
  --reserve-asset ADDRESS    CL8Y/reserve ERC-20 address.
  --admin ADDRESS            Final admin / owner address. Defaults to CL8Y manager.
  --skip-verify              Broadcast without explorer verification.
  -y, --yes                  Skip the final typed confirmation.
  -h, --help                 Show this help.

Security:
  The deployer private key is always requested as a hidden terminal prompt (like a password).
  It is not read from PRIVATE_KEY or any other environment variable and is not exported from
  this script; it is passed only to the ephemeral Forge broadcast subprocess.

Optional environment:
  RESERVE_ASSET_ADDRESS (defaults to 0xfBAa45A537cF07dC768c469FfaC4e88208B0098D when CHAIN_ID=4326 and unset),
  PRESALE_CHARM_BOOST_ADDRESSES (defaults on CHAIN_ID=4326 when unset; export empty to omit registry / on-chain +15% boost),
  PRESALE_BENEFICIARIES / PRESALE_AMOUNTS_WAD (defaults on CHAIN_ID=4326 when PRESALE_BENEFICIARIES unset; export empty to omit DoubPresaleVesting; may differ from boost list — TimeCurve uses registry for `isBeneficiary` when both deploy),
  SALE_START_EPOCH (defaults to 1779105600 = 2026-05-18 12:00:00 UTC),
  TOTAL_TOKENS_FOR_SALE_WAD, TIMECURVE_BUY_COOLDOWN_SEC,
  REFERRAL_REGISTRATION_BURN_WAD, CHARM_PRICE_BASE_WAD,
  CHARM_PRICE_DAILY_INCREMENT_WAD, KUMBAYA_SWAP_ROUTER_ADDRESS,
  KUMBAYA_WETH_ADDRESS, KUMBAYA_STABLE_TOKEN_ADDRESS,
  CL8Y_PROTOCOL_TREASURY_ADDRESS, RABBIT_FEE_SINK_ADDRESS,
  PRESALE_CHARM_BOOST_ADDRESSES, PRESALE_BENEFICIARIES, PRESALE_AMOUNTS_WAD,
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

# Default: 2026-05-18 12:00:00 UTC (TimeCurve `startSaleAt` anchor when unset — GitLab #114).
SALE_START_EPOCH="${SALE_START_EPOCH:-1779105600}"

if [[ -z "$RESERVE_ASSET_ADDRESS" && "$CHAIN_ID" == "4326" ]]; then
  RESERVE_ASSET_ADDRESS="$DEFAULT_MEGAETH_MAINNET_CL8Y"
fi

if [[ -z "${PRESALE_CHARM_BOOST_ADDRESSES+x}" && "$CHAIN_ID" == "4326" ]]; then
  PRESALE_CHARM_BOOST_ADDRESSES="$DEFAULT_MEGAETH_MAINNET_PRESALE_CHARM_BOOST_ADDRESSES"
fi

if [[ -z "${PRESALE_BENEFICIARIES+x}" && "$CHAIN_ID" == "4326" ]]; then
  PRESALE_BENEFICIARIES="$DEFAULT_MEGAETH_MAINNET_PRESALE_BENEFICIARIES"
  PRESALE_AMOUNTS_WAD="$DEFAULT_MEGAETH_MAINNET_PRESALE_AMOUNTS_WAD"
fi

if [[ "$CHAIN_ID" == "4326" ]]; then
  if [[ -z "${KUMBAYA_SWAP_ROUTER_ADDRESS+x}" ]]; then
    KUMBAYA_SWAP_ROUTER_ADDRESS="$DEFAULT_MEGAETH_MAINNET_KUMBAYA_SWAP_ROUTER"
  fi
  if [[ -n "${KUMBAYA_SWAP_ROUTER_ADDRESS:-}" ]]; then
    if [[ -z "${KUMBAYA_WETH_ADDRESS+x}" ]]; then
      KUMBAYA_WETH_ADDRESS="$DEFAULT_MEGAETH_MAINNET_KUMBAYA_WETH"
    fi
    if [[ -z "${KUMBAYA_STABLE_TOKEN_ADDRESS+x}" ]]; then
      KUMBAYA_STABLE_TOKEN_ADDRESS="$DEFAULT_MEGAETH_MAINNET_KUMBAYA_STABLE"
    fi
  fi
fi

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
prompt_value SALE_START_EPOCH "Sale start epoch seconds: "
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

if [[ -n "${PRESALE_BENEFICIARIES:-}" && -n "${PRESALE_CHARM_BOOST_ADDRESSES:-}" ]]; then
  PRESALE_SUMMARY="vesting+charm: beneficiaries=${PRESALE_BENEFICIARIES} | boost=${PRESALE_CHARM_BOOST_ADDRESSES}"
elif [[ -n "${PRESALE_BENEFICIARIES:-}" ]]; then
  PRESALE_SUMMARY="DoubPresaleVesting: ${PRESALE_BENEFICIARIES} (PRESALE_AMOUNTS_WAD=${PRESALE_AMOUNTS_WAD:-})"
elif [[ -n "${PRESALE_CHARM_BOOST_ADDRESSES:-}" ]]; then
  PRESALE_SUMMARY="PresaleCharmBeneficiaryRegistry: ${PRESALE_CHARM_BOOST_ADDRESSES}"
else
  PRESALE_SUMMARY="none"
fi
if [[ -n "${KUMBAYA_SWAP_ROUTER_ADDRESS:-}" ]]; then
  KUMBAYA_SUMMARY="TimeCurveBuyRouter: router=${KUMBAYA_SWAP_ROUTER_ADDRESS} weth=${KUMBAYA_WETH_ADDRESS:-} stable=${KUMBAYA_STABLE_TOKEN_ADDRESS:-}"
else
  KUMBAYA_SUMMARY="disabled"
fi

cat <<SUMMARY

YieldOmega contracts deployment
  Network:       ${NETWORK_NAME}
  RPC_URL:       ${RPC_URL}
  CHAIN_ID:      ${CHAIN_ID}
  Deployer:      ${DEPLOYER_ADDRESS}
  Final admin:   ${DEPLOY_ADMIN_ADDRESS}
  Reserve asset: ${RESERVE_ASSET_ADDRESS}
  Presale:       ${PRESALE_SUMMARY}
  Kumbaya:       ${KUMBAYA_SUMMARY}
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

# PRIVATE_KEY exists only inside this subshell for `forge`; parent never exports it.
(
  export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
  export ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY"
  export SALE_START_EPOCH="$SALE_START_EPOCH"
  export RESERVE_ASSET_ADDRESS="$RESERVE_ASSET_ADDRESS"
  export DEPLOY_ADMIN_ADDRESS="$DEPLOY_ADMIN_ADDRESS"
  export PRESALE_BENEFICIARIES="${PRESALE_BENEFICIARIES:-}"
  export PRESALE_AMOUNTS_WAD="${PRESALE_AMOUNTS_WAD:-}"
  export PRESALE_CHARM_BOOST_ADDRESSES="${PRESALE_CHARM_BOOST_ADDRESSES:-}"
  export KUMBAYA_SWAP_ROUTER_ADDRESS="${KUMBAYA_SWAP_ROUTER_ADDRESS:-}"
  export KUMBAYA_WETH_ADDRESS="${KUMBAYA_WETH_ADDRESS:-}"
  export KUMBAYA_STABLE_TOKEN_ADDRESS="${KUMBAYA_STABLE_TOKEN_ADDRESS:-}"
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
PCRG="$(zero_to_empty "$(extract_addr PresaleCharmBeneficiaryRegistry)")"
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
  --arg pcrg "$PCRG" \
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
      PresaleCharmBeneficiaryRegistry: $pcrg,
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
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
fi
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
if [[ -n "$PCRG" ]]; then
  echo "  VITE_PRESALE_CHARM_BENEFICIARY_REGISTRY=${PCRG}"
fi
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  VITE_KUMBAYA_WETH=${KUMBAYA_WETH_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_WETH}"
  echo "  VITE_KUMBAYA_USDM=${KUMBAYA_STABLE_TOKEN_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_STABLE}"
  echo "  VITE_KUMBAYA_SWAP_ROUTER=${KUMBAYA_SWAP_ROUTER_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_SWAP_ROUTER}"
  if [[ "$CHAIN_ID" == "4326" ]]; then
    echo "  VITE_KUMBAYA_QUOTER=${DEFAULT_MEGAETH_MAINNET_KUMBAYA_QUOTER}"
  fi
  echo "  VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=${BUY_ROUTER}"
fi
