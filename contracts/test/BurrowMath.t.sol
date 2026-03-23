// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BurrowMath} from "../src/libraries/BurrowMath.sol";

contract BurrowMathTest is Test {
    uint256 internal constant WAD = 1e18;

    /// @dev Aligns with `simulations/bounded_formulas/model.py` defaults.
    uint256 internal constant C_MAX = 2e18;
    uint256 internal constant C_STAR = 1_050_000_000_000_000_000; // 1.05e18
    uint256 internal constant ALPHA = 2e16; // 0.02
    uint256 internal constant BETA = 2e18;
    uint256 internal constant M_MIN = 98e16; // 0.98
    uint256 internal constant M_MAX = 102e16; // 1.02
    uint256 internal constant LAM = 5e17; // 0.5
    uint256 internal constant DELTA_MAX_FRAC = 2e16; // 0.02
    uint256 internal constant EPS = 1;

    function test_coverage_clips_high() public pure {
        uint256 R = 1e12;
        uint256 S = 1;
        uint256 eWad = 1;
        uint256 C = BurrowMath.coverageWad(R, S, eWad, C_MAX, EPS);
        assertEq(C, C_MAX);
    }

    function test_epoch_invariants_fuzz(
        uint128 Rraw,
        uint128 Sraw,
        uint128 eraw,
        uint128 mWad
    ) public pure {
        uint256 R = uint256(Rraw) + 1;
        uint256 S = uint256(Sraw) + 1;
        uint256 eWad = uint256(eraw) % (1000e18) + 1;

        uint256 C = BurrowMath.coverageWad(R, S, eWad, C_MAX, EPS);
        assertLe(C, C_MAX);

        uint256 m = BurrowMath.clip(uint256(mWad) % (M_MAX - M_MIN + 1) + M_MIN, M_MIN, M_MAX);
        uint256 e2 = BurrowMath.nextEWad(eWad, m, LAM, DELTA_MAX_FRAC);
        assertGt(e2, 0);

        uint256 maxDelta = (DELTA_MAX_FRAC * eWad) / WAD;
        uint256 diff = e2 > eWad ? e2 - eWad : eWad - e2;
        assertLe(diff, maxDelta);
    }

    function test_multiplier_bounds_fuzz(uint256 CWad) public pure {
        CWad = CWad % (C_MAX + 1);
        uint256 m = BurrowMath.multiplierWad(CWad, C_STAR, ALPHA, BETA, M_MIN, M_MAX);
        assertGe(m, M_MIN);
        assertLe(m, M_MAX);
    }

    function test_matches_python_reference_epoch() public pure {
        uint256 R = 1_000_000e18;
        uint256 S = 1_000_000e18;
        uint256 eWad = 1e18;
        uint256 C = BurrowMath.coverageWad(R, S, eWad, C_MAX, EPS);
        uint256 m = BurrowMath.multiplierWad(C, C_STAR, ALPHA, BETA, M_MIN, M_MAX);
        uint256 e2 = BurrowMath.nextEWad(eWad, m, LAM, DELTA_MAX_FRAC);
        assertGt(e2, 0);
        assertGt(m, M_MIN - 1);
        assertLt(m, M_MAX + 1);
    }
}
