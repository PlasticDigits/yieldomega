// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArenaXp} from "../src/arena/libraries/ArenaXp.sol";

contract ArenaXpTest is Test {
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
        assertEq(lvl, 6);
        assertLt(lvl, ArenaXp.levelFromXp(200));
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 50);
        assertEq(lvl, ArenaXp.levelFromXp(250));
    }

    function test_applyXpGain_eight_levels_two_steps() public pure {
        uint256 lvl = 1;
        uint256 toward;
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 150);
        assertEq(lvl, 6);
        (lvl, toward) = ArenaXp.applyXpGain(lvl, toward, 50);
        assertEq(lvl, ArenaXp.levelFromXp(200));
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
            assertEq(lvl, ArenaXp.levelFromXp(lifetime));
        }
    }

}
