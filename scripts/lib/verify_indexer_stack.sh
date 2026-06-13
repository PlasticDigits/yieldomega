#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared DeployDev + Postgres + indexer bootstrap for verify scripts (GitLab #324).
# Source from scripts/verify-*-anvil.sh — do not execute directly.
#
# Requires caller ROOT; optional VERIFY_SCRIPT_PREFIX for error prefixes.

# shellcheck source=scripts/lib/verify_anvil_common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify_anvil_common.sh"
# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/anvil_deploy_dev.sh"

yieldomega_verify_write_anvil_registry() {
  local registry="${1:?registry path required}"
  local comment="${2:?registry _comment required}"
  local rpc="${3:?rpc url required}"
  local deploy_block
  deploy_block="$(cast block-number --rpc-url "${rpc}")"
  jq -n \
    --argjson chainId 31337 \
    --arg ta "${TA}" \
    --arg pv "${PV}" \
    --arg av "${AV}" \
    --arg rr "${RR}" \
    --argjson deployBlock "${deploy_block}" \
    --arg comment "${comment}" \
    '{
      _comment: $comment,
      chainId: $chainId,
      contracts: { TimeArena: $ta, PodiumVaults: $pv, AdminSellVault: $av, ReferralRegistry: $rr },
      deployBlock: $deployBlock
    }' >"${registry}"
}

yieldomega_verify_pg_reset_app_db() {
  local pg_url="${1:?DATABASE_URL required}"
  local db_name="${2:-yieldomega_indexer}"
  local admin_url="${pg_url%/*}/postgres"
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db_name};" >/dev/null
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db_name} OWNER yieldomega;" >/dev/null
}

yieldomega_verify_pg_reset_test_db() {
  local pg_url="${1:?DATABASE_URL required}"
  local db_name="${2:-yieldomega_indexer_test}"
  local admin_url="${pg_url%/*}/postgres"
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db_name};" >/dev/null 2>&1 || true
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db_name} OWNER yieldomega;" >/dev/null
}

yieldomega_verify_start_indexer() {
  local root="${1:?repo root required}"
  local pg_url="${2:?DATABASE_URL required}"
  local registry="${3:?registry path required}"
  local indexer_port="${4:?indexer port required}"
  local rpc="${5:?rpc url required}"
  local log="${6:?indexer log path required}"
  export DATABASE_URL="${pg_url}"
  export CHAIN_ID=31337
  export START_BLOCK=0
  export ADDRESS_REGISTRY_PATH="${registry}"
  export LISTEN_ADDR="127.0.0.1:${indexer_port}"
  export INGESTION_ENABLED=true
  export RPC_URL="${rpc}"
  cd "${root}/indexer"
  cargo build --release >>"${log}" 2>&1 \
    || yieldomega_verify_die "indexer cargo build --release failed (see ${log})"
  cargo run --release >>"${log}" 2>&1 &
  INDEXER_PID=$!
  export INDEXER_PID
}

yieldomega_verify_wait_indexer_status() {
  local indexer_port="${1:?indexer port required}"
  local log="${2:?indexer log path required}"
  local status_url="http://127.0.0.1:${indexer_port}/v1/status"
  for _ in $(seq 1 90); do
    curl -sf "${status_url}" >/dev/null 2>&1 && return 0
    sleep 1
  done
  tail -40 "${log}" >&2
  yieldomega_verify_die "indexer /v1/status unavailable"
}

# DeployDev + address export. Caller sets ROOT, RPC, DEPLOY_LOG and deploy flags before call.
yieldomega_verify_deploy_dev_export() {
  local root="${1:?repo root required}"
  local rpc="${2:?rpc url required}"
  local deploy_log="${3:?deploy log path required}"
  ROOT="${root}" RPC="${rpc}" DEPLOY_LOG="${deploy_log}" yieldomega_anvil_deploy_dev
  yieldomega_export_deploy_addrs_from_log "${deploy_log}" "${root}"
}

# Anvil spawn → DeployDev → registry → PG reset → indexer → /v1/status wait.
# Caller sets: ROOT, PORT, INDEXER_PORT, PG_URL, DEPLOY_LOG, REGISTRY,
# VERIFY_ANVIL_LOG, VERIFY_INDEXER_LOG, VERIFY_REGISTRY_COMMENT.
# Optional deploy flags (YIELDOMEGA_DEPLOY_NO_COOLDOWN, etc.) before call.
yieldomega_verify_boot_indexer_stack() {
  local root="${1:?repo root required}"
  RPC="http://127.0.0.1:${PORT}"
  yieldomega_verify_pkill_stale "${PORT}"
  yieldomega_verify_start_anvil "${PORT}" "${VERIFY_ANVIL_LOG}"
  yieldomega_verify_deploy_dev_export "${root}" "${RPC}" "${DEPLOY_LOG}"
  yieldomega_verify_write_anvil_registry "${REGISTRY}" "${VERIFY_REGISTRY_COMMENT}" "${RPC}"
  yieldomega_verify_pg_reset_app_db "${PG_URL}"
  yieldomega_verify_start_indexer "${root}" "${PG_URL}" "${REGISTRY}" "${INDEXER_PORT}" "${RPC}" \
    "${VERIFY_INDEXER_LOG}"
  yieldomega_verify_wait_indexer_status "${INDEXER_PORT}" "${VERIFY_INDEXER_LOG}"
}
