# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent Playwright / Chromium helpers.
# Source from bootstrap / verify scripts — do not execute directly.
#
# Playwright's bundled Chromium may be missing right after npm ci or when the
# browser cache was cleared. Rabby automation falls back to system Chrome when
# available (see scripts/lib/rabby_playwright.mjs).
#
# See AGENTS.md § Cloud agent bootstrap (Playwright + Rabby).

: "${YIELDOMEGA_PLAYWRIGHT_FRONTEND_DIR:=}"

yieldomega_playwright_frontend_dir() {
  if [[ -n "${YIELDOMEGA_PLAYWRIGHT_FRONTEND_DIR}" ]]; then
    echo "${YIELDOMEGA_PLAYWRIGHT_FRONTEND_DIR}"
    return 0
  fi
  # shellcheck disable=SC2164
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  echo "${root}/frontend"
}

# Resolve a system Chrome/Chromium binary (same search order as launch-chrome-with-rabby.sh).
yieldomega_system_chrome_bin() {
  local candidate
  for candidate in \
    "${CHROME_BIN:-}" \
    /usr/local/bin/google-chrome \
    /usr/bin/google-chrome \
    /usr/bin/google-chrome-stable \
    /usr/bin/chromium-browser \
    /usr/bin/chromium; do
    [[ -n "${candidate}" && -x "${candidate}" ]] || continue
    echo "${candidate}"
    return 0
  done
  candidate="$(command -v google-chrome 2>/dev/null || command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || true)"
  [[ -n "${candidate}" && -x "${candidate}" ]] || return 1
  echo "${candidate}"
}

# Bundled Playwright Chromium executable when the cache is complete.
yieldomega_playwright_chromium_bin() {
  local cache_dir version_dir chrome
  cache_dir="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
  [[ -d "${cache_dir}" ]] || return 1
  for version_dir in "${cache_dir}"/chromium-*; do
    [[ -d "${version_dir}" ]] || continue
    chrome="${version_dir}/chrome-linux/chrome"
    [[ -x "${chrome}" ]] || continue
    echo "${chrome}"
    return 0
  done
  return 1
}

# Best browser for Rabby Playwright automation: bundled Chromium, else system Chrome.
yieldomega_chrome_for_playwright() {
  yieldomega_playwright_chromium_bin || yieldomega_system_chrome_bin
}

# Install Playwright OS packages for Chromium (apt on Ubuntu; may need sudo).
yieldomega_install_playwright_chromium_deps() {
  local frontend_dir
  frontend_dir="$(yieldomega_playwright_frontend_dir)"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "playwright_cloud_agent: skip install-deps (no apt-get on this image)" >&2
    return 0
  fi
  (
    cd "${frontend_dir}"
    if npx playwright install-deps chromium; then
      exit 0
    fi
    if command -v sudo >/dev/null 2>&1; then
      sudo npx playwright install-deps chromium
    else
      exit 1
    fi
  )
}

# Install Playwright Chromium from frontend/package-lock (idempotent).
yieldomega_install_playwright_chromium() {
  local frontend_dir
  frontend_dir="$(yieldomega_playwright_frontend_dir)"
  if [[ ! -d "${frontend_dir}/node_modules" ]]; then
    echo "playwright_cloud_agent: run bash scripts/bootstrap-dev.sh first." >&2
    return 1
  fi
  (
    cd "${frontend_dir}"
    npx playwright install chromium
  )
}

# Cloud bootstrap entrypoint: always install bundled Chromium + OS browser deps.
yieldomega_bootstrap_playwright_chromium() {
  echo "playwright_cloud_agent: cd frontend && npx playwright install chromium"
  yieldomega_install_playwright_chromium || return 1
  echo "playwright_cloud_agent: cd frontend && npx playwright install-deps chromium"
  yieldomega_install_playwright_chromium_deps || return 1
  if yieldomega_playwright_chromium_bin >/dev/null; then
    echo "playwright_cloud_agent: bundled Chromium ready at $(yieldomega_playwright_chromium_bin)"
    return 0
  fi
  echo "playwright_cloud_agent: bundled Chromium missing after install." >&2
  return 1
}

# Ensure a launchable Chromium exists (install bundled browser or rely on system Chrome).
yieldomega_ensure_playwright_chromium() {
  if yieldomega_playwright_chromium_bin >/dev/null; then
    return 0
  fi
  echo "playwright_cloud_agent: bundled Chromium missing — running bootstrap install"
  yieldomega_bootstrap_playwright_chromium || true
  if yieldomega_playwright_chromium_bin >/dev/null; then
    return 0
  fi
  if yieldomega_system_chrome_bin >/dev/null; then
    echo "playwright_cloud_agent: using system Chrome for Rabby ($(yieldomega_system_chrome_bin))"
    return 0
  fi
  echo "playwright_cloud_agent: no Chromium available (playwright install chromium or install google-chrome)." >&2
  return 1
}
