#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Helpers for local Anvil: merge TimeArenaBuyRouter into contracts/deployments/local-anvil-registry.json
# and sync Kumbaya VITE_* lines into frontend/.env.local (GitLab #84, Arena v2 #270).
#
# Indexer: optional legacy TimeCurveBuyRouter field is ignored for Arena v2 ingestion; zero address should not
# be written — match ADDRESS_REGISTRY semantics (indexer/src/config.rs index_addresses skips invalid/empty).

# Parse DeployKumbayaAnvilFixtures forge log (same line anchors as scripts/lib/anvil_deploy_dev.sh).
yieldomega_kumbaya_extract_from_deploy_log() {
  local log="$1"
  _yieldomega_k_line() {
    local label="$1"
    grep "${label}" "${log}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
  }
  KUMBAYA_WETH="$(_yieldomega_k_line "AnvilWETH9:")"
  KUMBAYA_USDM="$(_yieldomega_k_line "AnvilMockUSDM:")"
  KUMBAYA_CL8Y="$(_yieldomega_k_line "MockReserveCl8y (router CL8Y leg):")"
  KUMBAYA_ROUTER="$(_yieldomega_k_line "AnvilKumbayaRouter")"
  KUMBAYA_BUY_ROUTER="$(_yieldomega_k_line "TimeArenaBuyRouter (single-tx")"
  if [[ -z "${KUMBAYA_BUY_ROUTER}" ]]; then
    KUMBAYA_BUY_ROUTER="$(_yieldomega_k_line "TimeCurveBuyRouter (single-tx")"
  fi
}

# Merge checksum router address into registry JSON; no-op if file missing or router empty/zero.
yieldomega_registry_merge_timearena_buy_router() {
  local registry_json="$1"
  local router="$2"
  if [[ ! -f "${registry_json}" ]]; then
    return 0
  fi
  if [[ -z "${router}" || "${router}" == "0x0000000000000000000000000000000000000000" ]]; then
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  jq --arg br "${router}" '.contracts.TimeArenaBuyRouter = $br' "${registry_json}" > "${tmp}"
  mv "${tmp}" "${registry_json}"
}

# @deprecated Use yieldomega_registry_merge_timearena_buy_router (TimeCurve key retained for legacy tooling).
yieldomega_registry_merge_timecurve_buy_router() {
  yieldomega_registry_merge_timearena_buy_router "$@"
}

# Idempotent: set or replace KEY=value with literal semantics (GitLab #154).
# Implementation: scripts/lib/kumbaya_env_set_line.py — treats value bytes verbatim (no sed &/# metacharacters).
_yieldomega_env_kumbaya_marker="# GitLab #84 — Kumbaya Anvil fixtures (merged by Yieldomega scripts)"
_yieldomega_env_anvil_stack_marker="# Managed by scripts/start-local-anvil-stack.sh — Anvil stack VITE_*"
_yieldomega_env_set_line_py="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/kumbaya_env_set_line.py"
_yieldomega_env_set_line() {
  local file="$1" key="$2" val="$3"
  local marker="${4:-${_yieldomega_env_kumbaya_marker}}"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  python3 "${_yieldomega_env_set_line_py}" "${file}" "${key}" "${val}" "${marker}"
}

# Full parity with scripts/e2e-anvil.sh after DeployKumbayaAnvilFixtures (WETH, USDM, swap router, quoter, buy router).
yieldomega_frontend_merge_kumbaya_vite_full() {
  local env_local="$1"
  local weth="$2"
  local usdm="$3"
  local swap_router="$4"
  local buy_router="$5"
  local cl8y="${6:-}"
  [[ -f "${env_local}" ]] || return 0
  [[ -n "${weth}" && -n "${usdm}" && -n "${swap_router}" && -n "${buy_router}" ]] || return 0
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_WETH" "${weth}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_USDM" "${usdm}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_SWAP_ROUTER" "${swap_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_QUOTER" "${swap_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER" "${buy_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER" "${buy_router}"
  if [[ -n "${cl8y}" ]]; then
    _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_CL8Y" "${cl8y}"
  fi
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_FEE_DOUB_CL8Y" "100"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_FEE_CL8Y_WETH" "100"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_FEE_USDM_WETH" "3000"
}

# Merge stack-managed VITE_* into frontend/.env.local without clobbering unrelated keys
# (e.g. VITE_E2E_MOCK_WALLET, VITE_WALLETCONNECT_PROJECT_ID).
yieldomega_frontend_merge_anvil_stack_env() {
  local env_local="$1"
  local rpc_url="$2"
  local ta="$3"
  local pv="$4"
  local av="$5"
  local rr="$6"
  local indexer_port="$7"
  if [[ ! -f "${env_local}" ]]; then
    cat >"${env_local}" <<EOF
# Local Anvil + indexer — stack-managed VITE_* keys are merged below.
EOF
  fi
  _yieldomega_env_set_line "${env_local}" "VITE_CHAIN_ID" "31337" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_RPC_URL" "${rpc_url}" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_TIME_ARENA_ADDRESS" "${ta}" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_PODIUM_VAULTS_ADDRESS" "${pv}" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_ADMIN_SELL_VAULT_ADDRESS" "${av}" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_REFERRAL_REGISTRY_ADDRESS" "${rr}" "${_yieldomega_env_anvil_stack_marker}"
  _yieldomega_env_set_line "${env_local}" "VITE_INDEXER_URL" "http://127.0.0.1:${indexer_port}" "${_yieldomega_env_anvil_stack_marker}"
}

# When only the buy-router address is known (onchain read), align optional env check with kumbayaRoutes.ts.
yieldomega_frontend_merge_vite_kumbaya_buy_router_only() {
  local env_local="$1"
  local buy_router="$2"
  [[ -f "${env_local}" ]] || return 0
  if [[ -z "${buy_router}" || "${buy_router}" == "0x0000000000000000000000000000000000000000" ]]; then
    return 0
  fi
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER" "${buy_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER" "${buy_router}"
}
