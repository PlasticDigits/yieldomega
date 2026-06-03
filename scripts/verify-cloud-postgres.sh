#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Smoke-check native Cloud Agent PostgreSQL (non-destructive except CREATEDB probe DB).
#
# Usage (repo root):
#   bash scripts/verify-cloud-postgres.sh
#
# Exit 0 when all checks PASS; exit 1 when any FAIL. SKIP lines do not fail the script.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

PG_HOST_PORT="${PG_HOST_PORT:-5433}"
PG_HOST="${PG_HOST:-127.0.0.1}"
export DATABASE_URL="${DATABASE_URL:-postgres://yieldomega:password@${PG_HOST}:${PG_HOST_PORT}/yieldomega_indexer}"
export YIELDOMEGA_PG_TEST_URL="${YIELDOMEGA_PG_TEST_URL:-postgres://yieldomega:password@${PG_HOST}:${PG_HOST_PORT}/yieldomega_indexer_test}"
CREATEDB_PROBE_DB="yieldomega_createdb_probe_287"

fail=0
skip=0

ok() { echo "PASS  $*"; }
bad() { echo "FAIL  $*" >&2; fail=1; }
skip_line() { echo "SKIP  $*"; skip=$((skip + 1)); }

command -v psql >/dev/null 2>&1 && ok "psql on PATH ($(psql --version | head -1))" || bad "psql missing (bash scripts/bootstrap-cloud-postgres-native.sh)"

if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h "${PG_HOST}" -p "${PG_HOST_PORT}" >/dev/null 2>&1 \
    && ok "pg_isready ${PG_HOST}:${PG_HOST_PORT}" \
    || bad "pg_isready ${PG_HOST}:${PG_HOST_PORT}"
else
  skip_line "pg_isready not installed (postgresql-client provides it)"
fi

if command -v psql >/dev/null 2>&1; then
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1 \
    && ok "DATABASE_URL SELECT 1" \
    || bad "DATABASE_URL SELECT 1 (${DATABASE_URL})"

  psql "${YIELDOMEGA_PG_TEST_URL}" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1 \
    && ok "YIELDOMEGA_PG_TEST_URL SELECT 1" \
    || bad "YIELDOMEGA_PG_TEST_URL SELECT 1 (${YIELDOMEGA_PG_TEST_URL})"
else
  skip_line "DATABASE_URL probes (psql missing)"
fi

# CREATEDB: yieldomega can drop/create a throwaway database (same pattern as verify-*-anvil.sh).
if command -v psql >/dev/null 2>&1; then
  admin_url="${DATABASE_URL%/*}/postgres"
  if psql "${admin_url}" -v ON_ERROR_STOP=1 -c \
    "SELECT 1 FROM pg_roles WHERE rolname = 'yieldomega' AND rolcreatedb" | grep -q 1; then
    ok "yieldomega role has CREATEDB"
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 && ok "yieldomega CREATEDB drop/create probe" || bad "yieldomega CREATEDB drop/create probe"
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${CREATEDB_PROBE_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${CREATEDB_PROBE_DB};
CREATE DATABASE ${CREATEDB_PROBE_DB};
DROP DATABASE IF EXISTS ${CREATEDB_PROBE_DB};
SQL
  else
    bad "yieldomega role missing CREATEDB"
  fi
else
  skip_line "CREATEDB probe (psql missing)"
fi

echo "HINT  export DATABASE_URL='${DATABASE_URL}'"
echo "HINT  export YIELDOMEGA_PG_TEST_URL='${YIELDOMEGA_PG_TEST_URL}'"

if [[ "${skip}" -gt 0 ]]; then
  echo "verify-cloud-postgres: ${skip} SKIP line(s) (see above)."
fi

exit "${fail}"
