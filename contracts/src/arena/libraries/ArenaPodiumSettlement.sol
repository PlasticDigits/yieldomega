// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice 4:2:1 payout weights for podium settlement (#247).
library ArenaPodiumSettlement {
    uint256 internal constant WEIGHT_SUM = 7;

    function payoutShares(uint256 pool) internal pure returns (uint256 first, uint256 second, uint256 third) {
        first = Math.mulDiv(pool, 4, WEIGHT_SUM);
        second = Math.mulDiv(pool, 2, WEIGHT_SUM);
        third = pool - first - second;
    }
}
