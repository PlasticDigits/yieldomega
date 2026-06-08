#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Unit checks for scripts/lib/git_cloud_agent.sh.
#
# Usage: bash scripts/test-git-cloud-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/git_cloud_agent.sh
source "${ROOT}/scripts/lib/git_cloud_agent.sh"

fail=0
assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "${got}" != "${want}" ]]; then
    echo "FAIL  ${label}: got '${got}', want '${want}'" >&2
    fail=1
  else
    echo "PASS  ${label}"
  fi
}

yieldomega_configure_git_identity

assert_eq "$(git config --global user.name)" "${YIELDOMEGA_GIT_USER_NAME}" "global user.name"
assert_eq "$(git config --global user.email)" "${YIELDOMEGA_GIT_USER_EMAIL}" "global user.email"
yieldomega_git_identity_ok && echo "PASS  yieldomega_git_identity_ok" || {
  echo "FAIL  yieldomega_git_identity_ok" >&2
  fail=1
}

exit "${fail}"
