#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared Anvil helpers for indexer-backed verify scripts (GitLab #324).
# Source from scripts/verify-*-anvil.sh — do not execute directly.
#
# Caller sets VERIFY_SCRIPT_PREFIX for die/log prefixes (preserves MR checklist output).

yieldomega_verify_die() {
  echo "${VERIFY_SCRIPT_PREFIX:-verify}: $*" >&2
  exit 1
}

yieldomega_verify_log() {
  echo "${VERIFY_SCRIPT_PREFIX:-verify}: $*"
}

yieldomega_verify_kill_pid_if_set() {
  local pid="${1:-}"
  if [[ -n "${pid}" ]] && [[ "${pid}" =~ ^[0-9]+$ ]] && [[ "${pid}" -gt 0 ]]; then
    kill "${pid}" 2>/dev/null || true
  fi
}

yieldomega_verify_warp_past_cooldown() {
  local rpc="${1:?rpc url required}"
  cast rpc anvil_increaseTime 5 --rpc-url "${rpc}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${rpc}" >/dev/null
}

yieldomega_verify_anvil_send() {
  local rpc="$1" from="$2" to="$3" sig="$4"
  shift 4
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${rpc}" >/dev/null
}

# Port-scoped Anvil cleanup + yieldomega-indexer only (never bare `pkill anvil`).
yieldomega_verify_pkill_stale() {
  local port="${1:?anvil port required}"
  pkill -f "anvil.*${port}" 2>/dev/null || true
  pkill -f 'yieldomega-indexer' 2>/dev/null || true
  sleep 1
}

yieldomega_verify_start_anvil() {
  local port="${1:?anvil port required}"
  local log="${2:?anvil log path required}"
  local rpc="http://127.0.0.1:${port}"
  anvil --host 127.0.0.1 --port "${port}" --gas-limit 60000000 --code-size-limit 524288 \
    >"${log}" 2>&1 &
  ANVIL_PID=$!
  export ANVIL_PID
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${rpc}" >/dev/null 2>&1 && break
    sleep 0.5
  done
  cast block-number --rpc-url "${rpc}" >/dev/null \
    || yieldomega_verify_die "Anvil RPC unavailable on ${rpc}"
}

yieldomega_verify_wait_anvil_rpc() {
  local rpc="${1:?rpc url required}"
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${rpc}" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  yieldomega_verify_die "Anvil RPC unavailable on ${rpc}"
}
