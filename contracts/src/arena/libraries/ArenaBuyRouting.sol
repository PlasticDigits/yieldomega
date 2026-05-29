// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Pure DOUB split math for TimeArena buys (40% active / 30% seed / 30% admin).
library ArenaBuyRouting {
    uint256 internal constant BPS_DENOM = 10_000;

    uint16 internal constant ACTIVE_PODIUM_BPS = 1000; // 10% × 4
    uint16 internal constant SEED_PODIUM_BPS = 750; // 7.5% × 4
    uint16 internal constant ADMIN_VAULT_BPS = 3000;

    uint8 internal constant NUM_PODIUMS = 4;

    /// @dev Sum must equal 10_000; remainder goes to admin vault.
    function splitBuyAmount(uint256 amount)
        internal
        pure
        returns (uint256[NUM_PODIUMS] memory active, uint256[NUM_PODIUMS] memory seed, uint256 admin)
    {
        uint256 allocated;
        for (uint8 i; i < NUM_PODIUMS; ++i) {
            active[i] = Math.mulDiv(amount, ACTIVE_PODIUM_BPS, BPS_DENOM);
            seed[i] = Math.mulDiv(amount, SEED_PODIUM_BPS, BPS_DENOM);
            allocated += active[i] + seed[i];
        }
        admin = amount - allocated;
    }

    /// @dev Prize-only split for manual podium top-ups (10:7.5 active:seed per category, 100% to vaults).
    /// Remainder wei is assigned to the last category seed pool (GitLab #261 / #262).
    function splitPrizeTopUpAmount(uint256 amount)
        internal
        pure
        returns (uint256[NUM_PODIUMS] memory active, uint256[NUM_PODIUMS] memory seed)
    {
        uint256 allocated;
        for (uint8 i; i < NUM_PODIUMS; ++i) {
            active[i] = Math.mulDiv(amount, ACTIVE_PODIUM_BPS, 7000);
            seed[i] = Math.mulDiv(amount, SEED_PODIUM_BPS, 7000);
            allocated += active[i] + seed[i];
        }
        uint256 rem = amount - allocated;
        if (rem > 0) {
            seed[NUM_PODIUMS - 1] += rem;
        }
    }
}
