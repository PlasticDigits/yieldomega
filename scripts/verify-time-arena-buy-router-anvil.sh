#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #251 / #270 — verify DeployDev + DeployKumbayaAnvilFixtures + TimeArenaBuyRouter on Anvil.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
source "${ROOT}/scripts/lib/kumbaya_local_anvil_env.sh"
CONTRACTS="${ROOT}/contracts"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
REGISTRY_DEFAULT="${CONTRACTS}/deployments/local-anvil-registry.json"
DEPLOYER_PK="${DEPLOYER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
PORT="${ANVIL_PORT:-8545}"

die() {
  echo "verify-time-arena-buy-router-anvil: $*" >&2
  exit 1
}

if ! command -v cast >/dev/null 2>&1 || ! command -v forge >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  die "need cast, forge, and jq in PATH."
fi

TA="${YIELDOMEGA_TIME_ARENA:-}"
if [[ -z "${TA}" ]] && [[ -f "${REGISTRY_DEFAULT}" ]]; then
  TA="$(jq -r '.contracts.TimeArena // empty' "${REGISTRY_DEFAULT}")"
fi

_start_anvil_if_needed() {
  if cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1; then
    return 0
  fi
  if [[ "${YIELDOMEGA_VERIFY_NO_ANVIL_RESTART:-0}" == "1" ]]; then
    die "Anvil not reachable at ${RPC_URL} and YIELDOMEGA_VERIFY_NO_ANVIL_RESTART=1."
  fi
  echo "=== Starting Anvil on ${RPC_URL} ==="
  anvil --host 127.0.0.1 --port "${PORT}" --code-size-limit 524288 >/tmp/yieldomega_verify_tabr_anvil.log 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 60); do
    if cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  die "Anvil did not become ready at ${RPC_URL}."
}

_deploy_stack() {
  export ROOT RPC="${RPC_URL}" DEPLOY_LOG
  DEPLOY_LOG="$(mktemp)"
  # shellcheck source=scripts/lib/anvil_deploy_dev.sh
  source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"
  export YIELDOMEGA_DEPLOY_KUMBAYA=1
  yieldomega_anvil_deploy_dev || die "yieldomega_anvil_deploy_dev failed."
  yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"
  yieldomega_export_kumbaya_addrs_from_log "${DEPLOY_LOG}"
  rm -f "${DEPLOY_LOG}"
}

if ! cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1; then
  _start_anvil_if_needed
  _deploy_stack
elif [[ -z "${TA}" || "${TA}" == "null" || "${TA}" == "0x0000000000000000000000000000000000000000" ]]; then
  _deploy_stack
fi

[[ -n "${TA}" && "${TA}" != "null" ]] || die "Set YIELDOMEGA_TIME_ARENA or deploy via this script."

BR_HEX="$(tr -d '[:space:]' <<<"$(cast call "${TA}" "timeArenaBuyRouter()(address)" --rpc-url "${RPC_URL}")")"
BR_ONCHAIN="$(cast to-checksum "${BR_HEX}" 2>/dev/null || echo "")"
if [[ -z "${BR_ONCHAIN}" || "${BR_ONCHAIN}" == "0x0000000000000000000000000000000000000000" ]]; then
  if [[ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" != "1" ]]; then
    die "TimeArena.timeArenaBuyRouter is zero. Re-run with YIELDOMEGA_DEPLOY_KUMBAYA=1 or use scripts/e2e-anvil.sh."
  fi
  echo "=== DeployKumbayaAnvilFixtures (broadcast) for TA=${TA} ==="
  KUMBAYA_LOG="$(mktemp)"
  (
    cd "${CONTRACTS}"
    export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS}/out-verify-tabr}"
    export PRIVATE_KEY="${DEPLOYER_PK}"
    mkdir -p "${FOUNDRY_OUT}"
    forge build --quiet
    forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
      --rpc-url "${RPC_URL}" --code-size-limit 524288 --sig "run(address)" "${TA}" 2>&1 | tee "${KUMBAYA_LOG}"
  )
  yieldomega_kumbaya_extract_from_deploy_log "${KUMBAYA_LOG}"
  rm -f "${KUMBAYA_LOG}"
  [[ -n "${KUMBAYA_BUY_ROUTER}" ]] || die "Could not parse TimeArenaBuyRouter from forge log."
  BR_ONCHAIN="$(cast to-checksum "${KUMBAYA_BUY_ROUTER}" 2>/dev/null || echo "${KUMBAYA_BUY_ROUTER}")"
fi

BR_HEX="$(tr -d '[:space:]' <<<"$(cast call "${TA}" "timeArenaBuyRouter()(address)" --rpc-url "${RPC_URL}")")"
BR_READ="$(cast to-checksum "${BR_HEX}" 2>/dev/null || echo "")"
[[ -n "${BR_READ}" && "${BR_READ}" != "0x0000000000000000000000000000000000000000" ]] \
  || die "TimeArena.timeArenaBuyRouter is still zero."

PAUSED_RAW="$(tr -d '[:space:]' <<<"$(cast call "${TA}" "paused()(bool)" --rpc-url "${RPC_URL}" 2>/dev/null || echo "")")"
if [[ "${PAUSED_RAW}" == "true" || "${PAUSED_RAW}" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]]; then
  die "TimeArena.paused is true."
fi

_cast_uint_dec() {
  tr -d '[:space:]' <<<"$1" | sed -E 's/\[.*//'
}

ARENA_START="$(_cast_uint_dec "$(cast call "${TA}" "arenaStart()(uint256)" --rpc-url "${RPC_URL}" 2>/dev/null || echo 0)")"
[[ -n "${ARENA_START}" && "${ARENA_START}" != "0" ]] || die "TimeArena.arenaStart is zero (arena not started)."

if [[ -f "${REGISTRY_DEFAULT}" ]]; then
  yieldomega_registry_merge_timearena_buy_router "${REGISTRY_DEFAULT}" "${BR_READ}"
  echo "Merged contracts.TimeArenaBuyRouter=${BR_READ} into ${REGISTRY_DEFAULT}."
fi

FRONTEND_ENV="${ROOT}/frontend/.env.local"
if [[ -n "${KUMBAYA_WETH:-}" && -n "${KUMBAYA_USDM:-}" && -n "${KUMBAYA_ROUTER:-}" ]]; then
  yieldomega_frontend_merge_kumbaya_vite_full "${FRONTEND_ENV}" "${KUMBAYA_WETH}" "${KUMBAYA_USDM}" "${KUMBAYA_ROUTER}" "${BR_READ}"
else
  yieldomega_frontend_merge_vite_kumbaya_buy_router_only "${FRONTEND_ENV}" "${BR_READ}"
fi

echo "=== forge test TimeArenaBuyRouter ==="
(
  cd "${CONTRACTS}"
  forge test --match-contract TimeArenaBuyRouter -q
)

export FORK_URL="${RPC_URL}"
export YIELDOMEGA_FORK_VERIFY=1
export YIELDOMEGA_TIME_ARENA="${TA}"
export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS}/out-verify-tabr-fork}"
mkdir -p "${FOUNDRY_OUT}"

echo "=== forge test (fork): VerifyTimeArenaBuyRouterAnvil.t.sol ==="
(
  cd "${CONTRACTS}"
  forge test --match-path "test/VerifyTimeArenaBuyRouterAnvil.t.sol" --match-test "test_Forked_issue251" -vv
)

echo "=== verify-time-arena-buy-router-anvil: OK ==="
echo "  TimeArena: ${TA}"
echo "  timeArenaBuyRouter: ${BR_READ}"
