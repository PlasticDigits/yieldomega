// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Pure DOUB split math for TimeArena buys (100% podiums · 25% × 4 · 70/20/10 epoch tranches).
library ArenaBuyRouting {
    uint256 internal constant BPS_DENOM = 10_000;

    /// @dev 25% per podium category; remainder wei → category 0 (Last Buy).
    uint16 internal constant PODIUM_SHARE_BPS = 2500;
    uint16 internal constant TRANCHE_CURRENT_BPS = 7000;
    uint16 internal constant TRANCHE_NEXT_BPS = 2000;

    /// @dev Legacy top-up: 10:7.5 active:seed per category (unchanged — GitLab #261).
    uint16 internal constant TOPUP_ACTIVE_BPS = 1000;
    uint16 internal constant TOPUP_SEED_BPS = 750;

    uint8 internal constant NUM_PODIUMS = 4;

    /// @dev 100% to four podiums at 25% each; within each category 70% / 20% / 10% to epoch+0 / +1 / +2.
    /// Remainder from `amount / 4` → category 0 (Last Buy); within-category remainder → 10% tranche.
    function splitBuyAmount(uint256 amount)
        internal
        pure
        returns (uint256[NUM_PODIUMS] memory current, uint256[NUM_PODIUMS] memory next, uint256[NUM_PODIUMS] memory next2)
    {
        uint256 baseShare = amount / NUM_PODIUMS;
        uint256 catRem = amount % NUM_PODIUMS;
        for (uint8 i; i < NUM_PODIUMS; ++i) {
            uint256 share = baseShare + (i == 0 ? catRem : 0);
            current[i] = Math.mulDiv(share, TRANCHE_CURRENT_BPS, BPS_DENOM);
            next[i] = Math.mulDiv(share, TRANCHE_NEXT_BPS, BPS_DENOM);
            next2[i] = share - current[i] - next[i];
        }
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
            active[i] = Math.mulDiv(amount, TOPUP_ACTIVE_BPS, 7000);
            seed[i] = Math.mulDiv(amount, TOPUP_SEED_BPS, 7000);
            allocated += active[i] + seed[i];
        }
        uint256 rem = amount - allocated;
        if (rem > 0) {
            seed[NUM_PODIUMS - 1] += rem;
        }
    }
}
