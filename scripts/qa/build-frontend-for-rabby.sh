#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Build frontend for Rabby QA: real injected wallet (no wagmi mock).
#
# Reads deploy addresses from frontend/.env.local when present (Anvil stack),
# or from the environment. Writes frontend/.env.production.local without
# VITE_E2E_MOCK_WALLET.
#
# Usage (repo root):
#   bash scripts/qa/build-frontend-for-rabby.sh
#   npm run preview --prefix frontend -- --host 127.0.0.1 --port 5173

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_LOCAL="${ROOT}/frontend/.env.local"
OUT="${ROOT}/frontend/.env.production.local"

load_env() {
  local file="$1"
  [[ -f "${file}" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "${file}"
  set +a
}

load_env "${ENV_LOCAL}"

: "${VITE_CHAIN_ID:=31337}"
: "${VITE_RPC_URL:=http://127.0.0.1:8545}"

if [[ -z "${VITE_TIME_ARENA_ADDRESS:-}" ]]; then
  echo "VITE_TIME_ARENA_ADDRESS unset. Start Anvil stack first:" >&2
  echo "  bash scripts/start-local-anvil-stack.sh" >&2
  exit 1
fi

cat >"${OUT}" <<EOF
VITE_CHAIN_ID=${VITE_CHAIN_ID}
VITE_RPC_URL=${VITE_RPC_URL}
VITE_TIME_ARENA_ADDRESS=${VITE_TIME_ARENA_ADDRESS}
VITE_PODIUM_VAULTS_ADDRESS=${VITE_PODIUM_VAULTS_ADDRESS:-}
VITE_REFERRAL_REGISTRY_ADDRESS=${VITE_REFERRAL_REGISTRY_ADDRESS:-}
VITE_INDEXER_URL=${VITE_INDEXER_URL:-http://127.0.0.1:3100}
EOF

# Intentionally omit VITE_E2E_MOCK_WALLET — Rabby must drive chainId for #95 path 7.

cd "${ROOT}/frontend"
unset VITE_E2E_MOCK_WALLET || true
npm run build

echo "==> Rabby build ready (no mock wallet). Preview:"
echo "    cd frontend && npm run preview -- --host 127.0.0.1 --port 5173"
