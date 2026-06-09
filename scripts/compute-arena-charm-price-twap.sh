#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Dry-run MegaETH TWAP charm price for production deploy (GitLab #303).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${ROOT}/contracts"

export PATH="${HOME}/.foundry/bin:${PATH}"

RPC_URL="${RPC_URL:-${MEGAETH_RPC:-https://mainnet.megaeth.com/rpc}}"
CHAIN_ID="${CHAIN_ID:-4326}"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found; run scripts/bootstrap-cloud-vm-toolchain.sh" >&2
  exit 1
fi

cd "${CONTRACTS_DIR}"

echo "==> Arena charm TWAP dry-run (chain ${CHAIN_ID})"
echo "    RPC: ${RPC_URL}"

set +e
OUT="$(FOUNDRY_PROFILE=default forge script script/ComputeArenaCharmPriceTwap.s.sol:ComputeArenaCharmPriceTwap \
  --fork-url "${RPC_URL}" \
  -vvv 2>&1)"
STATUS=$?
set -e

echo "${OUT}"

if [[ ${STATUS} -ne 0 ]]; then
  if grep -qE "missing DOUB/CL8Y pool|missing CL8Y/WETH pool" <<<"${OUT}"; then
    echo "FAIL: DOUB/CL8Y or CL8Y/WETH Kumbaya pool not deployed — create pools or set ARENA_CHARM_PRICE_WAD for rehearsal." >&2
  fi
  exit "${STATUS}"
fi

grep -E "charmPriceWad|doubUsdWad|minDoubSpendWad|maxDoubSpendWad" <<<"${OUT}" || true
echo "PASS: TWAP charm price computed"
