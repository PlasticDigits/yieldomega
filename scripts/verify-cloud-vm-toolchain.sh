#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Smoke-check Cloud Agent VM toolchain (non-destructive).
#
# Usage (repo root):
#   bash scripts/verify-cloud-vm-toolchain.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
# shellcheck source=scripts/lib/docker_cloud_agent.sh
source "${ROOT}/scripts/lib/docker_cloud_agent.sh"
# shellcheck source=scripts/lib/rabby_cloud_agent.sh
source "${ROOT}/scripts/lib/rabby_cloud_agent.sh"
# shellcheck source=scripts/lib/glab_cloud_agent.sh
source "${ROOT}/scripts/lib/glab_cloud_agent.sh"
# shellcheck source=scripts/lib/git_cloud_agent.sh
source "${ROOT}/scripts/lib/git_cloud_agent.sh"
# shellcheck source=scripts/lib/playwright_cloud_agent.sh
source "${ROOT}/scripts/lib/playwright_cloud_agent.sh"
# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"

yieldomega_prepend_cloud_toolchain_path

fail=0
ok() { echo "PASS  $*"; }
bad() { echo "FAIL  $*" >&2; fail=1; }
skip() { echo "SKIP  $*"; }

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

echo "--- native Postgres (GitLab #287) ---"
bash "${ROOT}/scripts/verify-cloud-postgres.sh" || fail=1

# Docker: optional for most agent tasks (Foundry/indexer verify use native Postgres). GitLab #288.
docker_rc=0
bash "${ROOT}/scripts/verify-docker-cloud-agent.sh" || docker_rc=$?
if [[ "${docker_rc}" -eq 0 ]]; then
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
  ok "docker (${driver}) — required only for start-local-anvil-stack / full QA stack"
elif [[ "${docker_rc}" -eq 2 ]]; then
  reason="$(yieldomega_docker_unavailable_marker_present && head -1 "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}" || yieldomega_docker_error_kind)"
  skip "docker (${reason}) — use native Postgres; YIELDOMEGA_DOCKER_REQUIRED=1 to hard-fail"
else
  bad "docker required but broken (YIELDOMEGA_DOCKER_REQUIRED=1 or verify-docker-cloud-agent FAIL)"
fi

if yieldomega_git_identity_env_ok; then
  yieldomega_git_identity_ok && ok "git identity (${GIT_USERNAME})" \
    || bad "git identity wrong (run bootstrap-cloud-vm-toolchain.sh)"
else
  bad "GIT_USERNAME and GIT_EMAIL unset (set Cursor Cloud secrets)"
fi

if yieldomega_glab_real_bin >/dev/null 2>&1; then
  ok "glab binary ($($(yieldomega_glab_real_bin) version 2>/dev/null | head -1 || true))"
else
  bad "glab binary missing (run bootstrap-cloud-vm-toolchain.sh)"
fi

command -v glab >/dev/null 2>&1 && ok "glab on PATH ($(command -v glab))" || bad "glab wrapper missing from PATH"

repo="$(yieldomega_glab_repo)"
ok "glab repo (${repo})"
token="$(yieldomega_glab_token)"
if [[ -n "${token}" ]]; then
  yieldomega_glab_api_ok && ok "GITLAB_TOKEN API (PlasticDigits)" || bad "GITLAB_TOKEN API"
  yieldomega_glab_repo_context_ok && ok "glab mr list (GITLAB_TOKEN)" \
    || bad "glab mr list failed (re-run bootstrap-cloud-vm-toolchain.sh)"
else
  bad "GITLAB_TOKEN unset"
fi

command -v ss >/dev/null 2>&1 && ok "ss (iproute2)" || bad "ss missing (iproute2 — bootstrap-cloud-vm-toolchain.sh)"

command -v xvfb-run >/dev/null 2>&1 \
  && xvfb-run -a true \
  && ok "xvfb-run" || bad "xvfb-run"

if yieldomega_rabby_installed; then
  ok "Rabby extension"
else
  echo "==> Rabby extension missing — attempting install…"
  if yieldomega_ensure_rabby_extension "${ROOT}" && yieldomega_rabby_installed; then
    ok "Rabby extension (installed during verify)"
  else
    bad "Rabby extension missing (sudo bash scripts/install-browser-extensions.sh)"
  fi
fi

if [[ -d frontend/node_modules/@playwright/test ]] || [[ -d frontend/node_modules/playwright ]]; then
  if yieldomega_playwright_chromium_bin >/dev/null; then
    ok "Playwright Chromium cache ($(yieldomega_playwright_chromium_bin))"
  else
    bad "Playwright Chromium not installed (bash scripts/bootstrap-cloud-agent.sh)"
  fi
else
  bad "frontend npm deps missing (bash scripts/bootstrap-dev.sh)"
fi

if bash "${ROOT}/scripts/verify-rabby-playwright-injection.sh" >/dev/null 2>&1; then
  ok "Rabby window.ethereum injection (headed Playwright Chromium)"
else
  bad "Rabby injection smoke failed (bash scripts/verify-rabby-playwright-injection.sh)"
fi

[[ -f "${YIELDOMEGA_RABBY_MARKER}" ]] \
  && ok "Rabby dev wallets marker" || bad "Rabby dev wallets not imported (bootstrap-cloud-agent.sh)"

exit "${fail}"
