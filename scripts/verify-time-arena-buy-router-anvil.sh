#!/usr/bin/env bash
# Arena v2 buy-router verification (#251) — deploy Kumbaya fixtures + TimeArenaBuyRouter on Anvil.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Run DeployDev + Kumbaya fixtures, then forge test --match-contract TimeArenaBuyRouter (when added)."
echo "See docs/integrations/kumbaya.md and contracts/src/arena/TimeArenaBuyRouter.sol"
exit 0
