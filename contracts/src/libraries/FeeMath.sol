// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Basis-point weight validation for fee routing.
library FeeMath {
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Revert if weights do not sum to 10 000 bps or any weight exceeds 10 000.
    function validateWeights(uint16[] memory weights) internal pure {
        uint256 total;
        for (uint256 i; i < weights.length; ++i) {
            require(weights[i] <= BPS_DENOMINATOR, "FeeMath: weight > 10000");
            total += weights[i];
        }
        require(total == BPS_DENOMINATOR, "FeeMath: weights != 10000");
    }

    /// @notice Compute share of amount for a given weight in bps. Last-sink-gets-remainder pattern
    ///         should be applied by the caller to avoid dust loss.
    function bpsShare(uint256 amount, uint16 weightBps) internal pure returns (uint256) {
        return (amount * weightBps) / BPS_DENOMINATOR;
    }
}
