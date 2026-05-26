#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Sweep CL8Y from RabbitTreasuryVault (FeeRouter fifth sink) to the manager/admin wallet.
# Use when deprecating the Rabbit Warren / Burrow fee custody path (GitLab #159 vault).
set -euo pipefail

export FOUNDRY_DISABLE_NIGHTLY_WARNING="${FOUNDRY_DISABLE_NIGHTLY_WARNING:-1}"

unset -v ADMIN_PRIVATE_KEY PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="${ROOT}/indexer/address-registry.megaeth-mainnet.json"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_NETWORK_NAME="megaeth_mainnet"
DEFAULT_ADMIN="0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c"
DEFAULT_VAULT="0x2bf6063f6440e1d0befb1bc134c547f732e83794"
DEFAULT_CL8Y="0xfBAa45A537cF07dC768c469FfaC4e88208B0098D"
DEFAULT_REASON="deprecate rabbit warren — sweep to admin for arena pivot"

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
CHAIN_ID="${CHAIN_ID:-$DEFAULT_CHAIN_ID}"
NETWORK_NAME="${NETWORK_NAME:-$DEFAULT_NETWORK_NAME}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-$DEFAULT_ADMIN}"
VAULT_ADDRESS="${VAULT_ADDRESS:-$DEFAULT_VAULT}"
CL8Y_ADDRESS="${CL8Y_ADDRESS:-$DEFAULT_CL8Y}"
SWEEP_REASON="${SWEEP_REASON:-$DEFAULT_REASON}"
DRY_RUN=true
ASSUME_YES=false
ADMIN_PRIVATE_KEY=""

usage() {
  cat <<'USAGE'
Usage:
  scripts/sweep-rabbit-treasury-vault-mainnet.sh [options]

Reads RabbitTreasuryVault CL8Y balance and (unless --dry-run) calls
withdrawERC20(token, admin, amount, reason) as vault owner.

Defaults (MegaETH 4326, from address-registry.megaeth-mainnet.json):
  RPC_URL=https://mainnet.megaeth.com/rpc
  ADMIN_ADDRESS=0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c
  VAULT_ADDRESS=0x2bf6063f6440e1d0befb1bc134c547f732e83794
  CL8Y_ADDRESS=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D

Options:
  --rpc-url URL
  --admin ADDRESS          Recipient (must match vault owner key)
  --vault ADDRESS
  --cl8y ADDRESS
  --reason TEXT            ERC20Withdrawn reason string
  --broadcast              Send tx (default: dry-run / status only)
  -y, --yes                Skip typed confirmation when broadcasting
  -h, --help

Interactive prompt (hidden): admin private key when --broadcast (must own vault).

Follow-up after sweep: repoint FeeRouter sink #4 via updateSinks so new sale
fees do not keep landing in the deprecated vault.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) RPC_URL="${2:?}"; shift 2 ;;
    --admin) ADMIN_ADDRESS="${2:?}"; shift 2 ;;
    --vault) VAULT_ADDRESS="${2:?}"; shift 2 ;;
    --cl8y) CL8Y_ADDRESS="${2:?}"; shift 2 ;;
    --reason) SWEEP_REASON="${2:?}"; shift 2 ;;
    --broadcast) DRY_RUN=false; shift ;;
    -y|--yes) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }
is_address() { [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]; }

cast_quiet() {
  cast "$@" 2>/dev/null
}

wei_balance() {
  cast_quiet erc20 balance "$1" "$2" --rpc-url "$RPC_URL" | awk '{print $1}'
}

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
  ADMIN_PRIVATE_KEY=""
  unset -v ADMIN_PRIVATE_KEY PRIVATE_KEY 2>/dev/null || true
}
trap wipe_keys EXIT

need_cmd cast
if [[ -f "$REGISTRY" ]]; then
  need_cmd jq
fi

if [[ -f "$REGISTRY" ]]; then
  REG_VAULT="$(jq -r '.contracts.RabbitTreasuryVault // empty' "$REGISTRY")"
  REG_CL8Y="$(jq -r '.contracts.CL8Y_reserve // empty' "$REGISTRY")"
  if [[ -n "$REG_VAULT" && "$VAULT_ADDRESS" == "$DEFAULT_VAULT" ]]; then
    VAULT_ADDRESS="$REG_VAULT"
  fi
  if [[ -n "$REG_CL8Y" && "$CL8Y_ADDRESS" == "$DEFAULT_CL8Y" ]]; then
    CL8Y_ADDRESS="$REG_CL8Y"
  fi
fi

for label in ADMIN_ADDRESS VAULT_ADDRESS CL8Y_ADDRESS; do
  if ! is_address "${!label}"; then
    echo "Invalid ${label}: ${!label}" >&2
    exit 1
  fi
done

RPC_CHAIN_ID="$(cast_quiet chain-id --rpc-url "$RPC_URL")"
if [[ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]]; then
  echo "RPC chain id ${RPC_CHAIN_ID} != expected ${CHAIN_ID}" >&2
  exit 1
fi

VAULT_OWNER="$(cast_quiet call "$VAULT_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL")"
BALANCE_WEI="$(wei_balance "$CL8Y_ADDRESS" "$VAULT_ADDRESS")"
BALANCE_HUMAN="$(cast_quiet --from-wei "$BALANCE_WEI" ether)"
SYMBOL="$(cast_quiet call "$CL8Y_ADDRESS" "symbol()(string)" --rpc-url "$RPC_URL" || echo CL8Y)"
BURROW_RT="0x2d21533f7d27ff22d6afe50f6e2accd711d209c6"
BURROW_BALANCE="$(wei_balance "$CL8Y_ADDRESS" "$BURROW_RT")"
BURROW_HUMAN="$(cast_quiet --from-wei "$BURROW_BALANCE" ether)"

cat <<SUMMARY

=== Rabbit Warren CL8Y sweep (${NETWORK_NAME}) ===
RPC:                 ${RPC_URL}
Vault (fee sink):    ${VAULT_ADDRESS}
Vault owner:         ${VAULT_OWNER}
Admin recipient:     ${ADMIN_ADDRESS}
CL8Y token:          ${CL8Y_ADDRESS} (${SYMBOL})
Vault CL8Y balance:  ${BALANCE_HUMAN} (${BALANCE_WEI} wei)
RabbitTreasury Burrow CL8Y on-chain: ${BURROW_HUMAN} (booked reserves via Burrow are separate)
Mode:                $(if [[ "$DRY_RUN" == true ]]; then echo "dry-run"; else echo "broadcast"; fi)
Reason:              ${SWEEP_REASON}

SUMMARY

if [[ "${VAULT_OWNER,,}" != "${ADMIN_ADDRESS,,}" ]]; then
  echo "Vault owner ${VAULT_OWNER} != ADMIN_ADDRESS ${ADMIN_ADDRESS}." >&2
  echo "Use the vault owner key or transfer ownership first (Ownable2Step)." >&2
  exit 1
fi

if [[ "$BALANCE_WEI" == "0" ]]; then
  echo "Nothing to sweep — vault CL8Y balance is zero."
  exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry-run only. Re-run with --broadcast to send withdrawERC20."
  echo
  echo "Manual cast (admin key required):"
  echo "  cast send ${VAULT_ADDRESS} \\"
  echo "    'withdrawERC20(address,address,uint256,string)' \\"
  echo "    ${CL8Y_ADDRESS} ${ADMIN_ADDRESS} ${BALANCE_WEI} '${SWEEP_REASON}' \\"
  echo "    --rpc-url ${RPC_URL} --chain ${CHAIN_ID} --private-key <ADMIN_KEY>"
  exit 0
fi

prompt_secret ADMIN_PRIVATE_KEY "Admin / vault owner private key (hidden, 0x + 64 hex): "
if [[ ! "$ADMIN_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "Admin key must be 0x-prefixed 32-byte hex." >&2
  exit 1
fi

KEY_ADDRESS="$(cast_quiet wallet address --private-key "$ADMIN_PRIVATE_KEY")"
if [[ "${KEY_ADDRESS,,}" != "${ADMIN_ADDRESS,,}" ]]; then
  echo "Key address ${KEY_ADDRESS} != ADMIN_ADDRESS ${ADMIN_ADDRESS}" >&2
  exit 1
fi

if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Type SWEEP RABBIT VAULT to broadcast: " confirmation
  if [[ "$confirmation" != "SWEEP RABBIT VAULT" ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

if [[ "$DRY_RUN" == false ]]; then
  need_cmd jq
fi

TX_HASH="$(cast send "$VAULT_ADDRESS" \
  "withdrawERC20(address,address,uint256,string)" \
  "$CL8Y_ADDRESS" "$ADMIN_ADDRESS" "$BALANCE_WEI" "$SWEEP_REASON" \
  --rpc-url "$RPC_URL" \
  --chain "$CHAIN_ID" \
  --private-key "$ADMIN_PRIVATE_KEY" \
  --json | jq -r '.transactionHash // empty')"

AFTER_WEI="$(wei_balance "$CL8Y_ADDRESS" "$VAULT_ADDRESS")"
ADMIN_WEI="$(wei_balance "$CL8Y_ADDRESS" "$ADMIN_ADDRESS")"

echo
echo "Sweep submitted."
echo "  Tx:              ${TX_HASH:-<see cast output>}"
echo "  Vault remaining: $(cast_quiet --from-wei "$AFTER_WEI" ether) ${SYMBOL}"
echo "  Admin balance:   $(cast_quiet --from-wei "$ADMIN_WEI" ether) ${SYMBOL}"
echo "  Explorer:        https://mega.etherscan.io/tx/${TX_HASH}"
echo
echo "Next: repoint FeeRouter sink #4 (10% Rabbit slice) so new buys stop funding this vault."

wipe_keys
trap - EXIT
