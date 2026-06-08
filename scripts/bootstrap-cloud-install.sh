#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Canonical Cloud Agent install entry (.cursor/environment.json).
#
# Prepends toolchain PATH from the real repo root (never hardcode /workspace).
# Core bootstrap steps are strict; Playwright/Rabby and verify are best-effort so
# a heavy browser smoke or missing secret does not kill the pod (OOM / unreachable).
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
export YIELDOMEGA_REPO_ROOT="${ROOT}"
export YIELDOMEGA_CLOUD_INSTALL=1
# Docker install + dockerd spikes RAM; optional for most agent tasks (GitLab #288).
export YIELDOMEGA_CLOUD_INSTALL_SKIP_DOCKER=1

# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"
yieldomega_prepend_cloud_toolchain_path

run_step() {
  echo ""
  echo "==> bootstrap-cloud-install: $*"
  bash "$@"
}

# Playwright Chromium + headed Rabby smoke can OOM small Cloud VMs after npm ci.
run_step_best_effort() {
  echo ""
  echo "==> bootstrap-cloud-install (best-effort): $*"
  set +e
  bash "$@"
  local rc=$?
  set -e
  if [[ "${rc}" -ne 0 ]]; then
    echo "bootstrap-cloud-install: WARNING — $* exited ${rc} (non-fatal; re-run: bash $*)" >&2
  fi
}

run_step "${ROOT}/scripts/bootstrap-dev.sh"
run_step "${ROOT}/scripts/bootstrap-cloud-vm-toolchain.sh"
run_step "${ROOT}/scripts/bootstrap-cloud-postgres-native.sh"
run_step_best_effort "${ROOT}/scripts/bootstrap-cloud-agent.sh"

echo ""
echo "==> bootstrap-cloud-install: verify-cloud-vm-toolchain.sh (best-effort)"
if bash "${ROOT}/scripts/verify-cloud-vm-toolchain.sh"; then
  echo "==> bootstrap-cloud-install: verify PASS"
else
  echo "bootstrap-cloud-install: verify reported failures (bootstrap finished)" >&2
fi

echo "==> bootstrap-cloud-install: finished"
