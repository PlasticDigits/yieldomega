#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# GitLab #303 — verify Arena production TWAP charm price init (INV-TIME-ARENA-CHARM-TWAP-INIT).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/cloud_agent_path.sh
source "${ROOT}/scripts/lib/cloud_agent_path.sh"
yieldomega_prepend_cloud_toolchain_path

CONTRACTS="${ROOT}/contracts"
RPC_URL="${RPC_URL:-${MEGAETH_RPC:-https://mainnet.megaeth.com/rpc}}"

die() {
  echo "verify-arena-charm-twap: $*" >&2
  exit 1
}

if ! command -v forge >/dev/null 2>&1; then
  die "forge not found; run scripts/bootstrap-cloud-vm-toolchain.sh"
fi

echo "=== #303 unit: ArenaCharmPriceTwap ==="
(cd "${CONTRACTS}" && forge test --match-contract ArenaCharmPriceTwap -q)

echo "=== #303 fork: MegaETH TWAP smoke ==="
FORK_URL="${RPC_URL}" forge test --match-test test_fork_megaeth_twap_charm_price -q \
  --root "${CONTRACTS}"

echo "=== #303 ops dry-run ==="
bash "${ROOT}/scripts/compute-arena-charm-price-twap.sh"

echo "=== #303 DeployProduction fail-closed (Anvil) ==="
(cd "${CONTRACTS}" && forge test --match-contract DeployProductionCharmPrice -q)

echo "=== verify-arena-charm-twap: OK ==="
