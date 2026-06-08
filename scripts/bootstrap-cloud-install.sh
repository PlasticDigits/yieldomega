#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Canonical Cloud Agent install entry (.cursor/environment.json).
#
# Prepends toolchain PATH from the real repo root (never hardcode /workspace).
# Runs bootstrap scripts in order; verify is best-effort so a smoke FAIL does not
# mark the environment unreachable when secrets or Rabby are still warming up.
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
export YIELDOMEGA_REPO_ROOT="${ROOT}"

# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"
yieldomega_prepend_cloud_toolchain_path

run_step() {
  echo ""
  echo "==> bootstrap-cloud-install: $*"
  bash "$@"
}

run_step "${ROOT}/scripts/bootstrap-dev.sh"
run_step "${ROOT}/scripts/bootstrap-cloud-vm-toolchain.sh"
run_step "${ROOT}/scripts/bootstrap-cloud-postgres-native.sh"
run_step "${ROOT}/scripts/bootstrap-cloud-agent.sh"

echo ""
echo "==> bootstrap-cloud-install: verify-cloud-vm-toolchain.sh (best-effort)"
if bash "${ROOT}/scripts/verify-cloud-vm-toolchain.sh"; then
  echo "==> bootstrap-cloud-install: verify PASS"
else
  echo "bootstrap-cloud-install: verify reported failures (bootstrap finished)" >&2
fi

echo "==> bootstrap-cloud-install: finished"
