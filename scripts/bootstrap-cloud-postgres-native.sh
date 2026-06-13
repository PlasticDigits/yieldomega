#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Cloud Agent native PostgreSQL 16 bootstrap (idempotent).
#
# Installs postgresql-16 + postgresql-client, listens on PG_HOST_PORT (default 5433),
# and ensures yieldomega role (CREATEDB) + yieldomega_indexer / yieldomega_indexer_test.
# Primary path when Docker yieldomega-pg is unavailable (GitLab #287).
#
# Usage (repo root):
#   bash scripts/bootstrap-cloud-postgres-native.sh
#
# Env: PG_HOST_PORT (default 5433), YIELDOMEGA_PG_CLUSTER (default 16 main)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

PG_HOST_PORT="${PG_HOST_PORT:-5433}"
PG_VERSION="${YIELDOMEGA_PG_VERSION:-16}"
PG_CLUSTER_NAME="${YIELDOMEGA_PG_CLUSTER_NAME:-main}"
PG_ROLE="yieldomega"
PG_PASSWORD="password"
PG_APP_DB="yieldomega_indexer"
PG_TEST_DB="yieldomega_indexer_test"

log() {
  echo "==> $*"
}

need_sudo() {
  [[ "$(id -u)" -eq 0 ]] || command -v sudo >/dev/null 2>&1
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

apt_packages_present() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

ensure_postgres_packages() {
  local pkgs=()
  for pkg in "postgresql-${PG_VERSION}" postgresql-client; do
    apt_packages_present "${pkg}" || pkgs+=("${pkg}")
  done
  if [[ ${#pkgs[@]} -eq 0 ]]; then
    log "PostgreSQL packages already installed"
    return 0
  fi
  if ! need_sudo; then
    echo "bootstrap-cloud-postgres-native: need sudo to install ${pkgs[*]}." >&2
    return 1
  fi
  log "apt packages: ${pkgs[*]}"
  run_as_root apt-get update -qq
  run_as_root DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"
}

cluster_running() {
  run_as_root pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER_NAME}" status >/dev/null 2>&1
}

ensure_cluster_started() {
  if cluster_running; then
    log "PostgreSQL cluster ${PG_VERSION}/${PG_CLUSTER_NAME} already running"
    return 0
  fi
  if ! need_sudo; then
    echo "bootstrap-cloud-postgres-native: need sudo to start cluster ${PG_VERSION}/${PG_CLUSTER_NAME}." >&2
    return 1
  fi
  log "Starting PostgreSQL cluster ${PG_VERSION}/${PG_CLUSTER_NAME}"
  run_as_root pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER_NAME}" start
}

configure_listen_port() {
  if ! need_sudo; then
    return 0
  fi
  local conf="/etc/postgresql/${PG_VERSION}/${PG_CLUSTER_NAME}/postgresql.conf"
  if [[ ! -f "${conf}" ]]; then
    conf="$(run_as_root -u postgres psql -p "${PG_HOST_PORT}" -tAc 'SHOW config_file;' 2>/dev/null | tr -d '[:space:]' || true)"
  fi
  if [[ -z "${conf}" || ! -f "${conf}" ]]; then
    conf="$(run_as_root -u postgres psql -tAc 'SHOW config_file;' 2>/dev/null | tr -d '[:space:]' || true)"
  fi
  if [[ -z "${conf}" || ! -f "${conf}" ]]; then
    echo "bootstrap-cloud-postgres-native: could not resolve postgresql.conf." >&2
    return 1
  fi
  if grep -qE "^port[[:space:]]*=[[:space:]]*${PG_HOST_PORT}[[:space:]]*$" "${conf}" 2>/dev/null; then
    log "PostgreSQL port already ${PG_HOST_PORT}"
    return 0
  fi
  log "Setting PostgreSQL port to ${PG_HOST_PORT}"
  run_as_root sed -i "s/^#*port[[:space:]]*=.*/port = ${PG_HOST_PORT}/" "${conf}"
  run_as_root pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER_NAME}" restart
}

run_postgres_sql() {
  # Peer auth via the cluster unix socket (omit -p: client -p uses /var/run/postgresql
  # even when the cluster sets unix_socket_directories=/tmp and port=${PG_HOST_PORT}).
  run_as_root -u postgres psql -v ON_ERROR_STOP=1 "$@"
}

ensure_role_and_databases() {
  log "Ensuring role ${PG_ROLE} and databases"
  run_postgres_sql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_ROLE}') THEN
    CREATE ROLE ${PG_ROLE} LOGIN PASSWORD '${PG_PASSWORD}' CREATEDB;
  ELSE
    ALTER ROLE ${PG_ROLE} WITH LOGIN PASSWORD '${PG_PASSWORD}' CREATEDB;
  END IF;
END \$\$;
SQL

  if ! run_postgres_sql -tAc "SELECT 1 FROM pg_database WHERE datname = '${PG_APP_DB}'" | grep -q 1; then
    run_postgres_sql -c "CREATE DATABASE ${PG_APP_DB} OWNER ${PG_ROLE};"
  else
    run_postgres_sql -c "ALTER DATABASE ${PG_APP_DB} OWNER TO ${PG_ROLE};" >/dev/null 2>&1 || true
  fi

  if ! run_postgres_sql -tAc "SELECT 1 FROM pg_database WHERE datname = '${PG_TEST_DB}'" | grep -q 1; then
    run_postgres_sql -c "CREATE DATABASE ${PG_TEST_DB} OWNER ${PG_ROLE};"
  else
    run_postgres_sql -c "ALTER DATABASE ${PG_TEST_DB} OWNER TO ${PG_ROLE};" >/dev/null 2>&1 || true
  fi
}

export_defaults_hint() {
  export PG_HOST_PORT
  export DATABASE_URL="postgres://${PG_ROLE}:${PG_PASSWORD}@127.0.0.1:${PG_HOST_PORT}/${PG_APP_DB}"
  export YIELDOMEGA_PG_TEST_URL="postgres://${PG_ROLE}:${PG_PASSWORD}@127.0.0.1:${PG_HOST_PORT}/${PG_TEST_DB}"
  log "DATABASE_URL=${DATABASE_URL}"
  log "YIELDOMEGA_PG_TEST_URL=${YIELDOMEGA_PG_TEST_URL}"
}

ensure_postgres_packages
ensure_cluster_started
configure_listen_port
ensure_role_and_databases
export_defaults_hint

log "Native Postgres bootstrap finished (port ${PG_HOST_PORT})."
log "Verify: bash scripts/verify-cloud-postgres.sh"
