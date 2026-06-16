// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal TimeArena views for dynamic referral registration burns (DOUB per CHARM epoch anchor).
interface ITimeArenaReferralBurn {
    function epochCharmAnchorWad() external view returns (uint256);
    function charmPriceWad() external view returns (uint256);
    function doub() external view returns (IERC20);
}
