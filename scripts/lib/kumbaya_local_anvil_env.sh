#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Helpers for local Anvil: merge TimeCurveBuyRouter into contracts/deployments/local-anvil-registry.json
# and sync Kumbaya VITE_* lines into frontend/.env.local (GitLab #84).
#
# Indexer: empty or missing TimeCurveBuyRouter skips BuyViaKumbaya ingestion; zero address should not
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
  KUMBAYA_ROUTER="$(_yieldomega_k_line "AnvilKumbayaRouter")"
  KUMBAYA_BUY_ROUTER="$(_yieldomega_k_line "TimeCurveBuyRouter (single-tx")"
}

# Merge checksum router address into registry JSON; no-op if file missing or router empty/zero.
yieldomega_registry_merge_timecurve_buy_router() {
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
  jq --arg br "${router}" '.contracts.TimeCurveBuyRouter = $br' "${registry_json}" > "${tmp}"
  mv "${tmp}" "${registry_json}"
}

# Idempotent: set or replace KEY=value with literal semantics (GitLab #154).
# Implementation: scripts/lib/kumbaya_env_set_line.py — treats value bytes verbatim (no sed &/# metacharacters).
_yieldomega_env_kumbaya_marker="# GitLab #84 — Kumbaya Anvil fixtures (merged by Yieldomega scripts)"
_yieldomega_env_set_line_py="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/kumbaya_env_set_line.py"
_yieldomega_env_set_line() {
  local file="$1" key="$2" val="$3"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  python3 "${_yieldomega_env_set_line_py}" "${file}" "${key}" "${val}" "${_yieldomega_env_kumbaya_marker}"
}

# Full parity with scripts/e2e-anvil.sh after DeployKumbayaAnvilFixtures (WETH, USDM, swap router, quoter, buy router).
yieldomega_frontend_merge_kumbaya_vite_full() {
  local env_local="$1"
  local weth="$2"
  local usdm="$3"
  local swap_router="$4"
  local buy_router="$5"
  [[ -f "${env_local}" ]] || return 0
  [[ -n "${weth}" && -n "${usdm}" && -n "${swap_router}" && -n "${buy_router}" ]] || return 0
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_WETH" "${weth}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_USDM" "${usdm}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_SWAP_ROUTER" "${swap_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_QUOTER" "${swap_router}"
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER" "${buy_router}"
}

# When only the buy-router address is known (onchain read), align optional env check with kumbayaRoutes.ts.
yieldomega_frontend_merge_vite_kumbaya_buy_router_only() {
  local env_local="$1"
  local buy_router="$2"
  [[ -f "${env_local}" ]] || return 0
  if [[ -z "${buy_router}" || "${buy_router}" == "0x0000000000000000000000000000000000000000" ]]; then
    return 0
  fi
  _yieldomega_env_set_line "${env_local}" "VITE_KUMBAYA_TIMECURVE_BUY_ROUTER" "${buy_router}"
}
