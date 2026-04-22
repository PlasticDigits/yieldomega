#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run Anvil, deploy contracts, build the frontend with VITE_* for chain 31337, then Playwright Anvil E2E.
# Prerequisites: Foundry (anvil, forge, cast), Node/npm in frontend/ (run `npm ci` once).
# Usage: from repo root — bash scripts/e2e-anvil.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
DEPLOY_LOG="$(mktemp)"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

trap 'rm -f "${DEPLOY_LOG}"; kill "${ANVIL_PID:-0}" 2>/dev/null || true' EXIT

if ! command -v anvil >/dev/null || ! command -v forge >/dev/null || ! command -v cast >/dev/null; then
  echo "Need anvil, forge, and cast on PATH (Foundry)." >&2
  exit 1
fi

if [ ! -d "${ROOT}/frontend/node_modules" ]; then
  echo "Install frontend deps first: cd frontend && npm ci" >&2
  exit 1
fi

echo "Starting anvil on ${RPC}..."
anvil --host 127.0.0.1 --port "${PORT}" >/tmp/yieldomega_anvil_e2e.log 2>&1 &
ANVIL_PID=$!

for _ in $(seq 1 60); do
  if cast block-number --rpc-url "${RPC}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! cast block-number --rpc-url "${RPC}" >/dev/null 2>&1; then
  echo "Anvil did not become ready at ${RPC}." >&2
  exit 1
fi

yieldomega_anvil_deploy_dev

export VITE_CHAIN_ID=31337
export VITE_RPC_URL="${RPC}"
export VITE_TIMECURVE_ADDRESS="${TC}"
export VITE_RABBIT_TREASURY_ADDRESS="${RT}"
export VITE_LEPRECHAUN_NFT_ADDRESS="${NFT}"
export VITE_KUMBAYA_WETH="${KUMBAYA_WETH}"
export VITE_KUMBAYA_USDM="${KUMBAYA_USDM}"
export VITE_KUMBAYA_SWAP_ROUTER="${KUMBAYA_ROUTER}"
export VITE_KUMBAYA_QUOTER="${KUMBAYA_ROUTER}"
export VITE_E2E_MOCK_WALLET=1
export ANVIL_E2E=1

cd "${ROOT}/frontend"
npm run build
npx playwright test e2e/anvil-*.spec.ts

echo "Done."
