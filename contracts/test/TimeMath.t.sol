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
}
