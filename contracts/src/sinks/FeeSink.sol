// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @notice Base for upgradeable fee sink deployments — receives tokens from FeeRouter,
///         allows governed withdrawal. Canonical envs use UUPS proxies per GitLab #54.
abstract contract FeeSink is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    event Withdrawn(address indexed token, address indexed to, uint256 amount, address indexed actor);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __FeeSink_init(address admin) internal onlyInitializing {
        __AccessControlEnumerable_init();
        __AccessControl_init();
        require(admin != address(0), "FeeSink: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(WITHDRAWER_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Withdraw tokens held by this sink. Governed by WITHDRAWER_ROLE.
    function withdraw(IERC20 token, address to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        require(to != address(0), "FeeSink: zero address");
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount, msg.sender);
    }

    uint256[50] private __gap;
}
