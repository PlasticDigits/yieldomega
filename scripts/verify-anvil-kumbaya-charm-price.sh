#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Smoke: Anvil Kumbaya three-pool spot → TimeArena.charmPriceWad (~30k–310k DOUB spend band).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.foundry/bin:${PATH}"

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
TA="${YIELDOMEGA_TIME_ARENA:-}"

if [[ -z "${TA}" && -f "${ROOT}/frontend/.env.local" ]]; then
  TA="$(grep -E '^VITE_TIME_ARENA_ADDRESS=' "${ROOT}/frontend/.env.local" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
[[ -n "${TA}" ]] || { echo "Set YIELDOMEGA_TIME_ARENA or run stack first." >&2; exit 1; }

CHARM_PRICE="$(cast call "${TA}" "charmPriceWad()(uint256)" --rpc-url "${RPC_URL}" | tr -d '[:space:]' | sed -E 's/\[.*//')"
MIN_SPEND="$(python3 - <<PY
charm = int("${CHARM_PRICE}")
print((99 * 10**16 * charm) // 10**18)
PY
)"
MAX_SPEND="$(python3 - <<PY
charm = int("${CHARM_PRICE}")
print((10 * 10**18 * charm) // 10**18)
PY
)"

echo "TimeArena: ${TA}"
echo "charmPriceWad: ${CHARM_PRICE}"
echo "minDoubSpendWad (0.99 CHARM): ${MIN_SPEND}"
echo "maxDoubSpendWad (10 CHARM): ${MAX_SPEND}"

# ~30k / ~310k DOUB at ~31k DOUB per CHARM (allow 5% slack for CP rounding).
python3 - <<PY
charm = int("${CHARM_PRICE}")
min_s = int("${MIN_SPEND}")
max_s = int("${MAX_SPEND}")
wad = 10**18
if charm < 28_000 * wad or charm > 33_000 * wad:
    raise SystemExit(f"FAIL: charmPriceWad {charm} outside ~28k–33k DOUB/CHARM band")
if min_s < 27_000 * wad or min_s > 33_000 * wad:
    raise SystemExit(f"FAIL: min spend {min_s} outside ~30k DOUB band")
if max_s < 270_000 * wad or max_s > 330_000 * wad:
    raise SystemExit(f"FAIL: max spend {max_s} outside ~300k DOUB band")
print("PASS: charm price and DOUB spend band look realistic")
PY
