// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICharmPrice} from "../interfaces/ICharmPrice.sol";

/// @title LinearCharmPrice — price = base + (dailyIncrement × elapsed / 1 day)
/// @notice Default DOUB schedule: e.g. **$1.0** per 1e18 CHARM at start, **+$0.10** per **elapsed sale day** per 1e18 CHARM (linear in **time**, not in how many charms are bought).
contract LinearCharmPrice is ICharmPrice {
    uint256 internal constant SECONDS_PER_DAY = 86_400;

    uint256 public immutable basePriceWad;
    uint256 public immutable dailyIncrementWad;

    constructor(uint256 _basePriceWad, uint256 _dailyIncrementWad) {
        require(_basePriceWad > 0, "LinearCharmPrice: zero base");
        basePriceWad = _basePriceWad;
        dailyIncrementWad = _dailyIncrementWad;
    }

    /// @inheritdoc ICharmPrice
    function priceWad(uint256 elapsed) external view override returns (uint256) {
        return basePriceWad + Math.mulDiv(dailyIncrementWad, elapsed, SECONDS_PER_DAY);
    }
}
