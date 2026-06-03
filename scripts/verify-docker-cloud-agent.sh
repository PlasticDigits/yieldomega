#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #288 — verify non-sudo Docker for Cloud Agent user (or SKIP with remediation).
#
# Exit codes:
#   0 — docker info + docker run hello-world succeed as $USER
#   1 — FAIL (YIELDOMEGA_DOCKER_REQUIRED=1 and Docker broken)
#   2 — SKIP (Docker optional; use native Postgres — marker written on bootstrap failure)
#
# Usage (repo root):
#   bash scripts/verify-docker-cloud-agent.sh
# Strict (full stack gate):
#   YIELDOMEGA_DOCKER_REQUIRED=1 bash scripts/verify-docker-cloud-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/docker_cloud_agent.sh
source "${ROOT}/scripts/lib/docker_cloud_agent.sh"

REQUIRED="${YIELDOMEGA_DOCKER_REQUIRED:-0}"

pass() {
  echo "PASS  $*"
  yieldomega_clear_docker_unavailable
  exit 0
}

skip() {
  echo "SKIP  $*"
  exit 2
}

fail() {
  echo "FAIL  $*" >&2
  yieldomega_docker_print_diagnosis
  exit 1
}

if yieldomega_docker_usable_for_agent; then
  driver="$(docker info --format '{{.Driver}}' 2>/dev/null || echo unknown)"
  pass "docker info + hello-world (${driver})"
fi

kind="$(yieldomega_docker_error_kind)"
reason="docker_${kind}"

if yieldomega_docker_unavailable_marker_present; then
  reason="$(head -1 "${YIELDOMEGA_DOCKER_UNAVAILABLE_MARKER}" 2>/dev/null || echo "${reason}")"
fi

if [[ "${REQUIRED}" == "1" ]]; then
  fail "Docker required but not usable (${reason})"
fi

skip "Docker optional — ${reason}; use native Postgres (AGENTS.md § Postgres without Docker)"
