// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArenaBuyRouting} from "../src/arena/libraries/ArenaBuyRouting.sol";

contract ArenaPrizeRoutingTest is Test {
    function test_split_1000_doub_epoch_tranches() public pure {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) =
            ArenaBuyRouting.splitBuyAmount(1000e18);
        for (uint8 i; i < 4; ++i) {
            assertEq(cur[i], 175e18, "70% of 250e18");
            assertEq(nxt[i], 50e18, "20% of 250e18");
            assertEq(nxt2[i], 25e18, "10% of 250e18");
        }
        uint256 sum;
        for (uint8 i; i < 4; ++i) {
            sum += cur[i] + nxt[i] + nxt2[i];
        }
        assertEq(sum, 1000e18);
    }

    function test_split_remainder_to_last_buy_and_t10_tranche() public pure {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) =
            ArenaBuyRouting.splitBuyAmount(1003);
        // 1003 / 4 = 250 rem 3 → cat 0 (Last Buy) share = 253
        assertEq(cur[0] + nxt[0] + nxt2[0], 253);
        assertEq(cur[3] + nxt[3] + nxt2[3], 250);
        uint256 sum;
        for (uint8 i; i < 4; ++i) {
            sum += cur[i] + nxt[i] + nxt2[i];
        }
        assertEq(sum, 1003);
    }

    function test_splitPrizeTopUp_700_matches_legacy_ratio() public pure {
        (uint256[4] memory act, uint256[4] memory sed) = ArenaBuyRouting.splitPrizeTopUpAmount(700e18);
        uint256 sum;
        for (uint8 i; i < 4; ++i) {
            assertEq(act[i], 100e18, "active per category");
            assertEq(sed[i], 75e18, "seed per category");
            sum += act[i] + sed[i];
        }
        assertEq(sum, 700e18);
    }

    function testFuzz_splitBuy_no_dust(uint256 amount) public pure {
        amount = bound(amount, 1, type(uint128).max);
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) =
            ArenaBuyRouting.splitBuyAmount(amount);
        uint256 sum;
        for (uint8 i; i < 4; ++i) {
            sum += cur[i] + nxt[i] + nxt2[i];
        }
        assertEq(sum, amount);
    }

    function testFuzz_splitPrizeTopUp_no_dust(uint256 amount) public pure {
        amount = bound(amount, 1, type(uint128).max);
        (uint256[4] memory act, uint256[4] memory sed) = ArenaBuyRouting.splitPrizeTopUpAmount(amount);
        uint256 sum;
        for (uint8 i; i < 4; ++i) {
            sum += act[i] + sed[i];
        }
        assertEq(sum, amount);
    }

    function testFuzz_epoch_split_per_category_bps(uint256 amount) public pure {
        amount = bound(amount, 4, type(uint128).max);
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) =
            ArenaBuyRouting.splitBuyAmount(amount);
        uint256 baseShare = amount / 4;
        uint256 catRem = amount % 4;
        for (uint8 i; i < 4; ++i) {
            uint256 share = baseShare + (i == 0 ? catRem : 0);
            assertLe(cur[i], share);
            assertLe(nxt[i], share);
            assertLe(nxt2[i], share);
            assertEq(cur[i] + nxt[i] + nxt2[i], share);
        }
        if (catRem > 0) {
            assertEq(cur[0] + nxt[0] + nxt2[0], baseShare + catRem, "remainder to Last Buy cat 0");
        }
    }

    /// GitLab #313: cross-category remainder wei always lands on Last Buy (cat 0).
    function testFuzz_split_remainder_on_cat0(uint256 amount) public pure {
        amount = bound(amount, 1, type(uint128).max);
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) =
            ArenaBuyRouting.splitBuyAmount(amount);
        uint256 baseShare = amount / 4;
        uint256 catRem = amount % 4;
        assertEq(cur[0] + nxt[0] + nxt2[0], baseShare + catRem);
        for (uint8 i = 1; i < 4; ++i) {
            assertEq(cur[i] + nxt[i] + nxt2[i], baseShare);
        }
    }
}
