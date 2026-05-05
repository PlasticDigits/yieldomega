// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title RabbitTreasuryVault
/// @notice Interim custody for the **FeeRouter** fifth sink (Rabbit slice): receives **`ERC20.safeTransfer`**
///         from `FeeRouter.distributeFees` with **no** dedicated deposit hook ([GitLab #159](https://gitlab.com/PlasticDigits/yieldomega/-/issues/159), EcoStrategy audit **H-01**).
/// @dev **`ERC20` balances held here are not `RabbitTreasury.protocolOwnedBacking`.** Burrow books protocol-owned
///      reserve through `RabbitTreasury.receiveFee` (and related Burrow events). Tokens resting in this vault are
///      **unbooked** until governance routes them into Rabbit or another audited sink.
/// @dev Governance may sweep to a multisig, a future `RabbitTreasury` proxy, or swap routers—**no** mandatory lock.
contract RabbitTreasuryVault is Ownable2Step {
    using SafeERC20 for IERC20;
    using Address for address payable;

    event ERC20Withdrawn(address indexed token, address indexed to, uint256 amount, string reason);
    event ETHWithdrawn(address indexed to, uint256 amount, string reason);

    /// @param initialOwner Admin / timelock successor for **`withdrawERC20`** / **`withdrawETH`** (two-step transfer via `Ownable2Step`).
    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    /// @notice Sweep ERC20 held by this contract.
    function withdrawERC20(IERC20 token, address to, uint256 amount, string calldata reason) external onlyOwner {
        require(to != address(0), "RabbitTreasuryVault: zero to");
        require(amount > 0, "RabbitTreasuryVault: zero amount");
        token.safeTransfer(to, amount);
        emit ERC20Withdrawn(address(token), to, amount, reason);
    }

    /// @notice Sweep native ETH held by this contract (e.g. accidental transfers).
    function withdrawETH(address payable to, uint256 amount, string calldata reason) external onlyOwner {
        require(to != address(0), "RabbitTreasuryVault: zero to");
        require(amount > 0, "RabbitTreasuryVault: zero amount");
        to.sendValue(amount);
        emit ETHWithdrawn(to, amount, reason);
    }
}
