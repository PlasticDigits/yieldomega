#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #273 — live podium predictions: GET /v1/arena/podiums vs block-tagged podium() on Anvil.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8546}"
INDEXER_PORT="${INDEXER_PORT:-3101}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000
# UX order → onchain category index (Last Buy · WarBow · Defended · Time Booster)
PODIUM_CATS=(0 3 2 1)

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-podium-live-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-podium-live-anvil: $*"
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
    code="$(curl -s -o /tmp/yieldomega_verify273_podiums.json -w '%{http_code}' \
      "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums")"
    if [[ "${code}" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  die "GET /v1/arena/podiums never returned 200 (chain_timer may be unavailable)"
}

podium_winners_at_block() {
  local cat="$1" block="$2"
  cast call "${TA}" "podium(uint8)(address[3],uint256[3])" "${cat}" \
    --rpc-url "${RPC}" --block "${block}" \
    | awk 'NR==1 {gsub(/[\[\],]/,""); print tolower($0)}'
}

battle_points_at_block() {
  local player="$1" block="$2"
  cast call "${TA}" "battlePoints(address)(uint256)" "${player}" \
    --rpc-url "${RPC}" --block "${block}" | awk '{print $1}'
}

assert_warbow_row() {
  local ux="$1" block="$2"
  local api_w0 api_score
  api_w0="$(echo "${RESP}" | jq -r ".rows[${ux}].winners[0]" | tr '[:upper:]' '[:lower:]')"
  api_score="$(echo "${RESP}" | jq -r ".rows[${ux}].values[0]")"
  [[ -n "${api_w0}" && "${api_w0}" != "0x0000000000000000000000000000000000000000" ]] \
    || die "WarBow row missing live leader"
  local chain_bp
  chain_bp="$(battle_points_at_block "${api_w0}" "${block}")"
  [[ "${chain_bp}" == "${api_score}" ]] \
    || die "WarBow leader BP mismatch: api=${api_score} chain=${chain_bp} player=${api_w0}"
}

cleanup() {
  rm -f "${DEPLOY_LOG}" /tmp/yieldomega_verify273_podiums.json
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
pkill -f 'yieldomega-indexer' 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify273_anvil.log 2>&1 &
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
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-podium-live-anvil.sh",
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
cargo run --release >/tmp/yieldomega_verify273_indexer.log 2>&1 &
INDEXER_PID=$!

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null || {
  tail -40 /tmp/yieldomega_verify273_indexer.log >&2
  die "indexer /v1/status unavailable"
}

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
BUYERS=("${ANVIL_ACCOUNTS[1]}" "${ANVIL_ACCOUNTS[2]}" "${ANVIL_ACCOUNTS[3]}")
[[ -n "${BUYERS[2]}" ]] || die "need at least four Anvil accounts"

for acct in "${BUYERS[@]}"; do
  anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${acct}" "1000000000000000000000000"
  anvil_send "${acct}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"
done

wait_for_podiums_ok
EMPTY="$(cat /tmp/yieldomega_verify273_podiums.json)"
echo "${EMPTY}" | jq -e '.rows | length == 4' >/dev/null
echo "${EMPTY}" | jq -e '.rows[0].category == "last_buy"' >/dev/null
echo "${EMPTY}" | jq -e '.rows[1].category == "warbow"' >/dev/null
echo "${EMPTY}" | jq -e '.rows[2].category == "defended_streak"' >/dev/null
echo "${EMPTY}" | jq -e '.rows[3].category == "time_booster"' >/dev/null

for buyer in "${BUYERS[@]}"; do
  anvil_send "${buyer}" "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  warp_past_cooldown
done

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
  tail -40 /tmp/yieldomega_verify273_indexer.log >&2
  die "indexer did not catch up to head block"
}

RESP="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums")"
READ_BLOCK="$(echo "${RESP}" | jq -r '.read_block_number')"
[[ -n "${READ_BLOCK}" && "${READ_BLOCK}" != "null" ]] || die "missing read_block_number"

for ux in 0 1 2 3; do
  cat="${PODIUM_CATS[$ux]}"
  api_pred="$(echo "${RESP}" | jq -r ".rows[${ux}].podium_prediction")"
  api_w0="$(echo "${RESP}" | jq -r ".rows[${ux}].winners[0]" | tr '[:upper:]' '[:lower:]')"
  has_entrant=0
  if [[ -n "${api_w0}" && "${api_w0}" != "0x0000000000000000000000000000000000000000" ]]; then
    has_entrant=1
  fi
  if [[ "${has_entrant}" -eq 1 ]]; then
    [[ "${api_pred}" == "true" ]] || die "row ${ux} with entrant expected podium_prediction true, got ${api_pred}"
  fi

  if [[ "${cat}" -eq 3 ]]; then
    [[ "${has_entrant}" -eq 1 ]] || die "WarBow row expected live leader after buys"
    assert_warbow_row "${ux}" "${READ_BLOCK}"
  elif [[ "${has_entrant}" -eq 1 ]]; then
    chain_w="$(podium_winners_at_block "${cat}" "${READ_BLOCK}" | awk '{print $1}' | tr '[:upper:]' '[:lower:]')"
    if [[ "${api_w0}" != "${chain_w}" ]]; then
      echo "${RESP}" | jq ".rows[${ux}]" >&2
      die "UX row ${ux} (cat ${cat}) winner mismatch: api=${api_w0} chain=${chain_w} at block ${READ_BLOCK}"
    fi
  fi

  api_epoch="$(echo "${RESP}" | jq -r ".rows[${ux}].epoch")"
  if [[ "${cat}" -eq 0 ]]; then
    chain_epoch="$(cast call "${TA}" "lastBuyEpoch()(uint256)" --rpc-url "${RPC}" --block "${READ_BLOCK}" | awk '{print $1}')"
  else
    chain_epoch="$(cast call "${TA}" "podiumEpoch(uint256)(uint256)" "${cat}" \
      --rpc-url "${RPC}" --block "${READ_BLOCK}" | awk '{print $1}')"
  fi
  if [[ "${api_epoch}" != "${chain_epoch}" ]]; then
    die "UX row ${ux} epoch mismatch: api=${api_epoch} chain=${chain_epoch}"
  fi
done

SCHEMA="$(curl -sfI "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podiums" | tr -d '\r' | awk -F': ' '/^[Xx]-[Ss]chema-[Vv]ersion/{print $2}')"
[[ -n "${SCHEMA}" ]] || die "missing x-schema-version header"
[[ "$(printf '%s\n' "2.5.0" "${SCHEMA}" | sort -V | head -1)" == "2.5.0" ]] \
  || die "expected schema >= 2.5.0, got ${SCHEMA}"

LIVE_COUNT="$(psql "${PG_URL}" -tAc 'SELECT COUNT(*) FROM idx_arena_podium_live')"
[[ "${LIVE_COUNT}" -gt 0 ]] || die "idx_arena_podium_live empty after buys"

log "integration_stage2 (includes arena_podiums_live_predictions_smoke)"
export YIELDOMEGA_PG_TEST_URL="${PG_URL%/*}/yieldomega_indexer_test"
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer_test;" >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;" >/dev/null
cargo test --test integration_stage2 --quiet

echo "=== verify-podium-live-anvil: OK (read_block=${READ_BLOCK}, live_rows=${LIVE_COUNT}) ==="
