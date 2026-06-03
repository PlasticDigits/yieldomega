#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Unit smoke for scripts/lib/docker_cloud_agent.sh (GitLab #288).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/docker_cloud_agent.sh
source "${ROOT}/scripts/lib/docker_cloud_agent.sh"

fail() {
  echo "test-docker-cloud-agent-lib: $*" >&2
  exit 1
}

# error_kind classification (string patterns only — no live docker required for these)
kind="$(yieldomega_docker_error_kind)"
case "${kind}" in
  ok|permission_denied|overlay|daemon_down|cli_missing|run_failed|info_failed) ;;
  *) fail "unexpected error kind: ${kind}" ;;
esac

# marker round-trip
tmp="$(mktemp)"
export YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER="${tmp}"
yieldomega_mark_docker_unavailable "test_reason" || fail "mark"
yieldomega_docker_unavailable_marker_present || fail "marker missing"
[[ "$(head -1 "${tmp}")" == "test_reason" ]] || fail "marker content"
yieldomega_clear_docker_unavailable
yieldomega_docker_unavailable_marker_present && fail "marker should be cleared"
rm -f "${tmp}"

echo "test-docker-cloud-agent-lib: PASS"
