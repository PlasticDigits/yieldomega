#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Shared DeployDev.s.sol deploy + address extraction for Anvil workflows.
#
# yieldomega_anvil_deploy_dev does NOT assign TA/PV/DOUB/… in the caller shell (GitLab #289).
# After deploy, call yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}".
# For Kumbaya fixtures (YIELDOMEGA_DEPLOY_KUMBAYA=1), also:
#   yieldomega_export_kumbaya_addrs_from_log "${DEPLOY_LOG}"
#
# TimeArena buy cooldown: YIELDOMEGA_DEPLOY_NO_COOLDOWN=1 / YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC (#88).
# MockReserveCl8y extraction + safe PID cleanup: GitLab #279.

# Kill only when pid is a positive integer — never `kill 0` (process group) on unset vars (#279).
_yieldomega_kill_pid_if_set() {
  local pid="${1:-}"
  if [[ -n "${pid}" ]] && [[ "${pid}" =~ ^[0-9]+$ ]] && [[ "${pid}" -gt 0 ]]; then
    kill "${pid}" 2>/dev/null || true
  fi
}

_yieldomega_extract_addr_from_log() {
  local log="$1"
  local label="$2"
  # Prefer `Label: 0x…` lines; fall back to any line mentioning label (legacy forge logs).
  local addr
  # Last `Label:` line matches on-chain broadcast (simulation may log earlier addresses).
  addr="$(grep -E "^[[:space:]]*${label}:" "${log}" 2>/dev/null | grep -oE '0x[a-fA-F0-9]{40}' | tail -1 || true)"
  if [[ -z "${addr}" ]]; then
    addr="$(grep -E "${label}" "${log}" 2>/dev/null | grep -oE '0x[a-fA-F0-9]{40}' | tail -1 || true)"
  fi
  printf '%s' "${addr}"
}

_yieldomega_extract_mock_cl8y_from_broadcast() {
  local run_json="$1"
  [[ -f "${run_json}" ]] || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      [.transactions[]? | select(.contractName == "MockReserveCl8y") | .contractAddress? // empty]
      | map(select(test("^0x[a-fA-F0-9]{40}$")))
      | last // empty
    ' "${run_json}" 2>/dev/null || true
    return 0
  fi
  python3 - "${run_json}" <<'PY' 2>/dev/null || true
import json, re, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
addrs = []
for tx in data.get("transactions") or []:
    if tx.get("contractName") != "MockReserveCl8y":
        continue
    addr = tx.get("contractAddress") or ""
    if re.fullmatch(r"0x[a-fA-F0-9]{40}", addr):
        addrs.append(addr)
if addrs:
    print(addrs[-1])
PY
}

_yieldomega_resolve_mock_cl8y_addr() {
  local deploy_log="$1"
  local root="${2:-}"
  local cl8y run_json
  cl8y="$(_yieldomega_extract_addr_from_log "${deploy_log}" "MockReserveCl8y")"
  if [[ -n "${cl8y}" ]]; then
    printf '%s' "${cl8y}"
    return 0
  fi
  if [[ -n "${root}" ]]; then
    run_json="${root}/contracts/broadcast/DeployDev.s.sol/31337/run-latest.json"
    cl8y="$(_yieldomega_extract_mock_cl8y_from_broadcast "${run_json}")"
    if [[ -n "${cl8y}" ]]; then
      echo "MockReserveCl8y: resolved ${cl8y} from ${run_json} (deploy log grep missed address — GitLab #279)." >&2
      printf '%s' "${cl8y}"
      return 0
    fi
  fi
  printf '%s' ""
}

# Explicit export API — sets TA, PV, RR, DOUB, CRED, CL8Y in the caller shell (GitLab #289).
yieldomega_export_deploy_addrs_from_log() {
  local deploy_log="${1:-${DEPLOY_LOG:-}}"
  local root="${2:-${ROOT:-}}"
  if [[ -z "${deploy_log}" ]]; then
    echo "yieldomega_export_deploy_addrs_from_log: need deploy log path or DEPLOY_LOG." >&2
    return 1
  fi
  TA="$(_yieldomega_extract_addr_from_log "${deploy_log}" "TimeArena")"
  PV="$(_yieldomega_extract_addr_from_log "${deploy_log}" "PodiumVaults")"
  RR="$(_yieldomega_extract_addr_from_log "${deploy_log}" "ReferralRegistry")"
  DOUB="$(_yieldomega_extract_addr_from_log "${deploy_log}" "Doubloon")"
  CRED="$(_yieldomega_extract_addr_from_log "${deploy_log}" "PlayCred")"
  CL8Y="$(_yieldomega_resolve_mock_cl8y_addr "${deploy_log}" "${root}")"
}

# Sets KUMBAYA_WETH, KUMBAYA_USDM, KUMBAYA_ROUTER, KUMBAYA_BUY_ROUTER in caller scope.
yieldomega_export_kumbaya_addrs_from_log() {
  local deploy_log="${1:-${DEPLOY_LOG:-}}"
  if [[ -z "${deploy_log}" ]]; then
    echo "yieldomega_export_kumbaya_addrs_from_log: need deploy log path or DEPLOY_LOG." >&2
    return 1
  fi
  # shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/kumbaya_local_anvil_env.sh"
  yieldomega_kumbaya_extract_from_deploy_log "${deploy_log}"
}

yieldomega_anvil_deploy_dev() {
  if [ -z "${ROOT:-}" ] || [ -z "${RPC:-}" ] || [ -z "${DEPLOY_LOG:-}" ]; then
    echo "yieldomega_anvil_deploy_dev: need ROOT, RPC, and DEPLOY_LOG set." >&2
    return 1
  fi
  local ta pv rr doub cred cl8y
  local kumbaya_weth kumbaya_usdm kumbaya_router kumbaya_buy_router
  local onchain_br exp_br

  echo "Building contracts and deploying DeployDev (Arena v2)..."
  cd "${ROOT}/contracts"
  export FOUNDRY_OUT="${ROOT}/contracts/out-e2e-anvil"
  mkdir -p "${FOUNDRY_OUT}"
  # shellcheck source=scripts/lib/anvil_deployer_key.sh
  source "${ROOT}/scripts/lib/anvil_deployer_key.sh"
  yieldomega_export_deploy_private_key
  if [[ "${YIELDOMEGA_SEED_EVM_DEV_WALLETS:-1}" = "1" ]]; then
    yieldomega_export_seed_minter_address_if_needed
  fi
  forge build
  if ! forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "${RPC}" \
    --code-size-limit 524288 -vv 2>&1 | tee "${DEPLOY_LOG}"; then
    echo "DeployDev broadcast failed (see ${DEPLOY_LOG})." >&2
    return 1
  fi

  ta="$(_yieldomega_extract_addr_from_log "${DEPLOY_LOG}" "TimeArena")"
  pv="$(_yieldomega_extract_addr_from_log "${DEPLOY_LOG}" "PodiumVaults")"
  rr="$(_yieldomega_extract_addr_from_log "${DEPLOY_LOG}" "ReferralRegistry")"
  doub="$(_yieldomega_extract_addr_from_log "${DEPLOY_LOG}" "Doubloon")"
  cred="$(_yieldomega_extract_addr_from_log "${DEPLOY_LOG}" "PlayCred")"

  if [ -z "${ta}" ] || [ -z "${pv}" ] || [ -z "${rr}" ]; then
    echo "Could not parse deploy addresses. Expected TimeArena, PodiumVaults, ReferralRegistry." >&2
    return 1
  fi

  echo "Addresses: TimeArena=${ta} PodiumVaults=${pv} ReferralRegistry=${rr} Doubloon=${doub} PlayCred=${cred}"

  if [ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" = "1" ]; then
    echo "Deploying Kumbaya Anvil fixtures (YIELDOMEGA_DEPLOY_KUMBAYA=1)..."
    # Let DeployDev txs settle before the second broadcast (avoids Anvil nonce races).
    sleep 2
    _yieldomega_kumbaya_deploy_once() {
      forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
        --rpc-url "${RPC}" --code-size-limit 524288 --sig "run(address)" "${ta}" 2>&1 | tee -a "${DEPLOY_LOG}"
    }
    if ! _yieldomega_kumbaya_deploy_once; then
      echo "Kumbaya deploy failed; retrying once after 3s..." >&2
      sleep 3
      _yieldomega_kumbaya_deploy_once || return 1
    fi
    # shellcheck source=scripts/lib/kumbaya_local_anvil_env.sh
    source "${ROOT}/scripts/lib/kumbaya_local_anvil_env.sh"
    yieldomega_kumbaya_extract_from_deploy_log "${DEPLOY_LOG}"
    kumbaya_weth="${KUMBAYA_WETH:-}"
    kumbaya_usdm="${KUMBAYA_USDM:-}"
    kumbaya_router="${KUMBAYA_ROUTER:-}"
    kumbaya_buy_router="${KUMBAYA_BUY_ROUTER:-}"
    if [ -z "${kumbaya_buy_router}" ]; then
      echo "DeployKumbayaAnvilFixtures: could not parse TimeArenaBuyRouter from log." >&2
      return 1
    fi
    onchain_br="$(cast call "${ta}" "timeArenaBuyRouter()(address)" --rpc-url "${RPC}" 2>/dev/null | tr -d '[:space:]')"
    onchain_br="$(cast to-checksum "${onchain_br}" 2>/dev/null || echo "")"
    exp_br="$(cast to-checksum "${kumbaya_buy_router}" 2>/dev/null || echo "${kumbaya_buy_router}")"
    if [ -z "${onchain_br}" ] || [ "${onchain_br,,}" != "${exp_br,,}" ]; then
      echo "TimeArena.timeArenaBuyRouter (${onchain_br}) != deployed ${exp_br}" >&2
      return 1
    fi
    echo "Kumbaya: WETH=${kumbaya_weth} USDM=${kumbaya_usdm} Router=${kumbaya_router} TimeArenaBuyRouter=${kumbaya_buy_router}"
  fi

  if [ "${YIELDOMEGA_SEED_EVM_DEV_WALLETS:-1}" = "1" ] && [ -n "${doub:-}" ] && [ -n "${cred:-}" ]; then
    cl8y="$(_yieldomega_resolve_mock_cl8y_addr "${DEPLOY_LOG}" "${ROOT}")"
    # shellcheck disable=SC1091
    source "${ROOT}/scripts/lib/evm_dev_keys.sh" 2>/dev/null || true
    if command -v cast >/dev/null 2>&1; then
      echo "Seeding KEY_EVM_1..3 wallets (DOUB/CRED/ETH${cl8y:+, CL8Y=${cl8y}})..."
      if ! RPC="${RPC}" DOUB="${doub}" CRED="${cred}" CL8Y="${cl8y:-}" \
        DEPLOYER_PK="$(yieldomega_resolve_seed_minter_pk)" \
        bash "${ROOT}/scripts/seed-evm-dev-wallets-anvil.sh"; then
        echo "yieldomega_anvil_deploy_dev: seed-evm-dev-wallets-anvil.sh failed (CL8Y=${cl8y:-<unset>}). See errors above." >&2
        return 1
      fi
    fi
  fi
}
