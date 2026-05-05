#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Helpers for scripts/start-qa-local-full-stack.sh — background Vite lifecycle (GitLab #153).
#
# Expects (set by the orchestrator before sourcing):
#   FRONTEND — absolute path to the frontend/ directory

set -euo pipefail

_qa_frontend_pid_file() {
  printf '%s' "${QA_FRONTEND_PID_FILE:-/tmp/yieldomega_frontend_qa.pid}"
}

# Set to 1 after this run backgrounds Vite and before readiness succeeds (GitLab #153; #151).
# INT/TERM: kill child then exit 130 — bash otherwise resumes the curl/sleep loop after the trap.
# EXIT: same kill path for errexit / shell teardown without clobbering a deliberate exit code.
QA_FRONTEND_ABORT_CLEANUP=0

_qa_kill_pid_file_process() {
  local pid_file="$1"
  [[ -f "${pid_file}" ]] || return 0
  local pid
  pid="$(tr -d ' \n\t\r' <"${pid_file}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] || return 0
  if kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    sleep 0.25
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi
}

_qa_disarm_frontend_abort_cleanup() {
  QA_FRONTEND_ABORT_CLEANUP=0
  trap - EXIT INT TERM
}

_qa_frontend_exit_cleanup() {
  if [[ "${QA_FRONTEND_ABORT_CLEANUP:-0}" != "1" ]]; then
    return 0
  fi
  local pid_file
  pid_file="$(_qa_frontend_pid_file)"
  echo "Stopping QA Vite (abnormal exit before readiness completed)…" >&2
  _qa_kill_pid_file_process "${pid_file}"
  _qa_disarm_frontend_abort_cleanup
}

_qa_frontend_signal_cleanup() {
  if [[ "${QA_FRONTEND_ABORT_CLEANUP:-0}" != "1" ]]; then
    return 0
  fi
  local pid_file
  pid_file="$(_qa_frontend_pid_file)"
  # Drop EXIT before kill/exit so `exit 130` does not also run `_qa_frontend_exit_cleanup` (bash
  # runs EXIT after some signal-driven exits unless the EXIT trap was removed first).
  _qa_disarm_frontend_abort_cleanup
  echo "Stopping QA Vite (interrupt before readiness completed)…" >&2
  _qa_kill_pid_file_process "${pid_file}"
  exit 130
}

start_frontend_dev() {
  [[ -n "${FRONTEND:-}" ]] || {
    echo "start_frontend_dev: FRONTEND is not set" >&2
    exit 1
  }
  local port="${FRONTEND_DEV_PORT:-5173}"
  local pid_file log_file
  pid_file="$(_qa_frontend_pid_file)"
  log_file="/tmp/yieldomega_frontend_qa.log"

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
  # `exec` so $! is the dev server PID (not an intermediate subshell parent of npm/node).
  (
    cd "${FRONTEND}" || exit 1
    exec npm run dev -- --host 127.0.0.1 --port "${port}"
  ) >>"${log_file}" 2>&1 &
  echo $! >"${pid_file}"
  QA_FRONTEND_ABORT_CLEANUP=1
  trap '_qa_frontend_signal_cleanup' INT TERM
  trap '_qa_frontend_exit_cleanup' EXIT
  echo "  Log: ${log_file}   PID: $(cat "${pid_file}")" >&2

  local ready=0
  for _ in $(seq 1 60); do
    # --max-time avoids indefinite blocking (and deferred INT/TERM traps) on a wedged port.
    if curl -sf --connect-timeout 1 --max-time 3 "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.5
  done

  if [[ "${ready}" != "1" ]]; then
    echo "Vite readiness probe did not succeed within ~30s — stopping dev server." >&2
    _qa_kill_pid_file_process "${pid_file}"
    _qa_disarm_frontend_abort_cleanup
    rm -f "${pid_file}" 2>/dev/null || true
    exit 1
  fi

  _qa_disarm_frontend_abort_cleanup
}
