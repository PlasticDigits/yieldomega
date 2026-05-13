#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Build the Stage-3 address registry JSON from an existing DeployProduction broadcast
# (`run-latest.json`) without running `forge script` or `forge build`.
#
# Default ABI hashes use existing `contracts/out/` artifacts. For hashes matching a fresh
# compile, run `forge build` in `contracts/` first, then invoke this script with
# `--with-forge-build` (runs `forge build` inside export_abi_hashes.sh).
#
# Usage:
#   scripts/write-production-registry-from-broadcast.sh
#   scripts/write-production-registry-from-broadcast.sh path/to/run-latest.json
#   scripts/write-production-registry-from-broadcast.sh --out .deploy/registry.json
#   scripts/write-production-registry-from-broadcast.sh --chain-id 4326 --network megaeth_mainnet
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"
DEPLOY_DIR="${ROOT}/.deploy"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_MEGAETH_MAINNET_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_SWAP_ROUTER="0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_WETH="0x4200000000000000000000000000000000000006"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_STABLE="0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
DEFAULT_MEGAETH_MAINNET_KUMBAYA_QUOTER="0x1F1a8dC7E138C34b503Ca080962aC10B75384a27"

RUN_JSON=""
OUT_FILE=""
CHAIN_ID=""
NETWORK_NAME=""
RESERVE_ASSET_ADDRESS=""
DEPLOYER_ADDRESS=""
RPC_URL=""
WITH_FORGE_BUILD=false

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

After a successful write, the script prints suggested INDEXER_* and VITE_* lines (same shape as
`scripts/deploy-megaeth-contracts.sh`). You still set VITE_INDEXER_URL, VITE_EXPLORER_BASE_URL,
VITE_WALLETCONNECT_PROJECT_ID, etc. yourself — see frontend/.env.example.
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
if [[ ! "$DEPLOY_BLOCK" =~ ^[0-9]+$ ]] || [[ "$DEPLOY_BLOCK" == "0" ]]; then
  echo "Invalid deploy block parsed from ${RUN_JSON}: ${DEPLOY_BLOCK}" >&2
  exit 1
fi

BROADCAST_ADDR_LIB="${ROOT}/scripts/lib/broadcast_proxy_addresses.sh"
if [[ ! -f "$BROADCAST_ADDR_LIB" ]]; then
  echo "Missing ${BROADCAST_ADDR_LIB}" >&2
  exit 1
fi
# shellcheck source=lib/broadcast_proxy_addresses.sh
source "$BROADCAST_ADDR_LIB"

zero_to_empty() {
  if [[ "${1:-}" == "0x0000000000000000000000000000000000000000" ]]; then
    echo ""
  else
    echo "${1:-}"
  fi
}

DOUB="$(broadcast_direct_create_address "$RUN_JSON" Doubloon)"
PODIUM="$(broadcast_erc1967_proxy_address "$RUN_JSON" PodiumPool)"
SALE_BURN="0x000000000000000000000000000000000000dEaD"
DOUB_LP="$(broadcast_erc1967_proxy_address "$RUN_JSON" DoubLPIncentives)"
ECO="$(broadcast_erc1967_proxy_address "$RUN_JSON" EcosystemTreasury)"
RT_VAULT="$(zero_to_empty "$(broadcast_direct_create_address "$RUN_JSON" RabbitTreasuryVault)")"
if [[ -n "$RT_VAULT" ]]; then
  RABBIT_FEE_SINK="$RT_VAULT"
else
  if ! RABBIT_FEE_SINK="$(
    python3 - "$RUN_JSON" <<'PY'
import json
import re
import subprocess
import sys

run = json.load(open(sys.argv[1], encoding="utf-8"))
impl = next(
    (
        t["contractAddress"]
        for t in run["transactions"]
        if t.get("transactionType") == "CREATE" and t.get("contractName") == "FeeRouter"
    ),
    None,
)
if not impl:
    print("No FeeRouter implementation CREATE in broadcast JSON.", file=sys.stderr)
    sys.exit(1)
want = str(impl).lower()
init = None
for t in run["transactions"]:
    if t.get("transactionType") != "CREATE" or t.get("contractName") != "ERC1967Proxy":
        continue
    args = t.get("arguments") or []
    if len(args) < 2 or str(args[0]).lower() != want:
        continue
    init = args[1]
    break
if not init:
    print("No FeeRouter ERC1967Proxy CREATE in broadcast JSON.", file=sys.stderr)
    sys.exit(1)
raw = subprocess.check_output(
    [
        "cast",
        "calldata-decode",
        "initialize(address,address[5],uint16[5])",
        init,
    ],
    stderr=subprocess.DEVNULL,
    text=True,
)
lines = [ln.strip() for ln in raw.strip().splitlines() if ln.strip() and not ln.startswith("Warning:")]
if len(lines) < 2:
    print("Unexpected cast calldata-decode output for FeeRouter.initialize.", file=sys.stderr)
    sys.exit(1)
addrs = re.findall(r"0x[a-fA-F]{40}", lines[1])
if len(addrs) < 5:
    print("Could not parse FeeRouter destination addresses from cast output.", file=sys.stderr)
    sys.exit(1)
print(addrs[4])
PY
  )"; then
    echo "Could not resolve RabbitFeeSink from FeeRouter init in ${RUN_JSON} (no vault row)." >&2
    exit 1
  fi
fi
RT="$(broadcast_erc1967_proxy_address "$RUN_JSON" RabbitTreasury)"
FEE_ROUTER="$(broadcast_erc1967_proxy_address "$RUN_JSON" FeeRouter)"
REFERRAL="$(broadcast_erc1967_proxy_address "$RUN_JSON" ReferralRegistry)"
CHARM_PRICE="$(broadcast_erc1967_proxy_address "$RUN_JSON" LinearCharmPrice)"
TC="$(broadcast_erc1967_proxy_address "$RUN_JSON" TimeCurve)"
DPV="$(zero_to_empty "$(broadcast_erc1967_proxy_address "$RUN_JSON" DoubPresaleVesting 2>/dev/null || true)")"
PCRG="$(zero_to_empty "$(broadcast_direct_create_address "$RUN_JSON" PresaleCharmBeneficiaryRegistry)")"
BUY_ROUTER="$(zero_to_empty "$(broadcast_direct_create_address "$RUN_JSON" TimeCurveBuyRouter)")"
NFT="$(broadcast_direct_create_address "$RUN_JSON" LeprechaunNFT)"

for required in DOUB PODIUM SALE_BURN DOUB_LP ECO RABBIT_FEE_SINK RT FEE_ROUTER REFERRAL CHARM_PRICE TC NFT; do
  if [[ -z "${!required:-}" ]]; then
    echo "Could not resolve ${required} from broadcast JSON: ${RUN_JSON}" >&2
    exit 1
  fi
done

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
  }' >"$OUT_FILE"
rm -f "$ABI_HASH_TMP"

RPC_HINT="${RPC_URL:-$DEFAULT_RPC_URL}"
KUMBAYA_ROUTER="${KUMBAYA_SWAP_ROUTER_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_SWAP_ROUTER}"
KUMBAYA_WETH="${KUMBAYA_WETH_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_WETH}"
KUMBAYA_STABLE="${KUMBAYA_STABLE_TOKEN_ADDRESS:-$DEFAULT_MEGAETH_MAINNET_KUMBAYA_STABLE}"

echo "Wrote registry: ${OUT_FILE}"
echo
echo "Indexer env:"
echo "  CHAIN_ID=${CHAIN_ID}"
echo "  RPC_URL=${RPC_HINT}"
echo "  START_BLOCK=${DEPLOY_BLOCK}"
echo "  ADDRESS_REGISTRY_PATH=${OUT_FILE}"
if [[ -n "$BUY_ROUTER" ]]; then
  echo "  INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1"
fi
echo
echo "Frontend env (Vite; add to frontend/.env.production or host secrets):"
echo "  VITE_CHAIN_ID=${CHAIN_ID}"
echo "  VITE_RPC_URL=${RPC_HINT}"
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
  echo "  VITE_KUMBAYA_WETH=${KUMBAYA_WETH}"
  echo "  VITE_KUMBAYA_USDM=${KUMBAYA_STABLE}"
  echo "  VITE_KUMBAYA_SWAP_ROUTER=${KUMBAYA_ROUTER}"
  if [[ "$CHAIN_ID" == "4326" ]]; then
    echo "  VITE_KUMBAYA_QUOTER=${DEFAULT_MEGAETH_MAINNET_KUMBAYA_QUOTER}"
  fi
  echo "  VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=${BUY_ROUTER}"
fi
echo
echo "Also set (not in onchain registry): VITE_INDEXER_URL, VITE_EXPLORER_BASE_URL, VITE_WALLETCONNECT_PROJECT_ID — see frontend/.env.example."
