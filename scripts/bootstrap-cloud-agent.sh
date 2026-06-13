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
# shellcheck source=scripts/lib/playwright_cloud_agent.sh
source "${ROOT}/scripts/lib/playwright_cloud_agent.sh"

if [[ ! -d frontend/node_modules ]]; then
  echo "bootstrap-cloud-agent.sh: run bash scripts/bootstrap-dev.sh first." >&2
  exit 1
fi

echo "==> Playwright Chromium + browser deps (frontend/)"
if ! yieldomega_bootstrap_playwright_chromium; then
  echo "bootstrap-cloud-agent.sh: Playwright Chromium bootstrap failed." >&2
  exit 1
fi

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
  if [[ "${YIELDOMEGA_SKIP_RABBY_WALLET_IMPORT:-0}" == "1" ]]; then
    echo "    Skip (YIELDOMEGA_SKIP_RABBY_WALLET_IMPORT=1). Run later or use gch-golden-image-finalize.md."
  elif [[ -f "${YIELDOMEGA_RABBY_MARKER}" ]]; then
    echo "    already configured (${YIELDOMEGA_RABBY_MARKER})"
  elif command -v xvfb-run >/dev/null 2>&1; then
    wallet_import_timeout="${YIELDOMEGA_RABBY_WALLET_IMPORT_TIMEOUT_SEC:-600}"
    if command -v timeout >/dev/null 2>&1; then
      timeout "${wallet_import_timeout}" xvfb-run -a bash -c "cd '${ROOT}/frontend' && node '${ROOT}/scripts/setup-rabby-dev-wallets.mjs'" || {
        echo "Warning: automated Rabby import failed or timed out after ${wallet_import_timeout}s (see AGENTS.md)." >&2
      }
    else
      xvfb-run -a bash -c "cd '${ROOT}/frontend' && node '${ROOT}/scripts/setup-rabby-dev-wallets.mjs'" || {
        echo "Warning: automated Rabby import failed; import keys manually (see AGENTS.md)." >&2
      }
    fi
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

if [[ "${YIELDOMEGA_SKIP_RABBY_INJECTION_VERIFY:-0}" == "1" ]]; then
  echo "==> Rabby extension injection smoke skipped (YIELDOMEGA_SKIP_RABBY_INJECTION_VERIFY=1)"
else
  echo "==> Rabby extension injection (headed Playwright Chromium)"
  if ! bash "${ROOT}/scripts/verify-rabby-playwright-injection.sh"; then
    echo "bootstrap-cloud-agent.sh: Rabby injection smoke failed." >&2
    exit 1
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
