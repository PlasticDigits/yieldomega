#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Full PASS for GitLab #95 wrong-network gate (issue path 7) using Rabby + Playwright.
#
# Playwright mock wallet (VITE_E2E_MOCK_WALLET=1) cannot switch chains — this script is required
# for Cloud agent / MR verification when acceptance criteria mention wrong-network or Rabby.
#
# Usage (repo root):
#   bash scripts/verify-rabby-chain-mismatch.sh
#   YIELDOMEGA_RABBY_BASE_URL=http://127.0.0.1:4173 bash scripts/verify-rabby-chain-mismatch.sh
#
# Prerequisites: see docs/testing/rabby-cloud-agent-qa.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/rabby_cloud_agent.sh
source "${ROOT}/scripts/lib/rabby_cloud_agent.sh"
RPC="${VITE_RPC_URL:-http://127.0.0.1:8545}"
BASE_URL="${YIELDOMEGA_RABBY_BASE_URL:-http://127.0.0.1:5173}"
PORT="${BASE_URL##*:}"
PORT="${PORT%%/*}"

export PATH="${HOME}/.foundry/bin:${PATH}"

if ! yieldomega_rabby_installed; then
  echo "==> Rabby extension missing — installing via bootstrap helper…"
  yieldomega_ensure_rabby_extension "${ROOT}" || {
    echo "Rabby extension missing. Run: sudo bash scripts/install-browser-extensions.sh" >&2
    exit 1
  }
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "Foundry (cast) required on PATH." >&2
  exit 1
fi

if ! cast block-number --rpc-url "${RPC}" >/dev/null 2>&1; then
  echo "Anvil not reachable at ${RPC}. Start: bash scripts/start-local-anvil-stack.sh" >&2
  exit 1
fi

MARKER="${YIELDOMEGA_RABBY_MARKER}"
if [[ ! -f "${MARKER}" ]]; then
  echo "==> Rabby dev wallets not imported; running setup (xvfb)…"
  if command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run -a bash -c "cd '${ROOT}/frontend' && node '${ROOT}/scripts/setup-rabby-dev-wallets.mjs'"
  else
    echo "Run: cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs" >&2
    exit 1
  fi
fi

if ! curl -sf "${BASE_URL}/" >/dev/null 2>&1; then
  echo "Frontend not reachable at ${BASE_URL}." >&2
  echo "Start stack: bash scripts/start-qa-local-full-stack.sh --no-swarm" >&2
  echo "Or preview: see docs/testing/rabby-cloud-agent-qa.md" >&2
  exit 1
fi

# Refuse mock-wallet builds — they cannot exercise wrong-network.
if curl -sf "${BASE_URL}/" 2>/dev/null | head -c 200000 | grep -q 'VITE_E2E_MOCK_WALLET=1'; then
  : # HTML won't contain env; check built assets if dist served
fi
if [[ -d "${ROOT}/frontend/dist/assets" ]] && grep -rq 'defaultConnected: true' "${ROOT}/frontend/dist/assets/" 2>/dev/null; then
  if grep -rq 'mock({ accounts' "${ROOT}/frontend/dist/assets/" 2>/dev/null; then
    echo "Detected wagmi mock build in frontend/dist — rebuild without VITE_E2E_MOCK_WALLET." >&2
    echo "  unset VITE_E2E_MOCK_WALLET; npm run build (see rabby-cloud-agent-qa.md)" >&2
    exit 1
  fi
fi

export VITE_CHAIN_ID="${VITE_CHAIN_ID:-31337}"
export YIELDOMEGA_RABBY_BASE_URL="${BASE_URL}"
# Extensions (Rabby) do not inject in Chromium headless — use xvfb + headed browser.
export YIELDOMEGA_RABBY_HEADLESS="${YIELDOMEGA_RABBY_HEADLESS:-0}"

# Avoid profile lock from a stuck prior Playwright/Chrome run (never pkill -f on profile path — matches argv).
yieldomega_kill_rabby_chrome() {
  local profile="${CHROME_RABBY_PROFILE:-/opt/cursor/chrome-profile-rabby}"
  local pid cmdline
  for pid in $(pgrep -x chrome 2>/dev/null || pgrep chrome 2>/dev/null || true); do
  [[ -r "/proc/${pid}/cmdline" ]] || continue
  cmdline="$(tr '\0' ' ' <"/proc/${pid}/cmdline" 2>/dev/null || true)"
  [[ "${cmdline}" == *"--user-data-dir=${profile}"* ]] || continue
  kill -9 "${pid}" 2>/dev/null || true
  done
}
yieldomega_kill_rabby_chrome
sleep 1
rm -f "${CHROME_RABBY_PROFILE:-/opt/cursor/chrome-profile-rabby}/SingletonLock" 2>/dev/null || true

echo "==> Rabby chain-mismatch verification"
echo "    RPC=${RPC} target chain=${VITE_CHAIN_ID} app=${BASE_URL}"

if [[ -z "${DISPLAY:-}" ]]; then
  if command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run -a node "${ROOT}/scripts/qa/verify-rabby-chain-mismatch.mjs"
  elif command -v Xvfb >/dev/null 2>&1; then
    if ! xdpyinfo -display :100 >/dev/null 2>&1; then
      Xvfb :100 -screen 0 1280x720x24 >/tmp/yieldomega-xvfb-rabby.log 2>&1 &
      sleep 2
    fi
    DISPLAY=:100 node "${ROOT}/scripts/qa/verify-rabby-chain-mismatch.mjs"
  else
    echo "Need xvfb-run or Xvfb for headed Rabby (extensions do not load headless)." >&2
    exit 1
  fi
else
  node "${ROOT}/scripts/qa/verify-rabby-chain-mismatch.mjs"
fi

echo "==> OK"
