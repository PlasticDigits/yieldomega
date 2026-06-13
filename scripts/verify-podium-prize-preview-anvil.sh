#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #302 — active-pool prize preview on GET /v1/arena/podiums vs PodiumVaults.activePoolBalance + 4∶2∶1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8547}"
INDEXER_PORT="${INDEXER_PORT:-3102}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="$(mktemp)"
CHARM_WAD=1000000000000000000
# UX order → onchain category index (Last Buy · WarBow · Defended · Time Booster)
PODIUM_CATS=(0 3 2 1)

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-podium-prize-preview-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-podium-prize-preview-anvil: $*"
}

warp_past_cooldown() {
  cast rpc anvil_increaseTime 5 --rpc-url "${RPC}" >/dev/null
  cast rpc anvil_mine 1 --rpc-url "${RPC}" >/dev/null
}

anvil_send() {
  local from="$1" to="$2" sig="$3"
  shift 3
  cast send "${to}" "${sig}" "$@" --from "${from}" --unlocked --rpc-url "${RPC}" >/dev/null
}

wait_for_podiums_ok() {
  for _ in $(seq 1 90); do
    code="$(curl -s -o /tmp/yieldomega_verify302_podiums.json -w '%{http_code}' \
      "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums")"
    if [[ "${code}" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  die "GET /v1/arena/podiums never returned 200 (chain_timer may be unavailable)"
}

expected_prize_places() {
  local pool="$1"
  python3 - <<PY
pool = int("${pool}")
first = pool * 4 // 7
second = pool * 2 // 7
third = pool - first - second
print(first, second, third)
PY
}

assert_prize_row() {
  local ux="$1" block="$2"
  local cat="${PODIUM_CATS[$ux]}"
  local pool api_pool p1 p2 p3 e1 e2 e3

  pool="$(cast call "${PV}" "activePoolBalance(uint8)(uint256)" "${cat}" \
    --rpc-url "${RPC}" --block "${block}" | awk '{print $1}')"
  read -r e1 e2 e3 <<<"$(expected_prize_places "${pool}")"

  api_pool="$(echo "${RESP}" | jq -r ".rows[${ux}].active_pool_balance_doub_wad")"
  p1="$(echo "${RESP}" | jq -r ".rows[${ux}].prize_places_doub_wad[0]")"
  p2="$(echo "${RESP}" | jq -r ".rows[${ux}].prize_places_doub_wad[1]")"
  p3="$(echo "${RESP}" | jq -r ".rows[${ux}].prize_places_doub_wad[2]")"

  [[ "${api_pool}" == "${pool}" ]] \
    || die "UX row ${ux} active pool mismatch: api=${api_pool} chain=${pool}"
  [[ "${p1}" == "${e1}" && "${p2}" == "${e2}" && "${p3}" == "${e3}" ]] \
    || die "UX row ${ux} prize split mismatch: api=[${p1},${p2},${p3}] expected=[${e1},${e2},${e3}] pool=${pool}"
}

cleanup() {
  rm -f "${DEPLOY_LOG}" /tmp/yieldomega_verify302_podiums.json "${REGISTRY}"
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
pkill -f 'yieldomega-indexer' 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify302_anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "${RPC}" >/dev/null

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev
yieldomega_export_deploy_addrs_from_log "${DEPLOY_LOG}" "${ROOT}"

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${PV:-}" ]] || die "PodiumVaults address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-podium-prize-preview-anvil.sh",
    chainId: $chainId,
    contracts: { TimeArena: $ta, PodiumVaults: $pv, ReferralRegistry: $rr },
    deployBlock: $deployBlock
  }' >"${REGISTRY}"

psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yieldomega_indexer' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer;" >/dev/null
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer OWNER yieldomega;" >/dev/null

export DATABASE_URL="${PG_URL}"
export CHAIN_ID=31337
export START_BLOCK=0
export ADDRESS_REGISTRY_PATH="${REGISTRY}"
export LISTEN_ADDR="127.0.0.1:${INDEXER_PORT}"
export INGESTION_ENABLED=true
export RPC_URL="${RPC}"
cd "${ROOT}/indexer"
cargo run --release >/tmp/yieldomega_verify302_indexer.log 2>&1 &
INDEXER_PID=$!

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null || {
  tail -40 /tmp/yieldomega_verify302_indexer.log >&2
  die "indexer /v1/status unavailable"
}

wait_for_podiums_ok
RESP="$(cat /tmp/yieldomega_verify302_podiums.json)"
READ_BLOCK="$(echo "${RESP}" | jq -r '.read_block_number')"
[[ -n "${READ_BLOCK}" && "${READ_BLOCK}" != "null" ]] || die "missing read_block_number"

for ux in 0 1 2 3; do
  for place in 0 1 2; do
    prize="$(echo "${RESP}" | jq -r ".rows[${ux}].prize_places_doub_wad[${place}]")"
    [[ "${prize}" == "0" ]] || die "fresh deploy expected zero prizes, got ${prize} at row ${ux} place ${place}"
  done
done

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
BUYER="${ANVIL_ACCOUNTS[1]}"
anvil_send "${ANVIL_ACCOUNTS[0]}" "${DOUB}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
anvil_send "${BUYER}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
warp_past_cooldown

synced=0
for _ in $(seq 1 90); do
  read_block="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums" | jq -r '.read_block_number // 0')"
  head_block="$(cast block-number --rpc-url "${RPC}")"
  if [[ "${read_block}" -ge "${head_block}" ]]; then
    synced=1
    break
  fi
  sleep 1
done
[[ "${synced}" -eq 1 ]] || {
  tail -40 /tmp/yieldomega_verify302_indexer.log >&2
  die "indexer did not catch up to head block"
}

RESP="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums")"
READ_BLOCK="$(echo "${RESP}" | jq -r '.read_block_number')"

LAST_BUY_POOL="$(echo "${RESP}" | jq -r '.rows[0].active_pool_balance_doub_wad')"
[[ "${LAST_BUY_POOL}" != "0" ]] || die "expected Last Buy active pool > 0 after buy, got ${LAST_BUY_POOL}"

for ux in 0 1 2 3; do
  assert_prize_row "${ux}" "${READ_BLOCK}"
done

SCHEMA="$(curl -sfI "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums" | tr -d '\r' | awk -F': ' '/^[Xx]-[Ss]chema-[Vv]ersion/{print $2}')"
[[ -n "${SCHEMA}" ]] || die "missing x-schema-version header"
[[ "$(printf '%s\n' "2.8.0" "${SCHEMA}" | sort -V | head -1)" == "2.8.0" ]] \
  || die "expected schema >= 2.8.0, got ${SCHEMA}"

echo "=== verify-podium-prize-preview-anvil: OK (read_block=${READ_BLOCK}, last_buy_pool=${LAST_BUY_POOL}, schema=${SCHEMA}) ==="
