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

E2E_ENV_FILE=""
PREVIEW_PID=""
trap 'rm -f "${DEPLOY_LOG}" "${E2E_ENV_FILE}"; kill "${PREVIEW_PID:-0}" 2>/dev/null || true; kill "${ANVIL_PID:-0}" 2>/dev/null || true' EXIT

if ! command -v anvil >/dev/null || ! command -v forge >/dev/null || ! command -v cast >/dev/null; then
  echo "Need anvil, forge, and cast on PATH (Foundry)." >&2
  exit 1
fi

if [ ! -d "${ROOT}/frontend/node_modules" ]; then
  echo "Install frontend deps first: cd frontend && npm ci" >&2
  exit 1
fi

pkill -f "anvil.*${PORT}" 2>/dev/null || true
sleep 1
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
sleep 2

export YIELDOMEGA_DEPLOY_KUMBAYA="${YIELDOMEGA_DEPLOY_KUMBAYA:-1}"
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

if [ -z "${TA}" ]; then
  echo "DeployDev did not set TimeArena (TA). Check ${DEPLOY_LOG}." >&2
  exit 1
fi

# Vite only inlines env at build time; persist for npm subprocesses (GitLab #256 / #260).
E2E_ENV_FILE="${ROOT}/frontend/.env.production.local"
cat >"${E2E_ENV_FILE}" <<EOF
VITE_CHAIN_ID=${VITE_CHAIN_ID}
VITE_RPC_URL=${VITE_RPC_URL}
VITE_TIME_ARENA_ADDRESS=${TA}
VITE_PODIUM_VAULTS_ADDRESS=${PV}
VITE_ADMIN_SELL_VAULT_ADDRESS=${AV}
VITE_REFERRAL_REGISTRY_ADDRESS=${RR}
VITE_E2E_MOCK_WALLET=1
VITE_INDEXER_URL=
EOF
if [ -n "${CRED:-}" ]; then
  cat >>"${E2E_ENV_FILE}" <<EOF
VITE_PLAY_CRED_ADDRESS=${CRED}
EOF
fi
if [ -n "${KUMBAYA_WETH:-}" ]; then
  cat >>"${E2E_ENV_FILE}" <<EOF
VITE_KUMBAYA_WETH=${KUMBAYA_WETH}
VITE_KUMBAYA_USDM=${KUMBAYA_USDM}
VITE_KUMBAYA_SWAP_ROUTER=${KUMBAYA_ROUTER}
VITE_KUMBAYA_QUOTER=${KUMBAYA_ROUTER}
EOF
fi
if [ -n "${KUMBAYA_BUY_ROUTER:-}" ]; then
  cat >>"${E2E_ENV_FILE}" <<EOF
VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER=${KUMBAYA_BUY_ROUTER}
VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=${KUMBAYA_BUY_ROUTER}
EOF
fi

cd "${ROOT}/frontend"
# Parent shells often export `VITE_TIME_ARENA_ADDRESS=` (empty). Vite loadEnv will not
# override existing process.env keys — unset so .env.production.local inlines deploy addresses.
unset VITE_TIME_ARENA_ADDRESS VITE_PODIUM_VAULTS_ADDRESS VITE_ADMIN_SELL_VAULT_ADDRESS \
  VITE_REFERRAL_REGISTRY_ADDRESS VITE_PLAY_CRED_ADDRESS VITE_INDEXER_URL VITE_LAUNCH_TIMESTAMP \
  VITE_KUMBAYA_WETH VITE_KUMBAYA_USDM VITE_KUMBAYA_SWAP_ROUTER VITE_KUMBAYA_QUOTER \
  VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER VITE_KUMBAYA_TIMECURVE_BUY_ROUTER || true
npm run build

# Fail fast when Vite did not inline deploy addresses (GitLab #256 / #260).
if grep -rq 'timeArena:pu("")' dist/assets/ 2>/dev/null; then
  echo "Build inlined empty VITE_TIME_ARENA_ADDRESS (check parent-shell env overrides)." >&2
  exit 1
fi
if ! grep -rq "${TA}" dist/assets/; then
  echo "Build dist missing TimeArena address ${TA} — check ${E2E_ENV_FILE}." >&2
  exit 1
fi

# Avoid stale preview from another worktree on the Playwright port.
if command -v fuser >/dev/null 2>&1; then
  fuser -k 4173/tcp 2>/dev/null || true
else
  pkill -f "vite preview.*4173" 2>/dev/null || true
fi
sleep 1

npm run preview -- --host 127.0.0.1 --port 4173 >/tmp/yieldomega_preview_e2e.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:4173/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:4173/" >/dev/null 2>&1; then
  echo "Vite preview did not become ready on :4173." >&2
  exit 1
fi

PLAYWRIGHT_SPECS="${PLAYWRIGHT_SPECS:-e2e/anvil-arena-*.spec.ts}"
# Playwright specs read deploy addresses (e.g. #257 claim warp); build-time unset must not leak.
export VITE_TIME_ARENA_ADDRESS="${TA}"
export VITE_RPC_URL="${RPC}"
export VITE_DOUB_ADDRESS="${DOUB}"
if [ -n "${KUMBAYA_BUY_ROUTER:-}" ]; then
  export VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
  export VITE_KUMBAYA_TIMECURVE_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
fi
E2E_REUSE_PREVIEW=1 npx playwright test ${PLAYWRIGHT_SPECS}

echo "Done."
