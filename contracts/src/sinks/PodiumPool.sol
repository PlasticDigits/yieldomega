// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @notice Holds the TimeCurve **podium pool** slice of routed reserves until `TimeCurve.distributePrizes` runs.
///         `DISTRIBUTOR_ROLE` is granted to TimeCurve so it can push payouts (in the accepted reserve asset).
contract PodiumPool is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    event PodiumPaid(address indexed winner, address indexed token, uint256 amount, uint8 category, uint8 placement);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __AccessControlEnumerable_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Transfer a podium payout to a winner. Only callable by TimeCurve (`DISTRIBUTOR_ROLE`).
    function payPodiumPayout(
        IERC20 token,
        address winner,
        uint256 amount,
        uint8 category,
        uint8 placement
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(winner != address(0), "PodiumPool: zero winner");
        token.safeTransfer(winner, amount);
        emit PodiumPaid(winner, address(token), amount, category, placement);
    }

    uint256[50] private __gap;
}
