#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Verify Rabby injects window.ethereum in headed Playwright Chromium (xvfb on Cloud VMs).
#
# Usage (repo root):
#   bash scripts/verify-rabby-playwright-injection.sh
#
# Prerequisites: frontend npm ci, Playwright Chromium + deps, Rabby extension.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# shellcheck source=scripts/lib/rabby_cloud_agent.sh
source "${ROOT}/scripts/lib/rabby_cloud_agent.sh"
# shellcheck source=scripts/lib/playwright_cloud_agent.sh
source "${ROOT}/scripts/lib/playwright_cloud_agent.sh"

if [[ ! -d frontend/node_modules ]]; then
  echo "verify-rabby-playwright-injection.sh: run bash scripts/bootstrap-dev.sh first." >&2
  exit 1
fi

if ! yieldomega_playwright_chromium_bin >/dev/null; then
  echo "verify-rabby-playwright-injection.sh: Playwright Chromium missing — run bootstrap-cloud-agent.sh" >&2
  exit 1
fi

if ! yieldomega_rabby_installed; then
  yieldomega_ensure_rabby_extension "${ROOT}" || {
    echo "verify-rabby-playwright-injection.sh: Rabby extension missing." >&2
    exit 1
  }
fi

export YIELDOMEGA_REQUIRE_PLAYWRIGHT_CHROMIUM=1

# Headed Chromium on Cloud VMs: always prefer xvfb-run (DISPLAY may be set but unusable).
if command -v xvfb-run >/dev/null 2>&1 && [[ "${YIELDOMEGA_RABBY_USE_DISPLAY:-0}" != "1" ]]; then
  xvfb-run -a bash -c "cd '${ROOT}/frontend' && node '${ROOT}/scripts/verify-rabby-playwright-injection.mjs'"
elif [[ -n "${DISPLAY:-}" ]]; then
  cd "${ROOT}/frontend"
  node "${ROOT}/scripts/verify-rabby-playwright-injection.mjs"
else
  echo "verify-rabby-playwright-injection.sh: need xvfb-run or DISPLAY for headed Chromium." >&2
  exit 1
fi
