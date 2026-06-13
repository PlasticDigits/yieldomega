// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ArenaCharmBounds} from "./ArenaCharmBounds.sol";

/// @notice XP and level math for TimeArena (#250, #265).
library ArenaXp {
    uint256 internal constant CHARM_MIN_WAD = ArenaCharmBounds.CHARM_MIN_WAD;
    uint256 internal constant CHARM_MAX_WAD = ArenaCharmBounds.CHARM_MAX_WAD;
    uint256 internal constant MAX_LEVEL_UPS_PER_BUY = 5;
    /// @dev Player progression cap (#299); surplus XP at max level is discarded.
    uint256 internal constant MAX_PLAYER_LEVEL = 5;
    /// @dev Onboarding reference CHARM for first-buy CRED tuning (#299).
    uint256 internal constant ONBOARDING_STARTER_CHARM_WAD = 10e18;

    /// @dev Maps charm in [0.99, 10] CHARM to [1, 10] XP (floor).
    function xpForCharm(uint256 charmWad) internal pure returns (uint256) {
        if (charmWad <= CHARM_MIN_WAD) return 1;
        if (charmWad >= CHARM_MAX_WAD) return 10;
        uint256 range = CHARM_MAX_WAD - CHARM_MIN_WAD;
        uint256 extra = Math.mulDiv(charmWad - CHARM_MIN_WAD, 9, range);
        return 1 + extra;
    }

    function levelFromXp(uint256 xp) internal pure returns (uint256 level) {
        level = 1;
        uint256 rem = xp;
        while (true) {
            uint256 need = xpToAdvance(level);
            if (rem < need) break;
            rem -= need;
            level += 1;
        }
    }

    function xpToAdvance(uint256 level) internal pure returns (uint256) {
        if (level == 0) return 10;
        uint256 step = 10 + (level - 1) * 5;
        if (step > 100) step = 100;
        return step;
    }

    function xpToNextLevel(uint256 xp) internal pure returns (uint256) {
        uint256 level = levelFromXp(xp);
        uint256 used;
        for (uint256 l = 1; l < level; ++l) {
            used += xpToAdvance(l);
        }
        uint256 need = xpToAdvance(level);
        uint256 inLevel = xp - used;
        return need > inLevel ? need - inLevel : 0;
    }

    /// @dev O(1) buy-path progression: add charm XP, consume thresholds, cap level-ups per buy (#265).
    function applyXpGain(uint256 level, uint256 xpTowardNext, uint256 xpGain)
        internal
        pure
        returns (uint256 newLevel, uint256 newXpTowardNext)
    {
        require(level >= 1, "ArenaXp: level");
        if (level >= MAX_PLAYER_LEVEL) {
            return (MAX_PLAYER_LEVEL, 0);
        }
        newLevel = level;
        newXpTowardNext = xpTowardNext + xpGain;
        uint256 levelsGained;
        while (levelsGained < MAX_LEVEL_UPS_PER_BUY && newLevel < MAX_PLAYER_LEVEL) {
            uint256 need = xpToAdvance(newLevel);
            if (newXpTowardNext < need) break;
            newXpTowardNext -= need;
            newLevel += 1;
            levelsGained += 1;
        }
        if (newLevel >= MAX_PLAYER_LEVEL) {
            newLevel = MAX_PLAYER_LEVEL;
            newXpTowardNext = 0;
        }
    }

    function clampLevel(uint256 level) internal pure returns (uint256) {
        return level > MAX_PLAYER_LEVEL ? MAX_PLAYER_LEVEL : level;
    }

    function xpRemainingToNextLevel(uint256 level, uint256 xpTowardNext) internal pure returns (uint256) {
        require(level >= 1, "ArenaXp: level");
        if (level >= MAX_PLAYER_LEVEL) return 0;
        uint256 need = xpToAdvance(level);
        return need > xpTowardNext ? need - xpTowardNext : 0;
    }
}
