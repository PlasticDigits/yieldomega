#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Check Postgres (Docker), Anvil, and indexer on the QA/dev host.
# Usage: ./scripts/status.sh   or   make status
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi
# shellcheck source=/dev/null
source "$PROJECT_ROOT/scripts/qa/qa-host.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_line() {
  local name="$1"
  local status="$2"
  local detail="${3:-}"
  local color=$RED
  if [[ "$status" == "running" ]]; then
    color=$GREEN
  elif [[ "$status" == "partial" ]]; then
    color=$YELLOW
  fi
  printf "  %-14s " "${name}:"
  echo -e "${color}${status}${NC} ${detail}"
}

echo ""
echo "========================================"
echo "    Yieldomega stack status"
echo "========================================"
echo ""
echo -e "${BLUE}Infrastructure:${NC}"

# Postgres (Docker container from stack)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_PG}$"; then
  if docker exec "${DOCKER_PG}" pg_isready -U yieldomega -d yieldomega_indexer >/dev/null 2>&1; then
    log_line "Postgres" "running" "(${DOCKER_PG} :${PG_HOST_PORT})"
  else
    log_line "Postgres" "partial" "(container up, DB not ready)"
  fi
else
  log_line "Postgres" "stopped" "(${DOCKER_PG})"
fi

# Anvil
if command -v cast >/dev/null 2>&1; then
  if bn="$(cast block-number --rpc-url "${RPC_URL}" 2>/dev/null)"; then
    log_line "Anvil" "running" "(${RPC_URL} block ${bn})"
  else
    log_line "Anvil" "stopped" "(${RPC_URL})"
  fi
else
  log_line "Anvil" "unknown" "(cast not on PATH)"
fi

# Indexer
if curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1; then
  log_line "Indexer" "running" "(http://127.0.0.1:${INDEXER_PORT})"
else
  log_line "Indexer" "stopped" "(http://127.0.0.1:${INDEXER_PORT})"
fi

echo ""
echo -e "${BLUE}Optional (usually laptop only):${NC}"
if curl -sf "http://127.0.0.1:5173" >/dev/null 2>&1; then
  log_line "Vite" "running" "(http://127.0.0.1:5173)"
else
  log_line "Vite" "stopped" "(http://127.0.0.1:5173)"
fi

echo ""
