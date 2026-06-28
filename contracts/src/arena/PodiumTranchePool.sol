// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Dedicated DOUB holder for one PodiumVaults tranche slot (non-commingled wiring).
/// TimeArena sends buy/top-up DOUB directly here; only `operator` (PodiumVaults) can disburse.
contract PodiumTranchePool {
    using SafeERC20 for IERC20;

    IERC20 public immutable doub;
    address public immutable operator;

    constructor(IERC20 doubToken, address operator_) {
        require(address(doubToken) != address(0), "PodiumTranchePool: zero doub");
        require(operator_ != address(0), "PodiumTranchePool: zero operator");
        doub = doubToken;
        operator = operator_;
    }

    function pushTo(address to, uint256 amount) external {
        require(msg.sender == operator, "PodiumTranchePool: not operator");
        doub.safeTransfer(to, amount);
    }
}
