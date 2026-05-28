// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArenaBuyRouting} from "../src/arena/libraries/ArenaBuyRouting.sol";

contract ArenaPrizeRoutingTest is Test {
    function test_split_1000_doub() public pure {
        (uint256[4] memory act, uint256[4] memory sed, uint256 admin) = ArenaBuyRouting.splitBuyAmount(1000e18);
        assertEq(act[0], 100e18);
        assertEq(sed[0], 75e18);
        assertEq(admin, 300e18);
        uint256 sum = admin;
        for (uint8 i; i < 4; ++i) {
            sum += act[i] + sed[i];
        }
        assertEq(sum, 1000e18);
    }
}
