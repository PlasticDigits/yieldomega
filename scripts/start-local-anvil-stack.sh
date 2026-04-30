#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# One-shot: Postgres (Docker) → Anvil → DeployDev → (optional) anvil_rich_state → (optional YIELDOMEGA_DEPLOY_KUMBAYA=1:
# DeployKumbayaAnvilFixtures + registry key TimeCurveBuyRouter + Kumbaya VITE_* in frontend/.env.local, GitLab #84) →
# registry JSON → reset indexer DB → indexer → frontend/.env.local (chain 31337 + contract addresses incl. FeeRouter, PodiumPool, ReferralRegistry, DoubPresaleVesting + indexer URL — GitLab #92).
#
# Optional **short per-wallet buy cooldown** on TimeCurve for multi-buy QA ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)):
#   YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 bash scripts/start-local-anvil-stack.sh
#   # or: YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=2 YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 …
# See docs/testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88 and docs/testing/manual-qa-checklists.md#manual-qa-issue-88.
#
# Set SKIP_ANVIL_RICH_STATE=1 to skip `contracts/script/anvil_rich_state.sh` (keeps TimeCurve sale **live**
# for bot/UI demos; indexer still indexes normal buys). Default runs rich state (sale ends, prizes, etc.).
#
# Bot swarm (3× fun/shark/pvp/defender/seed-local + 3× rando): one-shot CL8Y + ETH via YIELDOMEGA_ALLOW_ANVIL_FUNDING=1:
#   When SKIP_ANVIL_RICH_STATE=1, START_BOT_SWARM defaults to 1 (set START_BOT_SWARM=0 to skip).
#   When rich state runs (sale ended), START_BOT_SWARM defaults to 0.
#   Requires Python deps (import web3): venv install in bots/timecurve/README.md, or PEP 668 fallback there.
#
# Swarm + default 300s per-wallet buy cooldown + Anvil automine stalls chain time once every wallet sleeps (GitLab #99):
#   recommend YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 and/or explicit YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC for dense buys.
#   This script starts Anvil with --block-time when it spawns the swarm (interval mining advances block.timestamp during idle sleeps).
#   Override seconds: YIELDOMEGA_ANVIL_BLOCK_TIME_SEC (default 12); set to 0 to omit --block-time (automine only).
#
# Prerequisites: Docker, Foundry (anvil, forge, cast), jq, Node (for npm run dev).
# DeployDev uses forge --code-size-limit 524288 (EIP-170 pre-broadcast sim + MegaEVM-sized TimeCurve).
# Usage from repo root:
#   bash scripts/start-local-anvil-stack.sh
# Optional **full Kumbaya + buy-router parity** (same fixtures as `scripts/e2e-anvil.sh`; indexer ingests `BuyViaKumbaya` — GitLab #84):
#   YIELDOMEGA_DEPLOY_KUMBAYA=1 bash scripts/start-local-anvil-stack.sh
#
# Then:
#   cd frontend && npm run dev
# Open http://127.0.0.1:5173 — indexer panels should populate after catch-up (~seconds).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
FRONTEND="${ROOT}/frontend"
# shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
source "${ROOT}/scripts/lib/kumbaya_local_anvil_env.sh"
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

# True when DeployDev will use default 300s buyCooldownSec (both cooldown env knobs unset / no shortening path).
_deploydev_buy_cooldown_is_default_long() {
  [[ "${YIELDOMEGA_DEPLOY_NO_COOLDOWN:-0}" != "1" ]] && [[ -z "${YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC:-}" ]]
}

warn_swarm_buy_cooldown_if_needed() {
  if [[ "${SKIP_ANVIL_RICH_STATE:-}" != "1" ]] || [[ "${START_BOT_SWARM}" != "1" ]]; then
    return 0
  fi
  if ! _deploydev_buy_cooldown_is_default_long; then
    return 0
  fi
  echo "" >&2
  echo "Note (GitLab #99): SKIP_ANVIL_RICH_STATE=1 + START_BOT_SWARM=1 with default DeployDev buyCooldownSec=300." >&2
  echo "  For continuous indexer demo traffic, prefer: YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 (and optionally YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=…)." >&2
  echo "  Anvil is started with --block-time when this script launches it so sleeps still advance chain time." >&2
  echo "" >&2
}

die() {
  echo "$@" >&2
  exit 1
}

# Bot swarm imports web3 via bots/timecurve; fail fast with copy-paste fixes (PEP 668 / missing venv).
ensure_timecurve_bot_deps() {
  local py="$1"
  if "${py}" -c "import web3" >/dev/null 2>&1; then
    return 0
  fi
  echo "Bot swarm: Python cannot import 'web3' (install timecurve-bot deps first)." >&2
  echo "" >&2
  echo "  Recommended (venv):" >&2
  echo "    cd ${ROOT}/bots/timecurve && python3 -m venv .venv && .venv/bin/pip install -e \".[dev]\"" >&2
  echo "" >&2
  echo "  PEP 668 / bare QA host (user site):" >&2
  echo "    cd ${ROOT}/bots/timecurve && pip install -e \".[dev]\" --user --break-system-packages" >&2
  echo "" >&2
  echo "Then re-run this script, or set START_BOT_SWARM=0 to skip the swarm. See bots/timecurve/README.md (PEP 668)." >&2
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
    echo "Warning: reusing RPC — this script cannot apply --block-time; chain time may freeze between txs (GitLab #99). Restart Anvil with swarm from this script or use interval mining manually."
  fi
else
  ANVIL_EXTRA=()
  if [[ "${START_BOT_SWARM}" == "1" ]]; then
    ANVIL_EXTRA=(--accounts 30)
    ANVIL_BT="${YIELDOMEGA_ANVIL_BLOCK_TIME_SEC:-12}"
    if [[ "${ANVIL_BT}" != "0" ]]; then
      ANVIL_EXTRA+=(--block-time "${ANVIL_BT}")
      echo "Anvil interval mining: --block-time ${ANVIL_BT}s (GitLab #99; YIELDOMEGA_ANVIL_BLOCK_TIME_SEC=0 disables)."
    fi
  fi
  # MegaEVM 512 KiB max deployed code (524288 = 0x80000) — Anvil's --code-size-limit is decimal only.
  anvil --host 127.0.0.1 --port "${ANVIL_PORT}" --code-size-limit 524288 "${ANVIL_EXTRA[@]}" >/tmp/yieldomega_anvil_stack.log 2>&1 &
  echo $! > /tmp/yieldomega_anvil_stack.pid
  for _ in $(seq 1 30); do
    cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1 && break
    sleep 0.2
  done
fi
cast block-number --rpc-url "${RPC_URL}" >/dev/null || die "No RPC at ${RPC_URL}"

warn_swarm_buy_cooldown_if_needed

echo "=== Deploy (DeployDev) ==="
cd "${CONTRACTS}"
if [[ "${YIELDOMEGA_DEPLOY_NO_COOLDOWN:-0}" == "1" ]] || [[ -n "${YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC:-}" ]]; then
  echo "TimeCurve buyCooldownSec override (GitLab #88): YIELDOMEGA_DEPLOY_NO_COOLDOWN=${YIELDOMEGA_DEPLOY_NO_COOLDOWN:-0} YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=${YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC:-<unset>}"
fi
# --optimizer-runs 1 keeps TimeCurve bytecode size stable for local / MegaEVM (512 KiB) deploys
# (default 200 can bloat with via_ir on some compiler stacks).
# --code-size-limit: Forge simulates locally before broadcast and enforces EIP-170 unless raised;
# Anvil's --code-size-limit does not affect that dry-run path.
DEPLOY_LOG="/tmp/yieldomega_deploy_dev.log"
env -u RESERVE_ASSET_ADDRESS -u USDM_ADDRESS forge script script/DeployDev.s.sol:DeployDev \
  --broadcast --rpc-url "${RPC_URL}" --optimizer-runs 1 --code-size-limit 524288 -vv > "${DEPLOY_LOG}" 2>&1
[[ -f "${RUN_JSON}" ]] || { tail -n 60 "${DEPLOY_LOG}" >&2; die "Missing ${RUN_JSON} (see ${DEPLOY_LOG})"; }

if [[ "${SKIP_ANVIL_RICH_STATE:-}" == "1" ]]; then
  echo "=== Simulate (rich state) === SKIPPED (SKIP_ANVIL_RICH_STATE=1)"
else
  echo "=== Simulate (rich state) ==="
  bash "${CONTRACTS}/script/anvil_rich_state.sh"
fi

echo "=== Write ${REGISTRY_OUT} ==="
# Most contracts (TimeCurve, RabbitTreasury, FeeRouter, ReferralRegistry,
# PodiumPool, …) live behind ERC1967 proxies. The broadcast JSON's `contractName`
# labels the impl, not the proxy, so we grep the `console.log` lines emitted by
# `DeployDev.s.sol` instead (same approach as `scripts/lib/anvil_deploy_dev.sh`).
extract_addr_from_log() {
  local label="$1"
  grep -E "^[[:space:]]*${label}:" "${DEPLOY_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1
}
TC="$(extract_addr_from_log "TimeCurve")"
RT="$(extract_addr_from_log "RabbitTreasury")"
FR="$(extract_addr_from_log "FeeRouter")"
RR="$(extract_addr_from_log "ReferralRegistry")"
PP="$(extract_addr_from_log "PodiumPool")"
NFT="$(extract_addr_from_log "LeprechaunNFT")"
DPV="$(extract_addr_from_log "DoubPresaleVesting")"
for var_name in TC RT FR RR PP NFT DPV; do
  [[ -n "${!var_name}" ]] || die "Could not parse ${var_name} from ${DEPLOY_LOG}."
done
MIN_HEX="$(jq -r '[.receipts[] | .blockNumber] | min' "${RUN_JSON}")"
DEPLOY_BLOCK="$(cast to-dec "${MIN_HEX}")"

KUMBAYA_WETH=""
KUMBAYA_USDM=""
KUMBAYA_ROUTER=""
KUMBAYA_BUY_ROUTER=""
if [[ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" == "1" ]]; then
  echo "=== DeployKumbayaAnvilFixtures (YIELDOMEGA_DEPLOY_KUMBAYA=1 — GitLab #84) ==="
  KUMBAYA_LOG="$(mktemp)"
  export PRIVATE_KEY="${DEPLOYER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
  forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
    --rpc-url "${RPC_URL}" --optimizer-runs 1 --code-size-limit 524288 --sig "run(address)" "${TC}" 2>&1 | tee "${KUMBAYA_LOG}"
  yieldomega_kumbaya_extract_from_deploy_log "${KUMBAYA_LOG}"
  rm -f "${KUMBAYA_LOG}"
  [[ -n "${KUMBAYA_BUY_ROUTER}" ]] || die "DeployKumbayaAnvilFixtures: could not parse TimeCurveBuyRouter from log."
  echo "  Kumbaya fixtures + TimeCurveBuyRouter deployed onchain."
fi

jq -n \
  --argjson chainId 31337 \
  --arg tc "${TC}" \
  --arg rt "${RT}" \
  --arg nft "${NFT}" \
  --arg fr "${FR}" \
  --arg pp "${PP}" \
  --arg rr "${RR}" \
  --arg dpv "${DPV}" \
  --arg tcbr "${KUMBAYA_BUY_ROUTER:-}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "Generated by scripts/start-local-anvil-stack.sh — do not commit secrets.",
    chainId: $chainId,
    contracts: (
      { TimeCurve: $tc, RabbitTreasury: $rt, LeprechaunNFT: $nft, FeeRouter: $fr, PodiumPool: $pp, ReferralRegistry: $rr, DoubPresaleVesting: $dpv }
      + (if $tcbr != "" then {TimeCurveBuyRouter: $tcbr} else {} end)
    ),
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
# VITE_CHAIN_ID matches frontend dev default when env is unset (GitLab #81).
VITE_CHAIN_ID=31337
VITE_RPC_URL=${RPC_URL}
VITE_TIMECURVE_ADDRESS=${TC}
VITE_RABBIT_TREASURY_ADDRESS=${RT}
VITE_LEPRECHAUN_NFT_ADDRESS=${NFT}
VITE_FEE_ROUTER_ADDRESS=${FR}
VITE_REFERRAL_REGISTRY_ADDRESS=${RR}
VITE_DOUB_PRESALE_VESTING_ADDRESS=${DPV}
VITE_INDEXER_URL=http://127.0.0.1:${INDEXER_PORT}
EOF

if [[ -n "${KUMBAYA_WETH}" && -n "${KUMBAYA_USDM}" && -n "${KUMBAYA_ROUTER}" && -n "${KUMBAYA_BUY_ROUTER}" ]]; then
  yieldomega_frontend_merge_kumbaya_vite_full "${FRONTEND}/.env.local" "${KUMBAYA_WETH}" "${KUMBAYA_USDM}" "${KUMBAYA_ROUTER}" "${KUMBAYA_BUY_ROUTER}"
  echo "  Kumbaya VITE_* merged into ${FRONTEND}/.env.local (GitLab #84)."
fi

# Optional: schedule the LaunchCountdownPage → TimeCurveSimplePage handoff (issue #40).
# Set LAUNCH_OFFSET_SEC=N to make the launch fire N seconds from "now". Use small
# values (e.g. 60–120) to watch the countdown gate flip on the local frontend.
if [[ -n "${LAUNCH_OFFSET_SEC:-}" ]]; then
  if ! [[ "${LAUNCH_OFFSET_SEC}" =~ ^-?[0-9]+$ ]]; then
    die "LAUNCH_OFFSET_SEC must be an integer (got: '${LAUNCH_OFFSET_SEC}')."
  fi
  NOW_SEC="$(date +%s)"
  LAUNCH_TS=$((NOW_SEC + LAUNCH_OFFSET_SEC))
  echo "VITE_LAUNCH_TIMESTAMP=${LAUNCH_TS}" >> "${FRONTEND}/.env.local"
  echo "  LaunchCountdownPage will hand off in ${LAUNCH_OFFSET_SEC}s (VITE_LAUNCH_TIMESTAMP=${LAUNCH_TS})."
fi

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
  ensure_timecurve_bot_deps "${BOT_PY}"
  ( cd "${ROOT}" && export YIELDOMEGA_ALLOW_ANVIL_FUNDING=1 && PYTHONPATH="${ROOT}/bots/timecurve/src" "${BOT_PY}" -c "from timecurve_bot.swarm_runner import run_swarm; run_swarm()" ) \
    || die "Bot swarm failed (unexpected error after deps check; see /tmp/yieldomega_swarm_*.log)."
  echo "  Logs: /tmp/yieldomega_swarm_*.log   PIDs: /tmp/yieldomega_bot_swarm.pids"
fi
