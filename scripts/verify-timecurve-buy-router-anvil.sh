#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #78 — one-shot verification of the #65 TimeCurveBuyRouter + DeployKumbayaAnvilFixtures scope checklist
# (quote vs exactOutput, onchain buy router, USDM two-hop, buyViaKumbaya, WarBow flag opt-in, re-disable).
#
# Preconditions:
#   - Anvil on RPC (default http://127.0.0.1:8545) with chain 31337, --code-size-limit 524288
#   - DeployDev (TimeCurve proxy) already deployed; sale **live** (use SKIP_ANVIL_RICH_STATE=1 with
#     `scripts/start-local-anvil-stack.sh` if you need an active sale end timer)
#   - cast, forge, jq in PATH
#
# Usage (repo root):
#   export RPC_URL=http://127.0.0.1:8545
#   export YIELDOMEGA_TIMECURVE=0x...   # optional: parsed from contracts/deployments/local-anvil-registry.json
#   bash scripts/verify-timecurve-buy-router-anvil.sh
#   YIELDOMEGA_DEPLOY_KUMBAYA=1 bash ...   # if timeCurveBuyRouter is still 0, run DeployKumbayaAnvilFixtures
#
# See: docs/integrations/kumbaya.md, docs/testing/invariants-and-business-logic.md (issue #78),
#      skills/verify-yo-timecurve-buy-router-anvil/SKILL.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="${ROOT}/contracts"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
REGISTRY_DEFAULT="${CONTRACTS}/deployments/local-anvil-registry.json"
DEPLOYER_PK="${DEPLOYER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if ! command -v cast >/dev/null 2>&1 || ! command -v forge >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "verify-timecurve-buy-router-anvil: need cast, forge, and jq in PATH." >&2
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

BR_HEX="$(tr -d '[:space:]' <<<"$(cast call "${TC}" "timeCurveBuyRouter()(address)" --rpc-url "${RPC_URL}")")"
BR_ONCHAIN="$(cast to-checksum "${BR_HEX}" 2>/dev/null || echo "")"
if [[ -z "${BR_ONCHAIN}" || "${BR_ONCHAIN}" == "0x0000000000000000000000000000000000000000" ]]; then
  if [[ "${YIELDOMEGA_DEPLOY_KUMBAYA:-0}" != "1" ]]; then
    echo "TimeCurve.timeCurveBuyRouter is zero. Re-run with YIELDOMEGA_DEPLOY_KUMBAYA=1 to broadcast DeployKumbayaAnvilFixtures, or use scripts/e2e-anvil.sh / scripts/lib/anvil_deploy_dev.sh." >&2
    exit 1
  fi
  echo "=== DeployKumbayaAnvilFixtures (broadcast) for TC=${TC} ==="
  KUMBAYA_LOG="$(mktemp)"
  (
    cd "${CONTRACTS}"
    export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS}/out-verify-tcbr}"
    export PRIVATE_KEY="${DEPLOYER_PK}"
    mkdir -p "${FOUNDRY_OUT}"
    forge build --quiet
    forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures --broadcast \
      --rpc-url "${RPC_URL}" --code-size-limit 524288 --sig "run(address)" "${TC}" 2>&1 | tee "${KUMBAYA_LOG}"
  )
  TCBR_ADDR="$(grep "TimeCurveBuyRouter (single-tx" "${KUMBAYA_LOG}" | tail -1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1)"
  rm -f "${KUMBAYA_LOG}"
  if [[ -z "${TCBR_ADDR}" ]]; then
    echo "Could not parse TimeCurveBuyRouter from forge log." >&2
    exit 1
  fi
  echo "  Deployed/registered TimeCurveBuyRouter: ${TCBR_ADDR}"
fi

# Optional cast-only evidence lines (keeps original #78 checklist copy-pasteable)
echo "=== cast: timeCurve ==="
cast call "${TC}" "timeCurveBuyRouter()(address)" --rpc-url "${RPC_URL}"

# Sale phase guard: fork test reverts on ended sale
END_HEX="$(tr -d '[:space:]' <<<"$(cast call "${TC}" "ended()(bool)" --rpc-url "${RPC_URL}")")"
if [[ "$(cast to-dec "${END_HEX}" 2>/dev/null || echo 0)" == "1" ]]; then
  echo "TimeCurve.ended is true. Use a live-sale stack: SKIP_ANVIL_RICH_STATE=1 with start-local-anvil-stack.sh, or a fresh anvil+DeployDev, then re-run this script." >&2
  exit 1
fi

export FORK_URL="${RPC_URL}"
export YIELDOMEGA_FORK_VERIFY=1
export YIELDOMEGA_TIMECURVE="${TC}"

export FOUNDRY_OUT="${FOUNDRY_OUT:-${CONTRACTS}/out-verify-tcbr}"
mkdir -p "${FOUNDRY_OUT}"

echo "=== forge test (fork): VerifyTimeCurveBuyRouterAnvil.t.sol ==="
cd "${CONTRACTS}"
forge test --match-path "test/VerifyTimeCurveBuyRouterAnvil.t.sol" --match-test "test_Forked_issue78" -vv

echo "Done. If all green, the #78 scope items automated here are satisfied for this Anvil (see issues #65 and #78, docs/testing/invariants-and-business-logic.md)."
