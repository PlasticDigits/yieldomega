#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Unit checks for scripts/lib/glab_cloud_agent.sh (no network when GITLAB_TOKEN unset).
#
# Usage: bash scripts/test-glab-cloud-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/glab_cloud_agent.sh
source "${ROOT}/scripts/lib/glab_cloud_agent.sh"

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

assert_eq "$(yieldomega_glab_normalize_repo 'PlasticDigits/yieldomega.git')" \
  "PlasticDigits/yieldomega" "strip .git suffix"
assert_eq "$(yieldomega_glab_normalize_repo 'PlasticDigits/yieldomega.git/')" \
  "PlasticDigits/yieldomega" "strip .git/ suffix"
assert_eq "$(yieldomega_glab_normalize_repo 'PlasticDigits/yieldomega')" \
  "PlasticDigits/yieldomega" "unchanged canonical repo"

GITLAB_REPO='PlasticDigits/yieldomega.git' \
  assert_eq "$(yieldomega_glab_repo)" "PlasticDigits/yieldomega" "yieldomega_glab_repo normalizes env"

if [[ -n "${GITLAB_TOKEN:-}" ]]; then
  yieldomega_glab_api_ok && echo "PASS  GITLAB_TOKEN API" || {
    echo "FAIL  GITLAB_TOKEN API" >&2
    fail=1
  }
  pid="$(yieldomega_glab_project_id)"
  [[ -n "${pid}" && "${pid}" =~ ^[0-9]+$ ]] && echo "PASS  project id (${pid})" || {
    echo "FAIL  project id" >&2
    fail=1
  }
else
  echo "SKIP  GITLAB_TOKEN API (token unset)"
fi

exit "${fail}"
