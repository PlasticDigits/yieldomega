#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared Anvil helpers for indexer-backed verify scripts (GitLab #324).
#
# Caller must set: PORT, RPC, VERIFY_TAG (short id for /tmp log file names).

verify_anvil_warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

verify_anvil_send() {
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

verify_anvil_stop_existing() {
  pkill -f "anvil.*${PORT}" 2>/dev/null || true
  pkill -f 'yieldomega-indexer' 2>/dev/null || true
  sleep 1
}

verify_anvil_start() {
  local anvil_log="/tmp/yieldomega_${VERIFY_TAG}_anvil.log"
  anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
    >"${anvil_log}" 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
    sleep 0.5
  done
  cast block-number --rpc-url "${RPC}" >/dev/null
}

verify_anvil_kill_children() {
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
