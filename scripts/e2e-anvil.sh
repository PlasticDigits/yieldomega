#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run Anvil, deploy Arena v2 (DeployDev), build frontend, Playwright anvil-arena-* E2E.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"
yieldomega_prepend_cloud_toolchain_path
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
DEPLOY_LOG="$(mktemp)"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

E2E_ENV_FILE=""
PREVIEW_PID=""
ANVIL_PID=""
ANVIL_PID_FILE="/tmp/yieldomega-anvil-${PORT}.pid"
PREVIEW_PID_FILE="/tmp/yieldomega-preview-4173.pid"
GOLDEN_VERIFY_LOG="${YIELDOMEGA_GOLDEN_IMAGE_VERIFY_LOG:-/home/agent/.gch/golden-image-verify.log}"

_e2e_note() {
  # Line-buffered progress for Cursor agent stream-json / tee (GitLab golden image).
  echo "[e2e-anvil $(date -Is)] $*"
}

_e2e_kill_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [[ -f "${pid_file}" ]]; then
    local old_pid
    old_pid="$(tr -d '[:space:]' < "${pid_file}" || true)"
    if [[ -n "${old_pid}" && "${old_pid}" =~ ^[0-9]+$ && "${old_pid}" -gt 0 ]]; then
      _e2e_note "Stopping stale ${label} pid ${old_pid}"
      kill "${old_pid}" 2>/dev/null || true
      sleep 1
      kill -9 "${old_pid}" 2>/dev/null || true
    fi
    rm -f "${pid_file}"
  fi
}

_e2e_anvil_cleanup() {
  rm -f "${DEPLOY_LOG}" "${E2E_ENV_FILE}"
  _yieldomega_kill_pid_if_set "${PREVIEW_PID:-}"
  _yieldomega_kill_pid_if_set "${ANVIL_PID:-}"
  rm -f "${ANVIL_PID_FILE}" "${PREVIEW_PID_FILE}"
}
trap '_e2e_anvil_cleanup' EXIT

_e2e_append_golden_log() {
  local status="$1"
  local detail="${2:-}"
  if [[ "${YIELDOMEGA_GOLDEN_IMAGE:-0}" != "1" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "${GOLDEN_VERIFY_LOG}")"
  {
    echo "e2e-anvil.sh: ${status} — ${detail} ($(date -Is))"
  } >>"${GOLDEN_VERIFY_LOG}"
}

if ! command -v anvil >/dev/null || ! command -v forge >/dev/null || ! command -v cast >/dev/null; then
  echo "Need anvil, forge, and cast on PATH (Foundry)." >&2
  exit 1
fi

if [ ! -d "${ROOT}/frontend/node_modules" ]; then
  echo "Install frontend deps first: cd frontend && npm ci" >&2
  exit 1
fi

_e2e_kill_pid_file "${ANVIL_PID_FILE}" "anvil"
_e2e_kill_pid_file "${PREVIEW_PID_FILE}" "vite preview"

_e2e_note "Starting anvil on ${RPC}..."
anvil --host 127.0.0.1 --port "${PORT}" --code-size-limit 524288 >/tmp/yieldomega_anvil_e2e.log 2>&1 &
ANVIL_PID=$!
echo "${ANVIL_PID}" >"${ANVIL_PID_FILE}"

for _ in $(seq 1 60); do
  if cast block-number --rpc-url "${RPC}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! cast block-number --rpc-url "${RPC}" >/dev/null 2>&1; then
  _e2e_append_golden_log FAIL "anvil not ready at ${RPC}"
  echo "Anvil did not become ready at ${RPC}." >&2
  exit 1
fi
sleep 2
_e2e_note "Anvil ready"

# Playwright mock wallet is Anvil account #0; seed must target default KEY_EVM_* (#0–#2), not Cloud overrides.
unset KEY_EVM_1 KEY_EVM_2 KEY_EVM_3 ADDR_EVM_1 ADDR_EVM_2 ADDR_EVM_3 EVM_DEV_ADDRS

export YIELDOMEGA_DEPLOY_KUMBAYA="${YIELDOMEGA_DEPLOY_KUMBAYA:-1}"
_e2e_note "DeployDev (+ Kumbaya=${YIELDOMEGA_DEPLOY_KUMBAYA})..."
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"
if [ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" = "1" ]; then
  yieldomega_export_kumbaya_addrs_from_log "${DEPLOY_LOG}"
fi

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
  if [ -n "${KUMBAYA_CL8Y:-}" ]; then
    export VITE_KUMBAYA_CL8Y="${KUMBAYA_CL8Y}"
  fi
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
  _e2e_append_golden_log FAIL "DeployDev missing TimeArena (TA)"
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
  if [ -n "${KUMBAYA_CL8Y:-}" ]; then
    cat >>"${E2E_ENV_FILE}" <<EOF
VITE_KUMBAYA_CL8Y=${KUMBAYA_CL8Y}
VITE_KUMBAYA_FEE_DOUB_CL8Y=100
VITE_KUMBAYA_FEE_CL8Y_WETH=100
VITE_KUMBAYA_FEE_USDM_WETH=3000
EOF
  fi
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
  VITE_KUMBAYA_CL8Y VITE_KUMBAYA_FEE_DOUB_CL8Y VITE_KUMBAYA_FEE_CL8Y_WETH VITE_KUMBAYA_FEE_USDM_WETH \
  VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER VITE_KUMBAYA_TIMECURVE_BUY_ROUTER || true

BUILD_STAMP="${ROOT}/frontend/.cache/e2e-anvil-build-${TA}.stamp"
_kumbaya_cl8y_in_dist() {
  [[ -z "${KUMBAYA_CL8Y:-}" ]] || grep -rq "${KUMBAYA_CL8Y}" dist/assets/ 2>/dev/null
}
if [[ "${YIELDOMEGA_E2E_FORCE_BUILD:-0}" != "1" ]] \
  && [[ -f "${BUILD_STAMP}" ]] \
  && [[ -d dist/assets ]] \
  && grep -rq "${TA}" dist/assets/ 2>/dev/null \
  && _kumbaya_cl8y_in_dist; then
  _e2e_note "Reusing frontend dist for TimeArena ${TA}"
else
  _e2e_note "npm run build (Vite production)..."
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
  npm run build
  mkdir -p "${ROOT}/frontend/.cache"
  touch "${BUILD_STAMP}"
fi

# Fail fast when Vite did not inline deploy addresses (GitLab #256 / #260).
if grep -rq 'timeArena:pu("")' dist/assets/ 2>/dev/null; then
  _e2e_append_golden_log FAIL "empty VITE_TIME_ARENA_ADDRESS in dist"
  echo "Build inlined empty VITE_TIME_ARENA_ADDRESS (check parent-shell env overrides)." >&2
  exit 1
fi
if ! grep -rq "${TA}" dist/assets/; then
  _e2e_append_golden_log FAIL "dist missing TimeArena ${TA}"
  echo "Build dist missing TimeArena address ${TA} — check ${E2E_ENV_FILE}." >&2
  exit 1
fi
_e2e_note "Frontend build OK"

_e2e_kill_pid_file "${PREVIEW_PID_FILE}" "vite preview"
sleep 1

_e2e_note "Starting vite preview :4173..."
npm run preview -- --host 127.0.0.1 --port 4173 >/tmp/yieldomega_preview_e2e.log 2>&1 &
PREVIEW_PID=$!
echo "${PREVIEW_PID}" >"${PREVIEW_PID_FILE}"

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:4173/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:4173/" >/dev/null 2>&1; then
  _e2e_append_golden_log FAIL "vite preview not ready on :4173"
  echo "Vite preview did not become ready on :4173." >&2
  exit 1
fi
_e2e_note "Vite preview ready"

PLAYWRIGHT_SPECS="${PLAYWRIGHT_SPECS:-e2e/anvil-arena-*.spec.ts}"
# Playwright specs read deploy addresses (e.g. #257 claim warp); build-time unset must not leak.
export VITE_TIME_ARENA_ADDRESS="${TA}"
export VITE_RPC_URL="${RPC}"
export VITE_DOUB_ADDRESS="${DOUB}"
if [ -n "${KUMBAYA_BUY_ROUTER:-}" ]; then
  export VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
  export VITE_KUMBAYA_TIMECURVE_BUY_ROUTER="${KUMBAYA_BUY_ROUTER}"
fi
_e2e_note "Playwright ${PLAYWRIGHT_SPECS}..."
E2E_REUSE_PREVIEW=1 npx playwright test ${PLAYWRIGHT_SPECS}

_e2e_append_golden_log PASS "TimeArena=${TA} specs=${PLAYWRIGHT_SPECS}"
_e2e_note "Done."
echo "Done."
