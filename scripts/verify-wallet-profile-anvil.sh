#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #282 — GET /v1/arena/buys exposes actual_seconds_added; wallet stats after DOUB buy (#258 QA).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ANVIL_PORT:-8548}"
INDEXER_PORT="${INDEXER_PORT:-3103}"
RPC="http://127.0.0.1:${PORT}"
PG_URL="${DATABASE_URL:-postgres://yieldomega:password@127.0.0.1:5433/yieldomega_indexer}"
DEPLOY_LOG="$(mktemp)"
REGISTRY="${ROOT}/contracts/deployments/local-anvil-registry.json"
CHARM_WAD=1000000000000000000
TOPUP_DOUB=700000000000000000000

# shellcheck source=scripts/lib/anvil_deploy_dev.sh
source "${ROOT}/scripts/lib/anvil_deploy_dev.sh"

die() {
  echo "verify-wallet-profile-anvil: $*" >&2
  exit 1
}

log() {
  echo "verify-wallet-profile-anvil: $*"
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

cleanup() {
  rm -f "${DEPLOY_LOG}"
  if [[ -n "${INDEXER_PID:-}" ]]; then kill "${INDEXER_PID}" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "${ANVIL_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT

pkill -f "anvil.*${PORT}" 2>/dev/null || true
pkill -f 'yieldomega-indexer' 2>/dev/null || true
sleep 1

anvil --host 127.0.0.1 --port "${PORT}" --gas-limit 60000000 --code-size-limit 524288 \
  >/tmp/yieldomega_verify282_anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  cast block-number --rpc-url "${RPC}" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "${RPC}" >/dev/null

chain_id="$(cast chain-id --rpc-url "${RPC}")"
[[ "${chain_id}" == "31337" ]] || die "expected chainId 31337, got ${chain_id}"

export YIELDOMEGA_DEPLOY_NO_COOLDOWN=1
export YIELDOMEGA_SEED_EVM_DEV_WALLETS=0
ROOT="${ROOT}" RPC="${RPC}" DEPLOY_LOG="${DEPLOY_LOG}" yieldomega_anvil_deploy_dev

[[ -n "${TA:-}" ]] || die "TimeArena address missing after deploy"
[[ -n "${DOUB:-}" ]] || die "Doubloon address missing after deploy"

DEPLOY_BLOCK="$(cast block-number --rpc-url "${RPC}")"
jq -n \
  --argjson chainId 31337 \
  --arg ta "${TA}" \
  --arg pv "${PV}" \
  --arg av "${AV}" \
  --arg rr "${RR}" \
  --argjson deployBlock "${DEPLOY_BLOCK}" \
  '{
    _comment: "verify-wallet-profile-anvil.sh",
    chainId: $chainId,
    contracts: { TimeArena: $ta, PodiumVaults: $pv, AdminSellVault: $av, ReferralRegistry: $rr },
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
cargo run --release >/tmp/yieldomega_verify282_indexer.log 2>&1 &
INDEXER_PID=$!

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/status" >/dev/null || {
  tail -40 /tmp/yieldomega_verify282_indexer.log >&2
  die "indexer /v1/status unavailable"
}

mapfile -t ANVIL_ACCOUNTS < <(cast rpc eth_accounts --rpc-url "${RPC}" | jq -r '.[]')
DEPLOYER="${ANVIL_ACCOUNTS[0]}"
BUYER="${ANVIL_ACCOUNTS[1]}"
[[ -n "${BUYER}" ]] || die "need at least two Anvil accounts"
BUYER_LC="$(echo "${BUYER}" | tr '[:upper:]' '[:lower:]')"

anvil_send "${DEPLOYER}" "${DOUB}" "mint(address,uint256)" "${BUYER}" "1000000000000000000000000"
anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "1000000000000000000000000"

BUY_TX="$(cast send "${TA}" "buy(uint256,bytes32)" "${CHARM_WAD}" \
  "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --from "${BUYER}" --unlocked --rpc-url "${RPC}" --json | jq -r '.transactionHash')"
[[ -n "${BUY_TX}" && "${BUY_TX}" != "null" ]] || die "DOUB buy tx hash missing"
log "DOUB buy tx=${BUY_TX} buyer=${BUYER_LC}"

synced=0
for _ in $(seq 1 90); do
  count="$(psql "${PG_URL}" -tAc "SELECT COUNT(*) FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}'")"
  if [[ "${count}" -ge 1 ]]; then
    synced=1
    break
  fi
  sleep 1
done
[[ "${synced}" -eq 1 ]] || {
  tail -40 /tmp/yieldomega_verify282_indexer.log >&2
  die "indexer did not ingest buy row"
}

BUYS_JSON="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/buys?limit=5")"
API_SECS="$(echo "${BUYS_JSON}" | jq -r --arg tx "${BUY_TX,,}" \
  '.items[] | select((.tx_hash | ascii_downcase) == $tx) | .actual_seconds_added' | head -1)"
[[ -n "${API_SECS}" && "${API_SECS}" != "null" ]] || die "actual_seconds_added missing in GET /v1/arena/buys"
DB_SECS="$(psql "${PG_URL}" -tAc \
  "SELECT actual_seconds_added::text FROM idx_arena_buy WHERE tx_hash = '${BUY_TX}' LIMIT 1")"
[[ "${API_SECS}" == "${DB_SECS}" ]] || die "API/DB seconds mismatch: api=${API_SECS} db=${DB_SECS}"
if [[ "${API_SECS}" == "0" ]]; then
  hard_reset="$(echo "${BUYS_JSON}" | jq -r --arg tx "${BUY_TX,,}" \
    '.items[] | select((.tx_hash | ascii_downcase) == $tx) | .timer_hard_reset')"
  [[ "${hard_reset}" == "true" ]] || die "expected actual_seconds_added > 0 or timer_hard_reset on extending buy"
else
  [[ "${API_SECS}" =~ ^[0-9]+$ && "${API_SECS}" -gt 0 ]] || die "expected positive actual_seconds_added, got ${API_SECS}"
fi
log "actual_seconds_added=${API_SECS} (matches idx_arena_buy)"

STATS="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/wallet/${BUYER_LC}/stats")"
buy_count="$(echo "${STATS}" | jq -r '.buy_count')"
[[ "${buy_count}" =~ ^[0-9]+$ && "${buy_count}" -ge 1 ]] || die "wallet stats buy_count expected >= 1, got ${buy_count}"
log "wallet stats buy_count=${buy_count}"

anvil_send "${BUYER}" "${DOUB}" "approve(address,uint256)" "${TA}" "${TOPUP_DOUB}"
cast send "${TA}" "topUpPodiumPools(uint256)" "${TOPUP_DOUB}" \
  --from "${BUYER}" --unlocked --rpc-url "${RPC}" >/dev/null
warp_past_cooldown

donate_ok=0
for _ in $(seq 1 60); do
  donor_count="$(curl -sf "http://127.0.0.1:${INDEXER_PORT}/v1/arena/podium-pool-donations?donor=${BUYER_LC}" \
    | jq -r '.donor_summary.donation_count // "0"')"
  if [[ "${donor_count}" =~ ^[0-9]+$ && "${donor_count}" -ge 1 ]]; then
    donate_ok=1
    break
  fi
  sleep 1
done
[[ "${donate_ok}" -eq 1 ]] || die "donor_summary.donation_count never reached 1 after topUpPodiumPools"
log "podium-pool-donations donor_summary ok"

log "Manual QA (#258): start stack (or reuse INDEXER_URL), open /arena with sale active;"
log "  confirm data-testid=arena-simple-last-extension after an extending buy;"
log "  click buyer on extension chip or live-buy row → WalletProfileModal (seven sections)."

export YIELDOMEGA_PG_TEST_URL="${PG_URL%/*}/yieldomega_indexer_test"
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yieldomega_indexer_test;" >/dev/null 2>&1 || true
psql "${PG_URL%/*}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE yieldomega_indexer_test OWNER yieldomega;" >/dev/null
log "integration_stage2 (includes api_arena_buys_actual_seconds_added_smoke)"
cargo test --test integration_stage2 --quiet

echo "=== verify-wallet-profile-anvil: OK (buyer=${BUYER_LC}, actual_seconds_added=${API_SECS}, buy_count=${buy_count}) ==="
