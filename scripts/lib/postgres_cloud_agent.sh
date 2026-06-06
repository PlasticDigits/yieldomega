# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent Postgres helpers — native host PG vs Docker yieldomega-pg.
# Source from bootstrap / stack / verify scripts — do not execute directly.
#
# Invariants:
#   INV-CLOUD-287-NATIVE-PG — host Postgres on PG_HOST_PORT with yieldomega role.
#
# See AGENTS.md § Postgres without Docker (yieldomega-pg).

: "${YIELDOMEGA_PG_HOST:=127.0.0.1}"
: "${YIELDOMEGA_PG_USER:=yieldomega}"
: "${YIELDOMEGA_PG_PASSWORD:=password}"
: "${YIELDOMEGA_PG_APP_DB:=yieldomega_indexer}"
: "${YIELDOMEGA_PG_ADMIN_DB:=postgres}"

yieldomega_pg_host_port() {
  echo "${PG_HOST_PORT:-5433}"
}

yieldomega_pg_database_url() {
  local port db
  port="$(yieldomega_pg_host_port)"
  db="${1:-${YIELDOMEGA_PG_APP_DB}}"
  echo "postgres://${YIELDOMEGA_PG_USER}:${YIELDOMEGA_PG_PASSWORD}@${YIELDOMEGA_PG_HOST}:${port}/${db}"
}

# True when host Postgres accepts yieldomega over TCP (native bootstrap or Docker with host networking).
yieldomega_native_postgres_usable() {
  local port
  port="$(yieldomega_pg_host_port)"
  command -v pg_isready >/dev/null 2>&1 || return 1
  pg_isready -h "${YIELDOMEGA_PG_HOST}" -p "${port}" >/dev/null 2>&1 || return 1
  PGPASSWORD="${YIELDOMEGA_PG_PASSWORD}" psql \
    -h "${YIELDOMEGA_PG_HOST}" -p "${port}" \
    -U "${YIELDOMEGA_PG_USER}" -d "${YIELDOMEGA_PG_ADMIN_DB}" \
    -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1
}

yieldomega_pg_docker_container_running() {
  local name="${1:-yieldomega-pg}"
  command -v docker >/dev/null 2>&1 || return 1
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${name}"
}

# Sets YIELDOMEGA_PG_MODE to "native" or "docker" and exports DATABASE_URL.
yieldomega_pg_select_mode() {
  local docker_pg="${1:-yieldomega-pg}"
  export PG_HOST_PORT="$(yieldomega_pg_host_port)"
  export DATABASE_URL="$(yieldomega_pg_database_url)"

  if yieldomega_native_postgres_usable; then
    export YIELDOMEGA_PG_MODE="native"
    return 0
  fi
  if command -v docker >/dev/null 2>&1 \
    && docker info >/dev/null 2>&1 \
    && docker run --rm hello-world >/dev/null 2>&1; then
    export YIELDOMEGA_PG_MODE="docker"
    export YIELDOMEGA_PG_DOCKER_CONTAINER="${docker_pg}"
    return 0
  fi
  return 1
}

yieldomega_pg_wait_ready() {
  local port tries="${1:-30}"
  port="$(yieldomega_pg_host_port)"
  if [[ "${YIELDOMEGA_PG_MODE:-}" == "docker" ]]; then
    local container="${YIELDOMEGA_PG_DOCKER_CONTAINER:-yieldomega-pg}"
    local i
    for i in $(seq 1 "${tries}"); do
      docker exec "${container}" pg_isready -U "${YIELDOMEGA_PG_USER}" -p "${port}" -d "${YIELDOMEGA_PG_APP_DB}" >/dev/null 2>&1 && return 0
      sleep 1
    done
    return 1
  fi
  local i
  for i in $(seq 1 "${tries}"); do
    yieldomega_native_postgres_usable && return 0
    sleep 1
  done
  return 1
}

# Run psql as yieldomega against admin DB (postgres).
yieldomega_pg_psql_admin() {
  if [[ "${YIELDOMEGA_PG_MODE:-}" == "docker" ]]; then
    local container="${YIELDOMEGA_PG_DOCKER_CONTAINER:-yieldomega-pg}"
    docker exec "${container}" psql -U "${YIELDOMEGA_PG_USER}" -d "${YIELDOMEGA_PG_ADMIN_DB}" -v ON_ERROR_STOP=1 "$@"
  else
    PGPASSWORD="${YIELDOMEGA_PG_PASSWORD}" psql \
      -h "${YIELDOMEGA_PG_HOST}" -p "$(yieldomega_pg_host_port)" \
      -U "${YIELDOMEGA_PG_USER}" -d "${YIELDOMEGA_PG_ADMIN_DB}" \
      -v ON_ERROR_STOP=1 "$@"
  fi
}

# Drop and recreate the indexer app database (same semantics as start-local-anvil-stack).
yieldomega_pg_reset_indexer_db() {
  yieldomega_pg_psql_admin -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${YIELDOMEGA_PG_APP_DB}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  yieldomega_pg_psql_admin -c "DROP DATABASE IF EXISTS ${YIELDOMEGA_PG_APP_DB};" >/dev/null
  yieldomega_pg_psql_admin -c \
    "CREATE DATABASE ${YIELDOMEGA_PG_APP_DB} OWNER ${YIELDOMEGA_PG_USER};" >/dev/null
}
