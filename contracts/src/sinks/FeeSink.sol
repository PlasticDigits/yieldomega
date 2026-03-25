// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @notice Base contract for fee sink deployments — receives tokens from FeeRouter,
///         allows governed withdrawal. Each concrete sink is a separate deployment
///         per docs/onchain/treasury-contracts.md.
abstract contract FeeSink is AccessControlEnumerable {
    using SafeERC20 for IERC20;

    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    event Withdrawn(address indexed token, address indexed to, uint256 amount, address indexed actor);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(WITHDRAWER_ROLE, admin);
    }

    /// @notice Withdraw tokens held by this sink. Governed by WITHDRAWER_ROLE.
    function withdraw(IERC20 token, address to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        require(to != address(0), "FeeSink: zero address");
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount, msg.sender);
    }
}
