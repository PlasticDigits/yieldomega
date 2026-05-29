#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run Anvil, deploy Arena v2 (DeployDev), build frontend, Playwright anvil-arena-* E2E.
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
anvil --host 127.0.0.1 --port "${PORT}" --code-size-limit 524288 >/tmp/yieldomega_anvil_e2e.log 2>&1 &
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
export VITE_TIME_ARENA_ADDRESS="${TA}"
export VITE_PODIUM_VAULTS_ADDRESS="${PV}"
export VITE_ADMIN_SELL_VAULT_ADDRESS="${AV}"
export VITE_REFERRAL_REGISTRY_ADDRESS="${RR}"
if [ -n "${KUMBAYA_WETH:-}" ]; then
  export VITE_KUMBAYA_WETH="${KUMBAYA_WETH}"
  export VITE_KUMBAYA_USDM="${KUMBAYA_USDM}"
  export VITE_KUMBAYA_SWAP_ROUTER="${KUMBAYA_ROUTER}"
  export VITE_KUMBAYA_QUOTER="${KUMBAYA_ROUTER}"
fi
if [ -n "${KUMBAYA_BUY_ROUTER:-}" ]; then
  export VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
  export VITE_KUMBAYA_TIMECURVE_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
fi
export VITE_E2E_MOCK_WALLET=1
export VITE_INDEXER_URL=
unset VITE_LAUNCH_TIMESTAMP
export ANVIL_E2E=1

cd "${ROOT}/frontend"
npm run build
npx playwright test e2e/anvil-arena-*.spec.ts

echo "Done."
