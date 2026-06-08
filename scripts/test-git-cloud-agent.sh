#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Unit checks for scripts/lib/git_cloud_agent.sh.
#
# Usage: bash scripts/test-git-cloud-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export GIT_USERNAME="PlasticDigits"
export GIT_EMAIL="plasticdigits@protonmail.com"
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

yieldomega_git_identity_env_ok && echo "PASS  yieldomega_git_identity_env_ok" || {
  echo "FAIL  yieldomega_git_identity_env_ok" >&2
  fail=1
}

# Stale cloud-agent.env must not override Cursor Cloud secrets already in the shell.
_stale_env="$(mktemp -d)"
export YIELDOMEGA_CLOUD_AGENT_ENV="${_stale_env}/cloud-agent.env"
{
  echo "export GIT_USERNAME='StaleUser'"
  echo "export GIT_EMAIL='stale@example.com'"
} >"${YIELDOMEGA_CLOUD_AGENT_ENV}"
export GIT_USERNAME="PlasticDigits"
export GIT_EMAIL="plasticdigits@protonmail.com"
yieldomega_load_git_identity_env
assert_eq "${GIT_USERNAME}" "PlasticDigits" "shell GIT_USERNAME wins over file"
assert_eq "${GIT_EMAIL}" "plasticdigits@protonmail.com" "shell GIT_EMAIL wins over file"
unset GIT_USERNAME GIT_EMAIL
yieldomega_load_git_identity_env
assert_eq "${GIT_USERNAME}" "StaleUser" "file GIT_USERNAME when shell unset"
assert_eq "${GIT_EMAIL}" "stale@example.com" "file GIT_EMAIL when shell unset"
rm -rf "${_stale_env}"
export GIT_USERNAME="PlasticDigits"
export GIT_EMAIL="plasticdigits@protonmail.com"

yieldomega_configure_git_identity

assert_eq "$(git config --global user.name)" "${GIT_USERNAME}" "global user.name"
assert_eq "$(git config --global user.email)" "${GIT_EMAIL}" "global user.email"
yieldomega_git_identity_ok && echo "PASS  yieldomega_git_identity_ok" || {
  echo "FAIL  yieldomega_git_identity_ok" >&2
  fail=1
}

exit "${fail}"
