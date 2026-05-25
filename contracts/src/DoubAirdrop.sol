// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DoubAirdrop
/// @notice Batch-send an ERC-20 (typically DOUB) to many recipients in one transaction (disperse.app-style).
/// @dev Caller must `approve` this contract for the sum of `values` before `disperseToken`.
contract DoubAirdrop is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error LengthMismatch();
    error EmptyBatch();
    error ZeroRecipient();
    error ZeroAmount();

    event AirdropDispersed(
        address indexed token, address indexed sender, uint256 recipientCount, uint256 totalAmount
    );

    /// @notice Pull `token` from `msg.sender` and transfer `values[i]` to `recipients[i]`.
    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values)
        external
        nonReentrant
    {
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != values.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i; i < len; ++i) {
            if (recipients[i] == address(0)) revert ZeroRecipient();
            uint256 amt = values[i];
            if (amt == 0) revert ZeroAmount();
            total += amt;
        }

        token.safeTransferFrom(msg.sender, address(this), total);

        for (uint256 i; i < len; ++i) {
            token.safeTransfer(recipients[i], values[i]);
        }

        emit AirdropDispersed(address(token), msg.sender, len, total);
    }
}
