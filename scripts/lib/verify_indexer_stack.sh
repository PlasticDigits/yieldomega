#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared Postgres + indexer helpers for verify-*-anvil.sh scripts (GitLab #324).
#
# Callers must set ROOT, PG_URL, INDEXER_PORT, RPC, and REGISTRY before use.

yieldomega_verify_pg_reset_db() {
  local db_name="${1:-yieldomega_indexer}"
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db_name};" >/dev/null
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db_name} OWNER yieldomega;" >/dev/null
}

# Args: indexer_log_path [extra_env_key=extra_env_val ...]
yieldomega_verify_start_indexer() {
  local log_file="$1"
  shift
  export DATABASE_URL="${PG_URL}"
  export CHAIN_ID=31337
  export START_BLOCK=0
  export ADDRESS_REGISTRY_PATH="${REGISTRY}"
  export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
  export INGESTION_ENABLED=true
  export RPC_URL="${RPC}"
  while [[ $# -gt 0 ]]; do
    export "$1"
    shift
  done
  cd "${ROOT}/indexer"
  cargo run --release >"${log_file}" 2>&1 &
  INDEXER_PID=$!
  export INDEXER_PID
}

# Args: die_fn indexer_log_path
yieldomega_verify_wait_indexer_status() {
  local die_fn="$1"
  local log_file="$2"
  local status_url="http://127.0.0.1:${INDEXER_PORT}/v1/status"
  for _ in $(seq 1 90); do
    curl -sf "${status_url}" >/dev/null 2>&1 && return 0
    sleep 1
  done
  tail -40 "${log_file}" >&2
  "${die_fn}" "indexer /v1/status unavailable"
}
