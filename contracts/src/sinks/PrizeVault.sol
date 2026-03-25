// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @notice Holds 35 % of TimeCurve fees until prizes are distributed.
///         DISTRIBUTOR_ROLE is granted to the TimeCurve contract so it can
///         push prize payouts to winners after sale ends.
contract PrizeVault is AccessControlEnumerable {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    event PrizePaid(address indexed winner, address indexed token, uint256 amount, uint8 category, uint8 placement);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Transfer prize to a winner. Only callable by TimeCurve (DISTRIBUTOR_ROLE).
    function payPrize(
        IERC20 token,
        address winner,
        uint256 amount,
        uint8 category,
        uint8 placement
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(winner != address(0), "PrizeVault: zero winner");
        token.safeTransfer(winner, amount);
        emit PrizePaid(winner, address(token), amount, category, placement);
    }
}
