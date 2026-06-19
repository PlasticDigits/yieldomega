#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/contracts"
forge test --match-test 'test_buy_energy_|test_buy_spends_one_buy_charge|test_buy_reverts_inside_burst_cooldown|test_buy_succeeds_at_exact_burst_boundary_if_charge_available|test_buy_charge_refills_at_exact_interval|test_buy_charges_cap_after_long_idle|test_buy_reverts_when_charges_exhausted_until_next_charge|test_readBuyEnergyParams_env_resolution_matrix'
