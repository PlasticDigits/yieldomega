// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice XP and level math for TimeArena (#250).
library ArenaXp {
    uint256 internal constant CHARM_MIN_WAD = 99e16;
    uint256 internal constant CHARM_MAX_WAD = 10e18;

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
        if (level == 0) return 20;
        uint256 step = 20 + (level - 1) * 5;
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
}
