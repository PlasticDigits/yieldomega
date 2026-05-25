#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Broadcast DOUB airdrop batches via DoubAirdrop (MegaETH mainnet defaults).
set -euo pipefail

export FOUNDRY_DISABLE_NIGHTLY_WARNING="${FOUNDRY_DISABLE_NIGHTLY_WARNING:-1}"

# Never read the sender key from the environment (avoids leaking via export / dotfiles).
unset -v PRIVATE_KEY AIRDROP_PRIVATE_KEY ETH_PRIVATE_KEY 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AIRDROP_DIR="${ROOT}/airdrop"

DEFAULT_RPC_URL="https://mainnet.megaeth.com/rpc"
DEFAULT_CHAIN_ID="4326"
DEFAULT_DOUB_TOKEN="0xc3654B4f879937B767aFBB64B7C230FF436d2342"
DEFAULT_AIRDROP="0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d"
DEFAULT_CSV="${AIRDROP_DIR}/doub.csv"
DEFAULT_MAX_ROWS=505

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
DOUB_TOKEN="${DOUB_TOKEN:-$DEFAULT_DOUB_TOKEN}"
DOUB_AIRDROP_ADDRESS="${DOUB_AIRDROP_ADDRESS:-$DEFAULT_AIRDROP}"
CSV_PATH="${CSV_PATH:-$DEFAULT_CSV}"
MAX_ROWS="${MAX_ROWS:-$DEFAULT_MAX_ROWS}"
DRY_RUN=false
BROADCAST=false
SKIP_VALIDATE=false
ASSUME_YES=false
APPROVE_ONLY=false
AIRDROP_PRIVATE_KEY=""

usage() {
  cat <<'USAGE'
Usage:
  airdrop/run-doub-airdrop.sh [--dry-run | --broadcast] [options]

Defaults (MegaETH mainnet):
  RPC_URL=https://mainnet.megaeth.com/rpc
  DOUB_TOKEN=0xc3654B4f879937B767aFBB64B7C230FF436d2342
  DOUB_AIRDROP_ADDRESS=0x3CAf127624d8b81F4aa00aD1cCBbc9242B502e5d
  CSV_PATH=airdrop/doub.csv
  MAX_ROWS=505 recipients per transaction (8 txs for 3,850 rows)

Options:
  --dry-run              Print cast commands only (no key required)
  --broadcast            Send all batches (prompts for hidden private key)
  --approve-only         Only approve DOUB for the airdrop contract, then exit
  --csv PATH             Recipient CSV (address,amount per line)
  --max-rows N           Recipients per tx (0 = single tx; default 505)
  --rpc-url URL          RPC endpoint
  --skip-validate        Skip airdrop/validate.py
  -y, --yes              Skip final typed confirmation before broadcast
  -h, --help             Show this help

Security:
  On --broadcast / --approve-only, the sender private key is read once via a hidden
  prompt (like a password). It is not taken from PRIVATE_KEY in the environment.

Examples:
  airdrop/run-doub-airdrop.sh --dry-run
  airdrop/run-doub-airdrop.sh --broadcast
  airdrop/run-doub-airdrop.sh --approve-only
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --broadcast) BROADCAST=true; shift ;;
    --approve-only) APPROVE_ONLY=true; BROADCAST=true; shift ;;
    --csv) CSV_PATH="${2:?}"; shift 2 ;;
    --max-rows) MAX_ROWS="${2:?}"; shift 2 ;;
    --rpc-url) RPC_URL="${2:?}"; shift 2 ;;
    --skip-validate) SKIP_VALIDATE=true; shift ;;
    -y | --yes) ASSUME_YES=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$DRY_RUN" == false && "$BROADCAST" == false ]]; then
  echo "Pass --dry-run and/or --broadcast (see --help)." >&2
  exit 1
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wipe_key() {
  AIRDROP_PRIVATE_KEY=""
  unset -v AIRDROP_PRIVATE_KEY PRIVATE_KEY ETH_PRIVATE_KEY 2>/dev/null || true
}

wei_lt() {
  python3 -c "import sys; sys.path.insert(0, '${AIRDROP_DIR}'); from wei_math import int_lt; raise SystemExit(0 if int_lt(sys.argv[1], sys.argv[2]) else 1)" "$1" "$2"
}

# Exit 0 when $1 >= $2 (uint256-safe; bash [[ -lt ]] breaks above 2^63-1).
wei_gte() {
  python3 -c "import sys; sys.path.insert(0, '${AIRDROP_DIR}'); from wei_math import int_gte; raise SystemExit(0 if int_gte(sys.argv[1], sys.argv[2]) else 1)" "$1" "$2"
}

cast_send_secret() {
  # cast does not read ETH_PRIVATE_KEY; --private-key is required (never echoed here).
  cast "$@" --private-key "$AIRDROP_PRIVATE_KEY"
}
trap wipe_key EXIT

read_airdrop_key() {
  read -r -s -p "Sender private key (hidden, 0x + 64 hex): " AIRDROP_PRIVATE_KEY
  echo
  if [[ ! "$AIRDROP_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "Invalid private key format (expected 0x + 64 hex digits)." >&2
    exit 1
  fi
}

need_cmd cast
need_cmd python3

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

ACTUAL_CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$ACTUAL_CHAIN" != "$DEFAULT_CHAIN_ID" ]]; then
  echo "Warning: RPC chain id is ${ACTUAL_CHAIN} (expected MegaETH mainnet ${DEFAULT_CHAIN_ID})." >&2
fi

if [[ "$SKIP_VALIDATE" == false ]]; then
  echo "==> Validating ${CSV_PATH}"
  python3 "${AIRDROP_DIR}/validate.py" "$CSV_PATH"
  echo
fi

TOTAL_WEI="$(
  python3 -c "
from pathlib import Path
import sys
sys.path.insert(0, '${AIRDROP_DIR}')
from csv_recipients import load_recipients
_, w = load_recipients(Path('${CSV_PATH}'))
print(sum(w))
"
)"

DISPERSE_ARGS=(
  python3 "${AIRDROP_DIR}/disperse.py" "$CSV_PATH"
  --max-rows "$MAX_ROWS"
  --rpc-url "$RPC_URL"
  --doub-token "$DOUB_TOKEN"
  --airdrop "$DOUB_AIRDROP_ADDRESS"
)

if [[ "$DRY_RUN" == true ]]; then
  echo "==> Dry-run (cast commands only)"
  "${DISPERSE_ARGS[@]}" --dry-run
fi

if [[ "$BROADCAST" == false ]]; then
  exit 0
fi

read_airdrop_key
SENDER="$(cast wallet address --private-key "$AIRDROP_PRIVATE_KEY")"
BALANCE="$(cast call "$DOUB_TOKEN" "balanceOf(address)(uint256)" "$SENDER" --rpc-url "$RPC_URL" | awk '{print $1}')"
ALLOWANCE="$(cast call "$DOUB_TOKEN" "allowance(address,address)(uint256)" "$SENDER" "$DOUB_AIRDROP_ADDRESS" --rpc-url "$RPC_URL" | awk '{print $1}')"

echo "Sender:     ${SENDER}"
echo "DOUB bal:   ${BALANCE} wei"
echo "Allowance:  ${ALLOWANCE} wei (spender ${DOUB_AIRDROP_ADDRESS})"
echo "CSV total:  ${TOTAL_WEI} wei"
echo

if ! wei_gte "$BALANCE" "$TOTAL_WEI"; then
  echo "Insufficient DOUB balance for full CSV total." >&2
  exit 1
fi

if wei_lt "$ALLOWANCE" "$TOTAL_WEI"; then
  echo "Allowance below CSV total; approving ${TOTAL_WEI} wei to DoubAirdrop…"
  if [[ "$ASSUME_YES" == false ]]; then
    read -r -p "Proceed with approve tx? [y/N] " ans
    if [[ ! "$ans" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
  fi
  cast_send_secret send "$DOUB_TOKEN" "approve(address,uint256)" "$DOUB_AIRDROP_ADDRESS" "$TOTAL_WEI" \
    --rpc-url "$RPC_URL"
  echo "Approve tx sent."
  ALLOWANCE="$(cast call "$DOUB_TOKEN" "allowance(address,address)(uint256)" "$SENDER" "$DOUB_AIRDROP_ADDRESS" --rpc-url "$RPC_URL" | awk '{print $1}')"
  echo "Allowance now: ${ALLOWANCE} wei"
  if wei_lt "$ALLOWANCE" "$TOTAL_WEI"; then
    echo "Approve did not set sufficient allowance; aborting." >&2
    exit 1
  fi
  echo
fi

if [[ "$APPROVE_ONLY" == true ]]; then
  echo "Done (--approve-only)."
  exit 0
fi

BATCH_COUNT="$(
  python3 -c "
from pathlib import Path
import sys
sys.path.insert(0, '${AIRDROP_DIR}')
from csv_recipients import load_recipients
n = len(load_recipients(Path('${CSV_PATH}'))[0])
chunk = ${MAX_ROWS}
chunk = n if chunk <= 0 else chunk
print((n + chunk - 1) // chunk)
"
)"

echo "About to broadcast ${BATCH_COUNT} disperse transaction(s) (${MAX_ROWS} rows/tx max)."
if [[ "$ASSUME_YES" == false ]]; then
  read -r -p "Type YES to broadcast: " confirm
  if [[ "$confirm" != "YES" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "==> Broadcasting"
# Pass key only via env to disperse.py (never --private-key on argv).
PYTHONPATH="${AIRDROP_DIR}${PYTHONPATH:+:${PYTHONPATH}}" \
  PRIVATE_KEY="$AIRDROP_PRIVATE_KEY" \
  RPC_URL="$RPC_URL" \
  DOUB_TOKEN="$DOUB_TOKEN" \
  DOUB_AIRDROP_ADDRESS="$DOUB_AIRDROP_ADDRESS" \
  "${DISPERSE_ARGS[@]}" --broadcast

echo "Done."
