#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Smoke-check Cloud Agent VM toolchain (non-destructive).
#
# Usage (repo root):
#   bash scripts/verify-cloud-vm-toolchain.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

export PATH="${HOME}/.foundry/bin:/usr/local/cargo/bin:${PATH}"

fail=0
ok() { echo "PASS  $*"; }
bad() { echo "FAIL  $*" >&2; fail=1; }

command -v forge >/dev/null 2>&1 && ok "forge $(forge --version | head -1)" || bad "forge missing"
command -v anvil >/dev/null 2>&1 && ok "anvil present" || bad "anvil missing"
command -v cast >/dev/null 2>&1 && ok "cast present" || bad "cast missing"

if command -v rustc >/dev/null 2>&1; then
  ver="$(rustc --version | awk '{print $2}')"
  printf '%s\n%s\n' "1.85.0" "${ver}" | sort -C -V && ok "rustc ${ver}" || bad "rustc ${ver} < 1.85"
else
  bad "rustc missing"
fi

dpkg-query -W -f='${Status}' libssl-dev 2>/dev/null | grep -q "install ok installed" \
  && ok "libssl-dev" || bad "libssl-dev missing"
command -v pkg-config >/dev/null 2>&1 && ok "pkg-config" || bad "pkg-config missing"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
  docker run --rm hello-world >/dev/null 2>&1 && ok "docker (${driver})" || bad "docker run failed (${driver})"
else
  bad "docker daemon unavailable"
fi

if command -v glab >/dev/null 2>&1; then
  ok "glab $(glab version 2>/dev/null | head -1 || true)"
  origin="$(glab config get remote.origin_url 2>/dev/null || true)"
  [[ "${origin}" == *"PlasticDigits/yieldomega"* ]] && ok "glab remote.origin_url" || bad "glab remote.origin_url (${origin:-unset})"
  token="${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
  if [[ -n "${token}" ]]; then
    curl -fsS -H "PRIVATE-TOKEN: ${token}" \
      "https://gitlab.com/api/v4/projects/PlasticDigits%2Fyieldomega" >/dev/null \
      && ok "GITLAB_TOKEN API" || bad "GITLAB_TOKEN API"
  else
    bad "GITLAB_TOKEN unset"
  fi
else
  bad "glab missing"
fi

command -v xvfb-run >/dev/null 2>&1 \
  && xvfb-run -a true \
  && ok "xvfb-run" || bad "xvfb-run"

[[ -f /opt/cursor/browser-extensions/rabby/manifest.json ]] \
  && ok "Rabby extension" || bad "Rabby extension missing (sudo bash scripts/install-browser-extensions.sh)"

if [[ -d frontend/node_modules/@playwright/test ]] || [[ -d frontend/node_modules/playwright ]]; then
  if [[ -d "${HOME}/.cache/ms-playwright" ]] && ls "${HOME}/.cache/ms-playwright"/chromium-* >/dev/null 2>&1; then
    ok "Playwright Chromium cache"
  else
    bad "Playwright Chromium not installed (cd frontend && npx playwright install chromium)"
  fi
else
  bad "frontend npm deps missing (bash scripts/bootstrap-dev.sh)"
fi

[[ -f /opt/cursor/chrome-profile-rabby/.yieldomega-rabby-dev-wallets-ready ]] \
  && ok "Rabby dev wallets marker" || bad "Rabby dev wallets not imported (bootstrap-cloud-agent.sh)"

exit "${fail}"
