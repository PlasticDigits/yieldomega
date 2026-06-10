// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArenaXp} from "../src/arena/libraries/ArenaXp.sol";

contract ArenaXpTest is Test {
    /// GitLab #250: table-test level thresholds L1–L10 (step grows +5 until cap).
    function test_level_thresholds_table_levels_1_through_10() public pure {
        assertEq(ArenaXp.xpToAdvance(1), 10);
        assertEq(ArenaXp.xpToAdvance(2), 15);
        assertEq(ArenaXp.xpToAdvance(3), 20);
        assertEq(ArenaXp.xpToAdvance(4), 25);
        assertEq(ArenaXp.xpToAdvance(5), 30);
        assertEq(ArenaXp.xpToAdvance(6), 35);
        assertEq(ArenaXp.xpToAdvance(7), 40);
        assertEq(ArenaXp.xpToAdvance(8), 45);
        assertEq(ArenaXp.xpToAdvance(9), 50);
        assertEq(ArenaXp.xpToAdvance(10), 55);

        uint256 cumulative;
        for (uint256 level = 1; level <= 10; ++level) {
            cumulative += ArenaXp.xpToAdvance(level);
            assertEq(ArenaXp.levelFromXp(cumulative), level + 1, "level entry");
            assertEq(ArenaXp.xpToNextLevel(cumulative), ArenaXp.xpToAdvance(level + 1), "fresh level bar");
        }
    }

    /// GitLab #250: level 17+ uses flat 100 XP/level; level 50+ unchanged.
    function test_level_50_plus_flat_100_xp_per_level() public pure {
        assertEq(ArenaXp.xpToAdvance(18), 95);
        assertEq(ArenaXp.xpToAdvance(19), 100);
        assertEq(ArenaXp.xpToAdvance(50), 100);
        assertEq(ArenaXp.xpToAdvance(100), 100);

        uint256 cumulative;
        for (uint256 level = 1; level < 50; ++level) {
            cumulative += ArenaXp.xpToAdvance(level);
        }
        assertEq(ArenaXp.levelFromXp(cumulative), 50);
        assertEq(ArenaXp.xpToNextLevel(cumulative), 100);

        cumulative += 100;
        assertEq(ArenaXp.levelFromXp(cumulative), 51);
        assertEq(ArenaXp.xpToAdvance(51), 100);
    }

    /// GitLab #250: CHARM band maps to 1–10 XP (integer floor via mulDiv).
    function test_xpForCharm_linear_band() public pure {
        assertEq(ArenaXp.xpForCharm(99e16), 1);
        assertEq(ArenaXp.xpForCharm(10e18), 10);
        assertEq(ArenaXp.xpForCharm(5e18 + 495e15), 5); // mid-band
    }

    function test_applyXpGain_matches_levelFromXp_single_step() public pure {
        uint256 lifetime;
        uint256 lvl = 1;
        uint256 toward;
        uint256[] memory gains = new uint256[](8);
        gains[0] = 3;
        gains[1] = 7;
        gains[2] = 10;
        gains[3] = 1;
        gains[4] = 10;
        gains[5] = 5;
        gains[6] = 10;
        gains[7] = 4;
        for (uint256 i = 0; i < gains.length; ++i) {
            lifetime += gains[i];
            (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, gains[i]);
            assertEq(lvl, ArenaXp.levelFromXp(lifetime), "level drift");
            assertEq(ArenaXp.xpRemainingToNextLevel(lvl, toward), ArenaXp.xpToNextLevel(lifetime));
        }
    }

    function test_applyXpGain_caps_five_level_ups_per_step() public pure {
        uint256 lvl = 1;
        uint256 toward;
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 200);
        assertEq(lvl, ArenaXp.MAX_PLAYER_LEVEL);
        assertEq(toward, 0);
        assertLt(lvl, ArenaXp.levelFromXp(200));
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 50);
        assertEq(lvl, ArenaXp.MAX_PLAYER_LEVEL);
        assertEq(toward, 0);
    }

    function test_applyXpGain_discards_xp_at_max_level() public pure {
        uint256 lvl = ArenaXp.MAX_PLAYER_LEVEL;
        uint256 toward = 5;
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 10);
        assertEq(lvl, ArenaXp.MAX_PLAYER_LEVEL);
        assertEq(toward, 0);
    }

    function test_applyXpGain_eight_levels_two_steps() public pure {
        uint256 lvl = 1;
        uint256 toward;
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 150);
        assertEq(lvl, ArenaXp.MAX_PLAYER_LEVEL);
        assertEq(toward, 0);
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 50);
        assertEq(lvl, ArenaXp.MAX_PLAYER_LEVEL);
        assertEq(toward, 0);
    }

    function testFuzz_applyXpGain_matches_reference(uint8 rawGain, uint8 steps) public pure {
        uint256 xpGain = uint256(rawGain % 11);
        if (xpGain == 0) xpGain = 1;
        uint256 n = uint256(steps % 16) + 1;
        uint256 lifetime;
        uint256 lvl = 1;
        uint256 toward;
        for (uint256 i = 0; i < n; ++i) {
            lifetime += xpGain;
            (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, xpGain);
            uint256 refLevel = ArenaXp.levelFromXp(lifetime);
            if (refLevel > ArenaXp.MAX_PLAYER_LEVEL) refLevel = ArenaXp.MAX_PLAYER_LEVEL;
            assertEq(lvl, refLevel);
        }
    }

}
