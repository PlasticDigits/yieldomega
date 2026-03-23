// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {sd} from "prb-math/sd59x18/Casting.sol";
import {UNIT} from "prb-math/sd59x18/Constants.sol";
import {exp} from "prb-math/sd59x18/Math.sol";
import {SD59x18} from "prb-math/sd59x18/ValueType.sol";

/// @notice Bounded coverage, multiplier, and exchange-rate step for Rabbit Treasury (DOUB / Burrow).
/// @dev Matches Python `simulations/bounded_formulas/model.py` semantics (WAD = 1e18).
library BurrowMath {
    uint256 internal constant WAD = 1e18;

    function clip(uint256 x, uint256 lo, uint256 hi) internal pure returns (uint256) {
        if (x < lo) return lo;
        if (x > hi) return hi;
        return x;
    }

    /// @notice C = min(c_max, R / (S*e + eps)) with all values in WAD-compatible uints (ratio C in WAD).
    function coverageWad(uint256 R, uint256 S, uint256 eWad, uint256 cMaxWad, uint256 eps) internal pure returns (uint256) {
        uint256 denom = Math.mulDiv(S, eWad, WAD) + eps;
        uint256 raw = Math.mulDiv(R, WAD, denom);
        return Math.min(raw, cMaxWad);
    }

    /// @dev tanh(x) via (e^2x - 1)/(e^2x + 1); clamps x to avoid exp edge cases.
    function tanhSd(SD59x18 x) internal pure returns (SD59x18) {
        SD59x18 cap = sd(4e18);
        SD59x18 xx = x;
        if (x > cap) {
            xx = cap;
        } else if (x < -cap) {
            xx = -cap;
        }
        SD59x18 twoX = xx * sd(2e18);
        SD59x18 e2x = exp(twoX);
        SD59x18 one = UNIT;
        return (e2x - one) / (e2x + one);
    }

    /// @notice m = clip(1 + alpha * tanh(beta * (C - c*)), m_min, m_max) with WAD inputs.
    function multiplierWad(
        uint256 CWad,
        uint256 cStarWad,
        uint256 alphaWad,
        uint256 betaWad,
        uint256 mMinWad,
        uint256 mMaxWad
    ) internal pure returns (uint256 mWad) {
        SD59x18 C = sd(int256(CWad));
        SD59x18 cStar = sd(int256(cStarWad));
        SD59x18 diff = C - cStar;
        SD59x18 betaD = diff * sd(int256(betaWad));
        SD59x18 t = tanhSd(betaD);
        SD59x18 inner = UNIT + sd(int256(alphaWad)) * t;
        int256 i = inner.unwrap();
        require(i > 0, "BurrowMath: inner<=0");
        mWad = clip(uint256(i), mMinWad, mMaxWad);
    }

    /// @notice One smoothing step toward e * m with per-epoch relative cap on |Δe|.
    function nextEWad(uint256 eWad, uint256 mWad, uint256 lamWad, uint256 deltaMaxFracWad) internal pure returns (uint256 eNext) {
        uint256 eTarget = Math.mulDiv(eWad, mWad, WAD);
        int256 delta = int256(eTarget) - int256(eWad);
        int256 step = delta * int256(lamWad) / int256(WAD);
        uint256 maxDelta = Math.mulDiv(deltaMaxFracWad, eWad, WAD);
        if (step > int256(maxDelta)) step = int256(maxDelta);
        if (step < -int256(maxDelta)) step = -int256(maxDelta);
        int256 en = int256(eWad) + step;
        require(en > 0, "BurrowMath: e<=0");
        eNext = uint256(en);
    }
}
