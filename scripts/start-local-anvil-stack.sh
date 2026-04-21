#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# One-shot: Postgres (Docker) → Anvil → DeployDev → (optional) anvil_rich_state → registry JSON →
# reset indexer DB → indexer → frontend/.env.local (chain 31337 + contract addresses incl. FeeRouter, PodiumPool, ReferralRegistry + indexer URL).
#
# Set SKIP_ANVIL_RICH_STATE=1 to skip `contracts/script/anvil_rich_state.sh` (keeps TimeCurve sale **live**
# for bot/UI demos; indexer still indexes normal buys). Default runs rich state (sale ends, prizes, etc.).
#
# Bot swarm (3× fun/shark/pvp/defender/seed-local + 3× rando): one-shot CL8Y + ETH via YIELDOMEGA_ALLOW_ANVIL_FUNDING=1:
#   When SKIP_ANVIL_RICH_STATE=1, START_BOT_SWARM defaults to 1 (set START_BOT_SWARM=0 to skip).
#   When rich state runs (sale ended), START_BOT_SWARM defaults to 0.
#   Requires Python deps: `cd bots/timecurve && pip install -e .`
#
# Prerequisites: Docker, Foundry (anvil, forge, cast), jq, Node (for npm run dev).
# Usage from repo root:
#   bash scripts/start-local-anvil-stack.sh
#
# Then:
#   cd frontend && npm run dev
# Open http://127.0.0.1:5173 — indexer panels should populate after catch-up (~seconds).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
FRONTEND="${ROOT}/frontend"
RUN_JSON="${CONTRACTS}/broadcast/DeployDev.s.sol/31337/run-latest.json"
REGISTRY_OUT="${CONTRACTS}/deployments/local-anvil-registry.json"

ANVIL_PORT="${ANVIL_PORT:-8545}"
RPC_URL="${RPC_URL:-http://127.0.0.1:${ANVIL_PORT}}"
PG_HOST_PORT="${PG_HOST_PORT:-5433}"
INDEXER_PORT="${INDEXER_PORT:-3100}"
DOCKER_PG="${DOCKER_PG:-yieldomega-pg}"

if [[ "${SKIP_ANVIL_RICH_STATE:-}" == "1" ]]; then
  START_BOT_SWARM="${START_BOT_SWARM:-1}"
else
  START_BOT_SWARM="${START_BOT_SWARM:-0}"
fi

export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS}/out-local-dev}"
mkdir -p "${FOUNDRY_OUT}"
export RPC_URL

die() {
  echo "$@" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "Need docker for Postgres."
command -v forge >/dev/null 2>&1 || die "Need Foundry (forge)."
command -v cast >/dev/null 2>&1 || die "Need cast."
command -v jq >/dev/null 2>&1 || die "Need jq."
command -v curl >/dev/null 2>&1 || die "Need curl."

# Pick a free indexer port if the default is taken.
pick_indexer_port() {
  local p="${INDEXER_PORT}"
  local try
  for try in $(seq 0 15); do
    local cand=$((INDEXER_PORT + try))
    if ! ss -tlnp 2>/dev/null | grep -qE ":${cand}\\s"; then
      echo "${cand}"
      return 0
    fi
  done
  echo "${p}"
}

if [[ "${QA_USE_FIXED_INDEXER_PORT:-}" == "1" ]]; then
  INDEXER_PORT="${INDEXER_PORT:-3100}"
else
  INDEXER_PORT="$(pick_indexer_port)"
fi

echo "=== Postgres (${DOCKER_PG} on localhost:${PG_HOST_PORT}) ==="
if docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_PG}$"; then
  pg_host_ip="$(docker inspect "${DOCKER_PG}" 2>/dev/null | jq -r '.[0].HostConfig.PortBindings["5432/tcp"][0].HostIp // ""')"
  # Empty HostIp means Docker published to 0.0.0.0 — recreate so QA only listens on loopback.
  if [[ "${pg_host_ip}" != "127.0.0.1" ]]; then
    echo "Recreating ${DOCKER_PG} for 127.0.0.1:${PG_HOST_PORT} bind (was HostIp='${pg_host_ip:-empty}')."
    docker rm -f "${DOCKER_PG}" >/dev/null
  fi
fi
if docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_PG}$"; then
  if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_PG}$"; then
    docker start "${DOCKER_PG}" >/dev/null
  fi
else
  docker run -d --name "${DOCKER_PG}" -p "127.0.0.1:${PG_HOST_PORT}:5432" \
    -e POSTGRES_USER=yieldomega \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=yieldomega_indexer \
    postgres:16-alpine >/dev/null
fi
for _ in $(seq 1 30); do
  docker exec "${DOCKER_PG}" pg_isready -U yieldomega -d yieldomega_indexer >/dev/null 2>&1 && break
  sleep 1
done
docker exec "${DOCKER_PG}" pg_isready -U yieldomega -d yieldomega_indexer >/dev/null || die "Postgres not ready."

echo "=== Anvil (${RPC_URL}) ==="
if ss -tlnp 2>/dev/null | grep -qE ":${ANVIL_PORT}\\s"; then
  echo "Port ${ANVIL_PORT} already in use — reusing existing RPC (ensure it is Anvil chain 31337)."
  if [[ "${START_BOT_SWARM}" == "1" ]]; then
    echo "Warning: START_BOT_SWARM=1 needs Anvil with at least 30 dev accounts; existing node may have only 10."
  fi
else
  ANVIL_EXTRA=()
  if [[ "${START_BOT_SWARM}" == "1" ]]; then
    ANVIL_EXTRA=(--accounts 30)
  fi
  anvil --host 127.0.0.1 --port "${ANVIL_PORT}" "${ANVIL_EXTRA[@]}" >/tmp/yieldomega_anvil_stack.log 2>&1 &
  echo $! > /tmp/yieldomega_anvil_stack.pid
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1 && break
    sleep 0.2
  done
fi
cast block-number --rpc-url "${RPC_URL}" >/dev/null || die "No RPC at ${RPC_URL}"

echo "=== Deploy (DeployDev) ==="
cd "${CONTRACTS}"
env -u RESERVE_ASSET_ADDRESS -u USDM_ADDRESS forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "${RPC_URL}" >/dev/null
[[ -f "${RUN_JSON}" ]] || die "Missing ${RUN_JSON}"

if [[ "${SKIP_ANVIL_RICH_STATE:-}" == "1" ]]; then
  echo "=== Simulate (rich state) === SKIPPED (SKIP_ANVIL_RICH_STATE=1)"
else
  echo "=== Simulate (rich state) ==="
  bash "${CONTRACTS}/script/anvil_rich_state.sh"
fi

echo "=== Write ${REGISTRY_OUT} ==="
TC="$(jq -r '.transactions[] | select(.contractName=="TimeCurve") | .contractAddress' "${RUN_JSON}" | head -1)"
RT="$(jq -r '.transactions[] | select(.contractName=="RabbitTreasury") | .contractAddress' "${RUN_JSON}" | head -1)"
NFT="$(jq -r '.transactions[] | select(.contractName=="LeprechaunNFT") | .contractAddress' "${RUN_JSON}" | head -1)"
FR="$(jq -r '.transactions[] | select(.contractName=="FeeRouter") | .contractAddress' "${RUN_JSON}" | head -1)"
PP="$(jq -r '.transactions[] | select(.contractName=="PodiumPool") | .contractAddress' "${RUN_JSON}" | head -1)"
RR="$(jq -r '.transactions[] | select(.contractName=="ReferralRegistry") | .contractAddress' "${RUN_JSON}" | head -1)"
MIN_HEX="$(jq -r '[.receipts[] | .blockNumber] | min' "${RUN_JSON}")"
DEPLOY_BLOCK="$(cast to-dec "${MIN_HEX}")"

jq -n \
  --argjson chainId 31337 \
  --arg tc "${TC}" \
  --arg rt "${RT}" \
  --arg nft "${NFT}" \
  --arg fr "${FR}" \
  --arg pp "${PP}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "Generated by scripts/start-local-anvil-stack.sh — do not commit secrets.",
    chainId: $chainId,
    contracts: { TimeCurve: $tc, RabbitTreasury: $rt, LeprechaunNFT: $nft, FeeRouter: $fr, PodiumPool: $pp, ReferralRegistry: $rr },
    deployBlock: $deployBlock
  }' > "${REGISTRY_OUT}"

echo "=== Reset indexer database ==="
docker exec "${DOCKER_PG}" psql -U yieldomega -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yieldomega_indexer' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
# DROP/CREATE must be separate invocations (not one transaction).
docker exec "${DOCKER_PG}" psql -U yieldomega -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS yieldomega_indexer;" >/dev/null
docker exec "${DOCKER_PG}" psql -U yieldomega -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE yieldomega_indexer OWNER yieldomega;" >/dev/null

echo "=== Start indexer (127.0.0.1:${INDEXER_PORT}) ==="
if [[ -f /tmp/yieldomega_indexer_stack.pid ]]; then
  kill "$(cat /tmp/yieldomega_indexer_stack.pid)" 2>/dev/null || true
fi
export DATABASE_URL="postgres://yieldomega:password@127.0.0.1:${PG_HOST_PORT}/yieldomega_indexer"
export CHAIN_ID=31337
export START_BLOCK=0
export ADDRESS_REGISTRY_PATH="${REGISTRY_OUT}"
export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
export INGESTION_ENABLED=true
cd "${ROOT}/indexer"
cargo build --release 2>/dev/null || cargo build
cargo run --release >> /tmp/yieldomega_indexer_stack.log 2>&1 &
echo $! > /tmp/yieldomega_indexer_stack.pid

for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null || die "Indexer did not become ready at http://127.0.0.1:${INDEXER_PORT}/v1/status (see /tmp/yieldomega_indexer_stack.log)."

echo "=== Write ${FRONTEND}/.env.local ==="
cat > "${FRONTEND}/.env.local" << EOF
# Generated by scripts/start-local-anvil-stack.sh — local Anvil + indexer.
VITE_CHAIN_ID=31337
VITE_RPC_URL=${RPC_URL}
VITE_TIMECURVE_ADDRESS=${TC}
VITE_RABBIT_TREASURY_ADDRESS=${RT}
VITE_LEPRECHAUN_NFT_ADDRESS=${NFT}
VITE_FEE_ROUTER_ADDRESS=${FR}
VITE_REFERRAL_REGISTRY_ADDRESS=${RR}
VITE_INDEXER_URL=http://127.0.0.1:${INDEXER_PORT}
EOF

echo ""
echo "Stack is up."
echo "  RPC:        ${RPC_URL}"
echo "  Indexer:    http://127.0.0.1:${INDEXER_PORT}"
echo "  Registry:   ${REGISTRY_OUT}"
echo "  Frontend:   ${FRONTEND}/.env.local"
echo ""
echo "Next:"
echo "  make check-frontend-env   # optional: verify VITE_* in frontend/.env.local"
echo "  bash scripts/sync-bot-env-from-frontend.sh   # bots/timecurve/.env.local (no redeploy)"
echo "  cd frontend && npm run dev"
echo "  Open http://127.0.0.1:5173"
echo ""
echo "Smoke (indexer):"
echo "  curl -s http://127.0.0.1:${INDEXER_PORT}/v1/timecurve/buys?limit=5 | jq ."

if [[ "${START_BOT_SWARM}" == "1" ]]; then
  echo ""
  echo "=== Bot swarm (START_BOT_SWARM=1) ==="
  chmod +x "${ROOT}/scripts/sync-bot-env-from-frontend.sh" 2>/dev/null || true
  bash "${ROOT}/scripts/sync-bot-env-from-frontend.sh"
  BOT_PY="python3"
  if [[ -x "${ROOT}/bots/timecurve/.venv/bin/python" ]]; then
    BOT_PY="${ROOT}/bots/timecurve/.venv/bin/python"
  fi
  ( cd "${ROOT}" && export YIELDOMEGA_ALLOW_ANVIL_FUNDING=1 && PYTHONPATH="${ROOT}/bots/timecurve/src" "${BOT_PY}" -c "from timecurve_bot.swarm_runner import run_swarm; run_swarm()" ) \
    || die "Bot swarm failed (install: cd bots/timecurve && pip install -e .)"
  echo "  Logs: /tmp/yieldomega_swarm_*.log   PIDs: /tmp/yieldomega_bot_swarm.pids"
fi
