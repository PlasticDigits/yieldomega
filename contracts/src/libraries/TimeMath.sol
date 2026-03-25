// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {sd} from "prb-math/sd59x18/Casting.sol";
import {exp} from "prb-math/sd59x18/Math.sol";
import {SD59x18} from "prb-math/sd59x18/ValueType.sol";

/// @notice Deterministic time-based growth and timer helpers for TimeCurve.
/// @dev All WAD values use 1e18 fixed-point.
library TimeMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SECONDS_PER_DAY = 86_400;

    /// @notice Compute current minimum buy: initialMinBuy * exp(growthRateWad * elapsed / 86400).
    /// @param initialMinBuy Starting minimum buy amount (asset decimals).
    /// @param growthRateWad  ln(1 + dailyGrowthFrac) in WAD. For 25%/day: ~223_143_551_314_209_700.
    /// @param elapsed        Seconds since sale start.
    /// @return minBuy        Current minimum buy (same decimals as initialMinBuy).
    function currentMinBuy(
        uint256 initialMinBuy,
        uint256 growthRateWad,
        uint256 elapsed
    ) internal pure returns (uint256 minBuy) {
        if (elapsed == 0) return initialMinBuy;
        // exponent = growthRateWad * elapsed / SECONDS_PER_DAY (already in WAD)
        uint256 exponentRaw = growthRateWad * elapsed / SECONDS_PER_DAY;
        SD59x18 factor = exp(sd(int256(exponentRaw)));
        minBuy = Math.mulDiv(initialMinBuy, uint256(factor.unwrap()), WAD);
    }

    /// @notice Extend deadline, capped so remaining time never exceeds timerCap.
    /// @return newDeadline The updated deadline (capped).
    function extendDeadline(
        uint256 currentDeadline,
        uint256 currentTimestamp,
        uint256 extensionSec,
        uint256 timerCapSec
    ) internal pure returns (uint256 newDeadline) {
        uint256 base = currentDeadline > currentTimestamp ? currentDeadline : currentTimestamp;
        uint256 extended = base + extensionSec;
        uint256 maxDeadline = currentTimestamp + timerCapSec;
        newDeadline = extended < maxDeadline ? extended : maxDeadline;
    }
}
