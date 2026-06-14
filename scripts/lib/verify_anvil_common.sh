#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared Anvil helpers for verify-*-anvil.sh scripts (GitLab #324).
#
# Callers must set ROOT, PORT, RPC, and DEPLOY_LOG before use.
# Optional: VERIFY_ANVIL_LOG (default /tmp/yieldomega_verify_anvil.log).

yieldomega_verify_warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

yieldomega_verify_anvil_send() {
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

# Scoped to anvil on a single host port — does not match unrelated anvil processes.
yieldomega_verify_pkill_anvil_port() {
  local port="${1:-${PORT}}"
  pkill -f "anvil.*${port}" 2>/dev/null || true
}

yieldomega_verify_pkill_indexer() {
  pkill -f 'yieldomega-indexer' 2>/dev/null || true
}

yieldomega_verify_stop_anvil_indexer() {
  yieldomega_verify_pkill_anvil_port "${PORT}"
  yieldomega_verify_pkill_indexer
  sleep 1
}

yieldomega_verify_start_anvil() {
  local log_file="${VERIFY_ANVIL_LOG:-/tmp/yieldomega_verify_anvil.log}"
  anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
    >"${log_file}" 2>&1 &
  ANVIL_PID=$!
  export ANVIL_PID
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  cast block-number --rpc-url "${RPC}" >/dev/null
}

yieldomega_verify_deploy_dev() {
  ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
  yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"
}

# Args: registry_path script_comment
yieldomega_verify_write_anvil_registry() {
  local registry_path="$1"
  local script_comment="$2"
  local deploy_block
  deploy_block="$(cast block-number --rpc-url "${RPC}")"
  jq -n \
    --argjson chainId 31337 \
    --arg ta "${TA}" \
    --arg pv "${PV}" \
    --arg av "${AV}" \
    --arg rr "${RR}" \
    --argjson deployBlock "${deploy_block}" \
    --arg comment "${script_comment}" \
    '{
      _comment: $comment,
      chainId: $chainId,
      contracts: { TimeArena: $ta, PodiumVaults: $pv, AdminSellVault: $av, ReferralRegistry: $rr },
      deployBlock: $deployBlock
    }' >"${registry_path}"
}

yieldomega_verify_kill_anvil_indexer_pids() {
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
