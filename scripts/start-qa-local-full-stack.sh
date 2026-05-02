#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# QA orchestrator: Postgres + Anvil + DeployDev + indexer + frontend/.env.local via
# scripts/start-local-anvil-stack.sh (single source of truth), then optionally Vite dev server.
#
# GitLab #104 — docs/testing/qa-local-full-stack.md
#
# Usage (repo root):
#   bash scripts/start-qa-local-full-stack.sh
#   bash scripts/start-qa-local-full-stack.sh --no-frontend
#   bash scripts/start-qa-local-full-stack.sh --live-sale --kumbaya
#
# All environment variables not consumed below are forwarded to start-local-anvil-stack.sh unchanged.
#
# CLI presets (optional):
#   --no-frontend     Do not background `npm run dev` (stack + indexer only).
#   --no-swarm        Force START_BOT_SWARM=0 before the stack runs.
#   --kumbaya         Set YIELDOMEGA_DEPLOY_KUMBAYA=1 (fixtures + router registry).
#   --rich-state      Unset SKIP_ANVIL_RICH_STATE (default stack: run anvil_rich_state).
#   --live-sale       Set SKIP_ANVIL_RICH_STATE=1 (live sale; swarm defaults on per stack).
#   -h, --help        Print this help.
#
# Frontend dev:
#   FRONTEND_DEV_PORT  Passthrough to `npm run dev -- --host … --port …` (default 5173).
#
# Logs / PIDs (orchestrator-owned):
#   /tmp/yieldomega_frontend_qa.log
#   /tmp/yieldomega_frontend_qa.pid
#
# Stack-owned (unchanged — see qa-local-full-stack.md):
#   Anvil:    /tmp/yieldomega_anvil_stack.pid
#   Indexer:  /tmp/yieldomega_indexer_stack.pid
#   Swarm:    /tmp/yieldomega_bot_swarm.pids, /tmp/yieldomega_swarm_*.log

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="${ROOT}/frontend"
ENV_LOCAL="${FRONTEND}/.env.local"
STACK_SCRIPT="${ROOT}/scripts/start-local-anvil-stack.sh"

WITH_FRONTEND=1

usage() {
  # Stop at first non-comment line so `set -euo pipefail` etc. never leak into --help (GitLab #105).
  awk 'NR < 3 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-frontend)
        WITH_FRONTEND=0
        shift
        ;;
      --no-swarm)
        export START_BOT_SWARM=0
        shift
        ;;
      --kumbaya)
        export YIELDOMEGA_DEPLOY_KUMBAYA=1
        shift
        ;;
      --rich-state)
        unset SKIP_ANVIL_RICH_STATE
        shift
        ;;
      --live-sale)
        export SKIP_ANVIL_RICH_STATE=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        echo "Try: bash scripts/start-qa-local-full-stack.sh --help" >&2
        exit 2
        ;;
    esac
  done
}

read_dotenv_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2-
}

start_frontend_dev() {
  local port="${FRONTEND_DEV_PORT:-5173}"
  local pid_file="/tmp/yieldomega_frontend_qa.pid"
  local log_file="/tmp/yieldomega_frontend_qa.log"

  command -v npm >/dev/null 2>&1 || {
    echo "Need npm to start Vite (install Node) or pass --no-frontend." >&2
    exit 1
  }

  if [[ -f "${pid_file}" ]]; then
    local old
    old="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${old}" ]] && kill -0 "${old}" 2>/dev/null; then
      echo "Stopping prior QA frontend (PID ${old})…" >&2
      kill "${old}" 2>/dev/null || true
      sleep 0.3
    fi
  fi

  if [[ ! -d "${FRONTEND}/node_modules" ]]; then
    echo "frontend/node_modules missing — run: cd frontend && npm ci" >&2
    exit 1
  fi

  echo "=== Vite dev (127.0.0.1:${port}) ===" >&2
  (
    cd "${FRONTEND}"
    npm run dev -- --host 127.0.0.1 --port "${port}"
  ) >>"${log_file}" 2>&1 &
  echo $! >"${pid_file}"
  echo "  Log: ${log_file}   PID: $(cat "${pid_file}")" >&2

  for _ in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
}

parse_args "$@"

echo "=== QA local full stack (delegating to start-local-anvil-stack.sh) ===" >&2
bash "${STACK_SCRIPT}"

rpc_url="$(read_dotenv_value VITE_RPC_URL "${ENV_LOCAL}" || true)"
indexer_url="$(read_dotenv_value VITE_INDEXER_URL "${ENV_LOCAL}" || true)"
port="${FRONTEND_DEV_PORT:-5173}"

echo "" >&2
echo "=== QA orchestrator summary ===" >&2
if [[ -n "${rpc_url}" ]]; then
  echo "  RPC:        ${rpc_url}" >&2
else
  echo "  RPC:        (see stack output / ${ENV_LOCAL})" >&2
fi
if [[ -n "${indexer_url}" ]]; then
  echo "  Indexer:    ${indexer_url}" >&2
else
  echo "  Indexer:    (see stack output)" >&2
fi

if [[ "${WITH_FRONTEND}" == "1" ]]; then
  start_frontend_dev
  echo "  Frontend:   http://127.0.0.1:${port}" >&2
else
  echo "  Frontend:   (--no-frontend) run: cd frontend && npm run dev" >&2
fi

echo "" >&2
echo "Verification (from repo root):" >&2
if [[ -n "${rpc_url}" ]]; then
  echo "  cast block-number --rpc-url ${rpc_url}" >&2
fi
if [[ -n "${indexer_url}" ]]; then
  echo "  curl -sf ${indexer_url}/v1/status" >&2
  echo "  curl -s '${indexer_url}/v1/timecurve/buys?limit=5' | jq ." >&2
fi
echo "  make check-frontend-env   # optional" >&2
echo "" >&2
echo "Stop processes: see docs/testing/qa-local-full-stack.md#stopping-the-stack" >&2
