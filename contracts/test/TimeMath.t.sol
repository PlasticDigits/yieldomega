// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TimeMath} from "../src/libraries/TimeMath.sol";

contract TimeMathTest is Test {
    uint256 internal constant WAD = 1e18;
    // ln(1.2) ≈ 0.18232155... in WAD
    uint256 internal constant GROWTH_RATE_20PCT = 182_321_556_793_954_592;
    uint256 internal constant ONE_DAY = 86_400;

    function test_minBuy_zero_elapsed() public pure {
        uint256 mb = TimeMath.currentMinBuy(1e18, GROWTH_RATE_20PCT, 0);
        assertEq(mb, 1e18);
    }

    function test_minBuy_one_day_approx_120pct() public pure {
        uint256 mb = TimeMath.currentMinBuy(1e18, GROWTH_RATE_20PCT, ONE_DAY);
        // After 1 day should be ~1.2e18 (within 0.01% tolerance)
        assertApproxEqRel(mb, 1.2e18, 1e14);
    }

    function test_minBuy_two_days() public pure {
        uint256 mb = TimeMath.currentMinBuy(1e18, GROWTH_RATE_20PCT, 2 * ONE_DAY);
        // 1.2^2 = 1.44
        assertApproxEqRel(mb, 1.44e18, 1e14);
    }

    /// @dev Invariant: min buy is monotonically non-decreasing with elapsed time.
    function test_minBuy_monotonic_fuzz(uint32 t1, uint32 t2) public pure {
        uint256 elapsed1 = uint256(t1) % (365 * ONE_DAY);
        uint256 elapsed2 = elapsed1 + (uint256(t2) % ONE_DAY);
        uint256 mb1 = TimeMath.currentMinBuy(1e18, GROWTH_RATE_20PCT, elapsed1);
        uint256 mb2 = TimeMath.currentMinBuy(1e18, GROWTH_RATE_20PCT, elapsed2);
        assertGe(mb2, mb1, "min buy must not decrease");
    }

    function test_extendDeadline_basic() public pure {
        uint256 dl = TimeMath.extendDeadline(1100, 1000, 60, 86_400);
        assertEq(dl, 1160); // 1100 + 60
    }

    function test_extendDeadline_caps_at_timerMax() public pure {
        uint256 dl = TimeMath.extendDeadline(87_400, 1000, 60, 86_400);
        // maxDeadline = 1000 + 86400 = 87400; extended = 87400 + 60 = 87460 > 87400
        assertEq(dl, 87_400);
    }

    function test_extendDeadline_past_deadline_uses_now() public pure {
        // Deadline already passed (900 < 1000)
        uint256 dl = TimeMath.extendDeadline(900, 1000, 60, 86_400);
        assertEq(dl, 1060); // 1000 + 60
    }

    /// GitLab #246: Last Buy timer profile — +120s extend, 13m→15m hard reset, 96h cap.
    uint256 internal constant ARENA_EXTENSION = 120;
    uint256 internal constant ARENA_TIMER_CAP = 4 * 86_400;
    uint256 internal constant ARENA_RESET_BELOW = 780;
    uint256 internal constant ARENA_RESET_TO = 900;

    function test_extendDeadlineOrReset_hardReset_arenaProfile() public pure {
        uint256 tNow = 10_000;
        uint256 deadline = tNow + 600; // 10m remaining < 13m
        (uint256 newDl, bool didReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadline, tNow, ARENA_EXTENSION, ARENA_TIMER_CAP, ARENA_RESET_BELOW, ARENA_RESET_TO
        );
        assertTrue(didReset);
        assertEq(newDl, tNow + ARENA_RESET_TO);
    }

    function test_extendDeadlineOrReset_extension_arenaProfile() public pure {
        uint256 tNow = 10_000;
        uint256 deadline = tNow + 2000; // > 13m remaining
        (uint256 newDl, bool didReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadline, tNow, ARENA_EXTENSION, ARENA_TIMER_CAP, ARENA_RESET_BELOW, ARENA_RESET_TO
        );
        assertFalse(didReset);
        assertEq(newDl, deadline + ARENA_EXTENSION);
    }

    function testFuzz_extendDeadlineOrReset_arenaProfile(
        uint32 deadlineOffset,
        uint32 nowOffset,
        uint16 extensionRaw
    ) public pure {
        uint256 tNow = uint256(nowOffset) % (365 days);
        uint256 deadline = tNow + (uint256(deadlineOffset) % ARENA_TIMER_CAP);
        uint256 extension = (uint256(extensionRaw) % 600) + 1;

        (uint256 newDl, bool didReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadline, tNow, extension, ARENA_TIMER_CAP, ARENA_RESET_BELOW, ARENA_RESET_TO
        );

        assertLe(newDl, tNow + ARENA_TIMER_CAP, "capped by timerCapSec");
        uint256 remaining = deadline > tNow ? deadline - tNow : 0;
        if (didReset) {
            assertLt(remaining, ARENA_RESET_BELOW, "hard reset only below threshold");
            assertEq(newDl, tNow + ARENA_RESET_TO < tNow + ARENA_TIMER_CAP ? tNow + ARENA_RESET_TO : tNow + ARENA_TIMER_CAP);
        } else {
            assertGe(remaining, ARENA_RESET_BELOW);
            uint256 base = deadline > tNow ? deadline : tNow;
            uint256 expected = base + extension;
            if (expected > tNow + ARENA_TIMER_CAP) expected = tNow + ARENA_TIMER_CAP;
            assertEq(newDl, expected);
        }
    }
}
