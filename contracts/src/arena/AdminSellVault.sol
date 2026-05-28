// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Holds the admin share of each buy (30% of DOUB paid).
contract AdminSellVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable doub;
    address public arena;

    event AdminVaultFunded(uint256 amount);

    constructor(IERC20 doubToken, address owner_) Ownable(owner_) {
        require(address(doubToken) != address(0), "AdminSellVault: zero doub");
        doub = doubToken;
    }

    function setArena(address arena_) external onlyOwner {
        require(arena_ != address(0), "AdminSellVault: zero arena");
        arena = arena_;
    }

    function notifyFunded(uint256 amount) external {
        require(msg.sender == arena, "AdminSellVault: not arena");
        emit AdminVaultFunded(amount);
    }

    function rescueDoub(address to, uint256 amount) external onlyOwner {
        doub.safeTransfer(to, amount);
    }
}
