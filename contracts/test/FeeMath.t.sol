// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FeeMath} from "../src/libraries/FeeMath.sol";

contract FeeMathTest is Test {
    function test_validateWeights_canonical_split() public pure {
        uint16[] memory w = new uint16[](5);
        w[0] = 2500; // DOUB LP
        w[1] = 3500; // CL8Y buy-and-burn
        w[2] = 2000; // Podium pool
        w[3] = 0; // Team (unused in launch default)
        w[4] = 2000; // Rabbit Treasury
        FeeMath.validateWeights(w);
    }

    function test_validateWeights_reverts_wrong_sum() public {
        uint16[] memory w = new uint16[](2);
        w[0] = 5000;
        w[1] = 4000;
        vm.expectRevert("FeeMath: weights != 10000");
        this.externalValidate(w);
    }

    function test_validateWeights_reverts_single_overflow() public {
        uint16[] memory w = new uint16[](1);
        w[0] = 10_001;
        vm.expectRevert("FeeMath: weight > 10000");
        this.externalValidate(w);
    }

    function externalValidate(uint16[] calldata w) external pure {
        uint16[] memory wm = new uint16[](w.length);
        for (uint256 i; i < w.length; ++i) wm[i] = w[i];
        FeeMath.validateWeights(wm);
    }

    function test_bpsShare_basic() public pure {
        assertEq(FeeMath.bpsShare(10_000, 3500), 3500);
    }

    function test_bpsShare_rounding_down() public pure {
        // 9999 * 3333 / 10000 = 33326667 / 10000 = 3332 (truncated)
        assertEq(FeeMath.bpsShare(9999, 3333), 3332);
    }

    /// @dev Invariant: sum of all shares ≤ total (no over-allocation from rounding).
    function test_bpsShare_no_overallocation_fuzz(uint128 amount) public pure {
        uint256 a = uint256(amount);
        uint256 s1 = FeeMath.bpsShare(a, 2500);
        uint256 s2 = FeeMath.bpsShare(a, 3500);
        uint256 s3 = FeeMath.bpsShare(a, 2000);
        uint256 s4 = FeeMath.bpsShare(a, 0);
        uint256 s5 = FeeMath.bpsShare(a, 2000);
        assertLe(s1 + s2 + s3 + s4 + s5, a, "shares must not exceed total");
    }
}
