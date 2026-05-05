#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Hermetic check: GitLab #153 — trap + PID-file kill path used by the QA orchestrator.
# Does not start Docker / Anvil / Vite / npm.
#
# Tests (1) TERM to bash using the same INT/TERM/EXIT trap split as start_frontend_dev kills the
# recorded child and exits (INT/TERM handler must not return into a blocking loop; GitLab #153).
# (2) _qa_kill_pid_file_process stops the PID in the file.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB="${ROOT}/scripts/lib/qa_local_full_stack_frontend.sh"
PID_FILE="/tmp/yieldomega_frontend_qa.verify.$$"
cleanup() {
  rm -f "${PID_FILE}" 2>/dev/null || true
}
trap cleanup EXIT

# shellcheck source=scripts/lib/qa_local_full_stack_frontend.sh
source "${LIB}"

# --- Case A: TERM while armed → child dies (mirrors foreground Ctrl+C trap path) ---
QA_FRONTEND_PID_FILE="${PID_FILE}" bash -c "
  set -euo pipefail
  source \"${LIB}\"
  sleep 120 &
  echo \$! >\"\${QA_FRONTEND_PID_FILE}\"
  QA_FRONTEND_ABORT_CLEANUP=1
  trap '_qa_frontend_signal_cleanup' INT TERM
  trap '_qa_frontend_exit_cleanup' EXIT
  # Short sleeps so SIGINT/SIGTERM can run traps between iterations (bash may defer traps during
  # a single long-running foreground external command — GitLab #153).
  for _ in \$(seq 1 600); do
    sleep 1
  done
" &
runner=$!
sleep 0.4
if kill -0 "${runner}" 2>/dev/null; then
  kill -TERM "${runner}" 2>/dev/null || true
fi
wait "${runner}" 2>/dev/null || true

sleep 0.2
long_sleep_pid="$(tr -d ' \n\t\r' <"${PID_FILE}" 2>/dev/null || true)"
if [[ -n "${long_sleep_pid}" ]] && kill -0 "${long_sleep_pid}" 2>/dev/null; then
  echo "FAIL: long sleep child ${long_sleep_pid} survived TERM cleanup" >&2
  kill "${long_sleep_pid}" 2>/dev/null || true
  exit 1
fi

# --- Case B: _qa_kill_pid_file_process ---
QA_FRONTEND_PID_FILE="${PID_FILE}" bash -c "
  set -euo pipefail
  source \"${LIB}\"
  sleep 90 &
  echo \$! >\"\${QA_FRONTEND_PID_FILE}\"
  _qa_kill_pid_file_process \"\${QA_FRONTEND_PID_FILE}\"
  exit 0
" || true
sleep 0.2
short_sleep_pid="$(tr -d ' \n\t\r' <"${PID_FILE}" 2>/dev/null || true)"
if [[ -n "${short_sleep_pid}" ]] && kill -0 "${short_sleep_pid}" 2>/dev/null; then
  echo "FAIL: _qa_kill_pid_file_process did not stop PID ${short_sleep_pid}" >&2
  kill "${short_sleep_pid}" 2>/dev/null || true
  exit 1
fi

echo "OK: verify-qa-orchestrator-frontend-trap (signal trap exits + _qa_kill_pid_file_process)"
