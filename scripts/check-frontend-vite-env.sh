#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Fail fast if frontend Vite env is missing contract addresses needed for TimeCurve reads
# and fee-router (FeeTransparency). Merges frontend/.env then frontend/.env.local (local wins),
# matching Vite’s usual precedence for dev.
#
# Usage (repo root): bash scripts/check-frontend-vite-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FE="${ROOT}/frontend"
ENV_MAIN="${FE}/.env"
ENV_LOCAL="${FE}/.env.local"

declare -A VALS

load_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    local key val
    if [[ "$line" =~ ^export[[:space:]]+(VITE_[A-Z0-9_]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
    elif [[ "$line" =~ ^(VITE_[A-Z0-9_]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
    else
      continue
    fi
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    VALS["$key"]="$val"
  done <"$f"
}

die() {
  echo "[check-frontend-vite-env] $*" >&2
  exit 1
}

load_file "$ENV_MAIN"
load_file "$ENV_LOCAL"

ADDR_HEX='^0x[0-9a-fA-F]{40}$'

check_addr() {
  local key="$1"
  local v="${VALS[$key]:-}"
  v="${v//[[:space:]]/}"
  if [[ -z "$v" ]]; then
    echo "  missing or empty: ${key}" >&2
    return 1
  fi
  if [[ ! "$v" =~ $ADDR_HEX ]]; then
    echo "  invalid address (want 0x + 40 hex): ${key}=${v}" >&2
    return 1
  fi
  return 0
}

check_nonempty() {
  local key="$1"
  local v="${VALS[$key]:-}"
  v="${v//[[:space:]]/}"
  if [[ -z "$v" ]]; then
    echo "  missing or empty: ${key}" >&2
    return 1
  fi
  return 0
}

ok=1

for key in VITE_TIMECURVE_ADDRESS VITE_FEE_ROUTER_ADDRESS VITE_RABBIT_TREASURY_ADDRESS \
  VITE_LEPRECHAUN_NFT_ADDRESS VITE_REFERRAL_REGISTRY_ADDRESS; do
  if ! check_addr "$key"; then
    ok=0
  fi
done

for key in VITE_RPC_URL VITE_CHAIN_ID; do
  if ! check_nonempty "$key"; then
    ok=0
  fi
done

if [[ "$ok" != 1 ]]; then
  echo "[check-frontend-vite-env] Frontend env incomplete under ${FE}/" >&2
  echo "  Fix: run \`bash scripts/start-local-anvil-stack.sh\` (writes frontend/.env.local), or" >&2
  echo "        \`./scripts/qa/write-frontend-env-local.sh\` after scp of .deploy/local.env (QA laptop)." >&2
  echo "  If you started \`npm run dev\` before env existed, restart Vite so it reloads VITE_*." >&2
  exit 1
fi

echo "[check-frontend-vite-env] OK — ${ENV_LOCAL} (merged with .env if present) has required VITE_* for TimeCurve + fee router."
