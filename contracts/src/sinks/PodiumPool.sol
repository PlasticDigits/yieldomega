// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @notice Holds the TimeCurve **podium pool** slice of routed reserves until `TimeCurve.distributePrizes` runs.
///         Payout pushes are **only** from the configured `prizePusher` (set once to `TimeCurve` after deploy).
/// @dev `DISTRIBUTOR_ROLE` is retained for ABI compatibility; **`payPodiumPayout` uses `prizePusher` only** (GitLab #70).
contract PodiumPool is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice Canonical caller of `payPodiumPayout` (expected: `TimeCurve` proxy). Set once via `setPrizePusher`.
    address public prizePusher;

    event PodiumPaid(address indexed winner, address indexed token, uint256 amount, uint8 category, uint8 placement);
    /// @dev Forwarded when a category slice has no payable placements or partial podium (M-01 / GitLab #116).
    event PodiumResidualForwarded(address indexed token, address indexed recipient, uint256 amount, uint8 category);
    event PrizePusherSet(address indexed pusher);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __AccessControlEnumerable_init();
        __AccessControl_init();
        require(admin != address(0), "PodiumPool: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice One-time wire of the canonical `TimeCurve` that may call `payPodiumPayout` (GitLab #70 production path).
    /// @dev When `prizePusher` is **unset**, `payPodiumPayout` falls back to `DISTRIBUTOR_ROLE` (legacy tests / migration).
    function setPrizePusher(address pusher) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pusher != address(0), "PodiumPool: zero pusher");
        require(prizePusher == address(0), "PodiumPool: pusher already set");
        prizePusher = pusher;
        emit PrizePusherSet(pusher);
    }

    /// @notice Transfer a podium payout to a winner.
    /// @dev If `prizePusher` is set (production), **only** that address may call. Otherwise `DISTRIBUTOR_ROLE` (legacy).
    function payPodiumPayout(
        IERC20 token,
        address winner,
        uint256 amount,
        uint8 category,
        uint8 placement
    ) external {
        if (prizePusher != address(0)) {
            require(msg.sender == prizePusher, "PodiumPool: not prize pusher");
        } else {
            require(hasRole(DISTRIBUTOR_ROLE, msg.sender), "PodiumPool: not distributor");
        }
        require(winner != address(0), "PodiumPool: zero winner");
        token.safeTransfer(winner, amount);
        emit PodiumPaid(winner, address(token), amount, category, placement);
    }

    /// @notice Forward **residual** reserve held for the podium path to protocol or another sink (not a podium winner row).
    /// @dev Mirrors `payPodiumPayout` **auth**: `prizePusher` when set (production), otherwise `DISTRIBUTOR_ROLE`.
    function forwardPodiumResidual(IERC20 token, address recipient, uint256 amount, uint8 category) external {
        if (prizePusher != address(0)) {
            require(msg.sender == prizePusher, "PodiumPool: not prize pusher");
        } else {
            require(hasRole(DISTRIBUTOR_ROLE, msg.sender), "PodiumPool: not distributor");
        }
        require(recipient != address(0), "PodiumPool: zero recipient");
        require(amount > 0, "PodiumPool: zero amount");
        token.safeTransfer(recipient, amount);
        emit PodiumResidualForwarded(address(token), recipient, amount, category);
    }

    uint256[50] private __gap;
}
