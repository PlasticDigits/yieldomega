#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Stop Anvil + indexer (PID files from start-local-anvil-stack / start-qa) and Postgres container.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
fi
# shellcheck source=/dev/null
source "$REPO_ROOT/scripts/qa/qa-host.env"

if [[ -f /tmp/yieldomega_bot_swarm.pids ]]; then
  while read -r _pid; do
    [[ -n "${_pid}" ]] || continue
    kill "${_pid}" 2>/dev/null || true
  done < /tmp/yieldomega_bot_swarm.pids
  rm -f /tmp/yieldomega_bot_swarm.pids
fi

if [[ -f /tmp/yieldomega_indexer_stack.pid ]]; then
  kill "$(cat /tmp/yieldomega_indexer_stack.pid)" 2>/dev/null || true
  rm -f /tmp/yieldomega_indexer_stack.pid
fi

if [[ -f /tmp/yieldomega_anvil_stack.pid ]]; then
  kill "$(cat /tmp/yieldomega_anvil_stack.pid)" 2>/dev/null || true
  rm -f /tmp/yieldomega_anvil_stack.pid
fi

# Remove container so the next start-qa/stack run creates Postgres with -p 127.0.0.1:… only.
docker rm -f "${DOCKER_PG}" >/dev/null 2>&1 || true

echo "[stop-qa] Done."
