#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared Postgres + indexer stack for Anvil verify scripts (GitLab #324).
#
# Caller must set: ROOT, PG_URL, INDEXER_PORT, REGISTRY, RPC, VERIFY_TAG.
# verify_indexer_write_registry requires TA, PV, AV, RR after deploy.

verify_indexer_write_registry() {
  local comment="$1"
  local deploy_block
  deploy_block="$(cast block-number --rpc-url "${RPC}")"
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
    }' >"${REGISTRY}"
}

verify_indexer_reset_db() {
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yieldomega_indexer' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer;" >/dev/null
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer OWNER yieldomega;" >/dev/null
}

verify_indexer_start() {
  export DATABASE_URL="${PG_URL}"
  export CHAIN_ID=31337
  export START_BLOCK=0
  export ADDRESS_REGISTRY_PATH="${REGISTRY}"
  export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
  export INGESTION_ENABLED=true
  export RPC_URL="${RPC}"
  cd "${ROOT}/indexer"
  cargo run --release >/tmp/yieldomega_${VERIFY_TAG}_indexer.log 2>&1 &
  INDEXER_PID=$!
}

verify_indexer_wait_status() {
  local status_url="http://127.0.0.1:${INDEXER_PORT}/v1/status"
  for _ in $(seq 1 180); do
    curl -sf "${status_url}" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

verify_indexer_log_tail() {
  tail -40 "/tmp/yieldomega_${VERIFY_TAG}_indexer.log" >&2
}

verify_indexer_create_test_db() {
  export YIELDOMEGA_PG_TEST_URL="${PG_URL%/*}/yieldomega_indexer_test"
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer_test;" >/dev/null 2>&1 || true
  psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;" >/dev/null
}
