#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #79 / #55 — live Anvil checks for post-end `redeemCharms` + `distributePrizes` owner gates.
#
# Preconditions:
#   - Anvil on RPC (default http://127.0.0.1:8545), --code-size-limit 524288
#   - DeployDev + Part1, warp, **end sale only** (gates still off, no claims/prize tx yet):
#       ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh
#     The `SimulateAnvilRichStatePart2EndSaleOnly` script resets DeployDev’s convenience flags to false and
#     calls `endSale()`. Full `anvil_rich_state.sh` (no flag) runs Part2 which **enables** gates and
#     completes redemptions — use a fresh chain for #79 if you already ran the full script.
#   - cast, forge, jq in PATH
#
# Usage (repo root):
#   export RPC_URL=http://127.0.0.1:8545
#   export YIELDOMEGA_TIMECURVE=0x...   # optional: from contracts/deployments/local-anvil-registry.json
#   bash scripts/verify-timecurve-post-end-gates-anvil.sh
#
# See: docs/operations/final-signoff-and-value-movement.md, docs/testing/invariants-and-business-logic.md (#79),
#      skills/verify-yo-timecurve-post-end-gates/SKILL.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
REGISTRY_DEFAULT="${CONTRACTS}/deployments/local-anvil-registry.json"
PK_DEPLOYER="${PK_DEPLOYER:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
# Anvil #1 — matches SimulateAnvilRichState Part1 `PK_A` (buyer with charm weight)
PK_ALICE="${PK_ALICE:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
ADDR_ALICE="${ADDR_ALICE:-$(cast wallet address --private-key "$PK_ALICE" 2>/dev/null || true)}"

if ! command -v cast >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "verify-timecurve-post-end-gates-anvil: need cast and jq in PATH." >&2
  exit 1
fi

if [[ -z "$ADDR_ALICE" ]]; then
  echo "verify-timecurve-post-end-gates-anvil: could not derive ADDR_ALICE from PK_ALICE." >&2
  exit 1
fi

TC="${YIELDOMEGA_TIMECURVE:-}"
if [[ -z "${TC}" ]] && [[ -f "${REGISTRY_DEFAULT}" ]]; then
  TC="$(jq -r '.contracts.TimeCurve // empty' "${REGISTRY_DEFAULT}")"
fi
if [[ -z "${TC}" || "${TC}" == "null" ]]; then
  echo "Set YIELDOMEGA_TIMECURVE or ensure ${REGISTRY_DEFAULT} has contracts.TimeCurve." >&2
  exit 1
fi

if ! cast block-number --rpc-url "${RPC_URL}" >/dev/null 2>&1; then
  echo "No JSON-RPC at ${RPC_URL}." >&2
  exit 1
fi

cast_bool_dec() {
  # `cast call` for bool may return `true`/`false` or 32-byte hex; normalize to 0/1
  local raw
  raw="$(cast call "$1" "$2" --rpc-url "${RPC_URL}" 2>/dev/null | awk '{print tolower($1)}')"
  case "$raw" in
  true) echo 1 ;;
  false) echo 0 ;;
  *)
    local h
    h="$(tr -d '[:space:]' <<<"$raw")"
    cast to-dec "$h" 2>/dev/null | head -1
    ;;
  esac
}

echo "=== TimeCurve (proxy) $TC  alice=$ADDR_ALICE ==="

END_D="$(cast_bool_dec "$TC" "ended()(bool)")"
if [[ "${END_D}" != "1" ]]; then
  echo "Expected TimeCurve.ended==true. Run anvil_rich_state with ANVIL_RICH_END_SALE_ONLY=1 after Part1+warp." >&2
  exit 1
fi

PRIZES_D="$(cast_bool_dec "$TC" "prizesDistributed()(bool)")"
if [[ "${PRIZES_D}" == "1" ]]; then
  echo "TimeCurve.prizesDistributed is already true — chain looks like full anvil_rich_state Part2. Use a fresh" >&2
  echo "DeployDev (or a new anvil) and ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh, then re-run this script." >&2
  exit 1
fi

RDM_D="$(cast_bool_dec "$TC" "charmRedemptionEnabled()(bool)")"
RSV_D="$(cast_bool_dec "$TC" "reservePodiumPayoutsEnabled()(bool)")"
if [[ "${RDM_D}" != "0" || "${RSV_D}" != "0" ]]; then
  echo "Expected charmRedemptionEnabled==false and reservePodiumPayoutsEnabled==false (got rdm=$RDM_D rsv=$RSV_D)." >&2
  echo "Re-run from ANVIL_RICH_END_SALE_ONLY=1 or reset chain." >&2
  exit 1
fi

REDEEMED_WORD="$(cast call "$TC" "charmsRedeemed(address)(bool)" "$ADDR_ALICE" --rpc-url "${RPC_URL}" 2>/dev/null | awk '{print tolower($1)}')"
case "$REDEEMED_WORD" in
true) REDEEMED_D=1 ;;
false) REDEEMED_D=0 ;;
*)
  REDEEMED_D="$(cast to-dec "$(tr -d '[:space:]' <<<"$REDEEMED_WORD")" 2>/dev/null | head -1 || echo 0)"
  ;;
esac
if [[ "${REDEEMED_D}" != "0" ]]; then
  echo "Alice has already redeemed charms; need fresh Part1+end-sale-only state." >&2
  exit 1
fi

PODIUM_HEX="$(tr -d '[:space:]' <<<"$(cast call "$TC" "podiumPool()(address)" --rpc-url "${RPC_URL}")")"
PODIUM_ADDR="$(cast to-checksum "${PODIUM_HEX}" 2>/dev/null || echo "")"
RES_HEX="$(tr -d '[:space:]' <<<"$(cast call "$TC" "acceptedAsset()(address)" --rpc-url "${RPC_URL}")")"
RES_ADDR="$(cast to-checksum "${RES_HEX}" 2>/dev/null || echo "")"
PRIZE_BAL_RAW="$(cast call "${RES_ADDR}" "balanceOf(address)(uint256)" "$PODIUM_ADDR" --rpc-url "${RPC_URL}" | awk '{print $1}')"
PRIZE_BAL="$(cast to-dec "$PRIZE_BAL_RAW" 2>/dev/null | head -1 || echo 0)"
if [[ "${PRIZE_BAL:-0}" == "0" ]]; then
  echo "Podium pool reserve balance is 0 — distributePrizes would no-op before the gate; cannot verify row 3/4. Run full Part1 buys first." >&2
  exit 1
fi

echo "  Podium pool CL8Y balance: $PRIZE_BAL (wei) — non-zero, gate will apply to distributePrizes"

expect_revert() {
  local name="$1"
  local want_sub="$2"
  shift 2
  set +e
  local out
  out="$("$@" 2>&1)"
  local ec=$?
  set -e
  if [[ $ec -eq 0 ]]; then
    echo "FAIL: $name expected revert, got success. Output: $out" >&2
    return 1
  fi
  if ! grep -F "$want_sub" <<<"$out" >/dev/null; then
    echo "FAIL: $name expected substring: $want_sub" >&2
    echo "$out" >&2
    return 1
  fi
  echo "PASS: $name (revert contains: $want_sub)"
}

echo "=== Row 1: redeemCharms reverts when charmRedemptionEnabled is false ==="
expect_revert "redeemCharms (alice)" "TimeCurve: charm redemptions disabled" \
  cast send "$TC" "redeemCharms()" --private-key "$PK_ALICE" --rpc-url "$RPC_URL"

echo "=== Row 2: setCharmRedemptionEnabled(true) -> redeemCharms succeeds (alice) ==="
cast send "$TC" "setCharmRedemptionEnabled(bool)" true --private-key "$PK_DEPLOYER" --rpc-url "$RPC_URL" >/dev/null
cast send "$TC" "redeemCharms()" --private-key "$PK_ALICE" --rpc-url "$RPC_URL" >/dev/null
echo "PASS: redeemCharms (alice) succeeded with gate on"

echo "=== Row 3: distributePrizes reverts when reservePodiumPayoutsEnabled is false and pool > 0 ==="
expect_revert "distributePrizes" "TimeCurve: reserve podium payouts disabled" \
  cast send "$TC" "distributePrizes()" --private-key "$PK_DEPLOYER" --rpc-url "$RPC_URL"

echo "=== Row 4: setReservePodiumPayoutsEnabled(true) -> distributePrizes succeeds ==="
cast send "$TC" "setReservePodiumPayoutsEnabled(bool)" true --private-key "$PK_DEPLOYER" --rpc-url "$RPC_URL" >/dev/null
cast send "$TC" "distributePrizes()" --private-key "$PK_DEPLOYER" --rpc-url "$RPC_URL" >/dev/null
echo "PASS: distributePrizes succeeded with gate on"

PRIZES_END="$(cast_bool_dec "$TC" "prizesDistributed()(bool)")"
if [[ "${PRIZES_END}" != "1" ]]; then
  echo "FAIL: expected prizesDistributed==true after distributePrizes" >&2
  exit 1
fi

echo "=== Done — all #79 rows passed for this Anvil. Capture tx output above for evidence. ==="
