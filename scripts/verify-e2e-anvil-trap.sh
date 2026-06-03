#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Hermetic check: GitLab #279 — e2e-anvil EXIT trap must not invoke kill 0 when PIDs unset.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# Parent shell must survive a child that exits early with the same trap pattern as e2e-anvil.sh.
parent_marker="/tmp/yieldomega_e2e_trap_parent_$$"
touch "${parent_marker}"
trap 'rm -f "${parent_marker}"' EXIT

bash -c "
  set -euo pipefail
  source \"${ROOT}/scripts/lib/anvil_deploy_dev.sh\"
  PREVIEW_PID=\"\"
  ANVIL_PID=\"\"
  DEPLOY_LOG=\"\"
  E2E_ENV_FILE=\"\"
  _e2e_child_cleanup() {
    _yieldomega_kill_pid_if_set \"\${PREVIEW_PID:-}\"
    _yieldomega_kill_pid_if_set \"\${ANVIL_PID:-}\"
  }
  trap '_e2e_child_cleanup' EXIT
  exit 42
" || true

[[ -f "${parent_marker}" ]] || fail "parent shell terminated (kill 0 / process group signal suspected)"

# Guard rejects pid 0 explicitly.
if _yieldomega_kill_pid_if_set 0; then
  :
fi
[[ -f "${parent_marker}" ]] || fail "kill_pid_if_set 0 must not signal process group"

echo "OK: verify-e2e-anvil-trap (#279)"
