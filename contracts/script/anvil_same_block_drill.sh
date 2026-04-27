#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Local drill: two buys as separate pending txs, then one block (tx order = inclusion order).
# Requires: foundry (anvil, cast, forge). Run from repo root: `bash contracts/script/anvil_same_block_drill.sh`
set -euo pipefail

PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:${PORT}"
# Anvil default accounts (same as Foundry tests)
PK_DEPLOYER="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
PK_A="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
PK_B="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d1"
ADDR_A="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
ADDR_B="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/contracts"

if ! command -v anvil >/dev/null || ! command -v cast >/dev/null || ! command -v forge >/dev/null; then
  echo "Need anvil, cast, and forge on PATH." >&2
  exit 1
fi

echo "Starting anvil (manual mining) on port ${PORT}..."
anvil --host 127.0.0.1 --no-mining --port "${PORT}" --code-size-limit 524288 >/tmp/anvil_drill.log 2>&1 &
ANVIL_PID=$!
trap 'kill "${ANVIL_PID}" 2>/dev/null || true' EXIT
sleep 1

echo "Deploying drill stack..."
OUT="$(forge script script/AnvilSameBlockDrill.s.sol:AnvilSameBlockDrill --rpc-url "${RPC}" --broadcast \
  --code-size-limit 524288 --private-key "${PK_DEPLOYER}" -vv 2>&1)"
echo "${OUT}" | tail -20

USDM=$(echo "${OUT}" | grep "DRILL_USDM" | awk '{print $2}' | head -1)
TC=$(echo "${OUT}" | grep "DRILL_TC" | awk '{print $2}' | head -1)
if [[ -z "${TC}" || -z "${USDM}" ]]; then
  echo "Failed to parse DRILL_TC / DRILL_USDM from forge output." >&2
  exit 1
fi
echo "USDM=${USDM} TC=${TC}"

ONE_ETHER=$(cast --to-wei 1 ether)
MAX="115792089237316195423570985008687907853269984665640564039457584007913129639935"

echo "Minting and approving buyers..."
cast send "${USDM}" "mint(address,uint256)" "${ADDR_A}" "${ONE_ETHER}" --rpc-url "${RPC}" --private-key "${PK_DEPLOYER}" >/dev/null
cast send "${USDM}" "mint(address,uint256)" "${ADDR_B}" "${ONE_ETHER}" --rpc-url "${RPC}" --private-key "${PK_DEPLOYER}" >/dev/null
cast send "${USDM}" "approve(address,uint256)" "${TC}" "${MAX}" --rpc-url "${RPC}" --private-key "${PK_A}" >/dev/null
cast send "${USDM}" "approve(address,uint256)" "${TC}" "${MAX}" --rpc-url "${RPC}" --private-key "${PK_B}" >/dev/null

echo "Queuing two buy txs (no auto-mine)..."
cast send "${TC}" "buy(uint256)" "${ONE_ETHER}" --rpc-url "${RPC}" --private-key "${PK_A}" --async >/dev/null
cast send "${TC}" "buy(uint256)" "${ONE_ETHER}" --rpc-url "${RPC}" --private-key "${PK_B}" --async >/dev/null

echo "Mining one block..."
cast rpc --rpc-url "${RPC}" anvil_mine

echo "Buy events (check buyIndex order; second tx should have higher buyIndex if both landed):"
cast logs --rpc-url "${RPC}" --address "${TC}" --from-block 0 --to-block latest 2>/dev/null | head -40 || true

echo "Done. Stop anvil: kill ${ANVIL_PID}"
