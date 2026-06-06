#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Cloud agent VM bootstrap: Playwright Chromium, Rabby extension, dev wallet import.
# Idempotent — safe on every agent boot (install step in .cursor/environment.json).
#
# Prerequisites: bash scripts/bootstrap-dev.sh (npm ci in frontend/).
# Optional: Foundry on PATH for address derivation in evm_dev_keys.sh.
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=scripts/lib/rabby_cloud_agent.sh
source "${ROOT}/scripts/lib/rabby_cloud_agent.sh"

if [[ ! -d frontend/node_modules ]]; then
  echo "bootstrap-cloud-agent.sh: run bash scripts/bootstrap-dev.sh first." >&2
  exit 1
fi

echo "==> Playwright Chromium (frontend/)"
(
  cd frontend
  npx playwright install chromium
  if command -v apt-get >/dev/null 2>&1; then
    npx playwright install-deps chromium 2>/dev/null || true
  fi
)

echo "==> Rabby extension"
if yieldomega_rabby_installed; then
  echo "    already at ${YIELDOMEGA_RABBY_EXT_DIR}"
else
  yieldomega_ensure_rabby_extension "${ROOT}"
fi

if ! yieldomega_rabby_installed; then
  echo "bootstrap-cloud-agent.sh: Rabby extension missing at ${YIELDOMEGA_RABBY_EXT_DIR}." >&2
  echo "  Run: sudo bash scripts/install-browser-extensions.sh" >&2
  exit 1
fi

if [[ -f "${ROOT}/scripts/setup-rabby-dev-wallets.mjs" ]]; then
  echo "==> Rabby dev wallets (KEY_EVM_1..3)"
  if command -v xvfb-run >/dev/null 2>&1 && [[ -z "${DISPLAY:-}" ]]; then
    xvfb-run -a bash -c "cd '${ROOT}/frontend' && node '${ROOT}/scripts/setup-rabby-dev-wallets.mjs'" || {
      echo "Warning: automated Rabby import failed; import keys manually (see AGENTS.md)." >&2
    }
  elif [[ -n "${DISPLAY:-}" ]]; then
    (cd "${ROOT}/frontend" && node "${ROOT}/scripts/setup-rabby-dev-wallets.mjs") || {
      echo "Warning: automated Rabby import failed; import keys manually (see AGENTS.md)." >&2
    }
  else
    echo "    Skip automated import (no DISPLAY / xvfb-run). Use:"
    echo "    bash scripts/launch-chrome-with-rabby.sh"
    echo "    Import KEY_EVM_1, KEY_EVM_2, KEY_EVM_3 as private keys (Anvil dev only)."
  fi
fi

# shellcheck source=scripts/lib/evm_dev_keys.sh
if [[ -f "${ROOT}/scripts/lib/evm_dev_keys.sh" ]] && command -v cast >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "${ROOT}/scripts/lib/evm_dev_keys.sh"
  echo "==> Dev wallet addresses (seed on Anvil after DeployDev):"
  echo "    ADDR_EVM_1=${ADDR_EVM_1}"
  echo "    ADDR_EVM_2=${ADDR_EVM_2}"
  echo "    ADDR_EVM_3=${ADDR_EVM_3}"
fi

echo "==> Cloud agent bootstrap finished."
