// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ICharmPrice} from "../interfaces/ICharmPrice.sol";

/// @title LinearCharmPrice — price = base + (dailyIncrement × elapsed / 1 day)
/// @notice Default DOUB schedule: e.g. **$1.0** per 1e18 CHARM at start, **+$0.10** per **elapsed sale day** per 1e18 CHARM (linear in **time**, not in how many charms are bought).
///         Production: UUPS proxy; **proxy address** is canonical (GitLab #54).
contract LinearCharmPrice is Initializable, OwnableUpgradeable, UUPSUpgradeable, ICharmPrice {
    uint256 internal constant SECONDS_PER_DAY = 86_400;

    uint256 public basePriceWad;
    uint256 public dailyIncrementWad;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _basePriceWad, uint256 _dailyIncrementWad, address initialOwner) external initializer {
        require(_basePriceWad > 0, "LinearCharmPrice: zero base");
        __Ownable_init(initialOwner);
        basePriceWad = _basePriceWad;
        dailyIncrementWad = _dailyIncrementWad;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @inheritdoc ICharmPrice
    function priceWad(uint256 elapsed) external view override returns (uint256) {
        return basePriceWad + Math.mulDiv(dailyIncrementWad, elapsed, SECONDS_PER_DAY);
    }

    uint256[50] private __gap;
}
