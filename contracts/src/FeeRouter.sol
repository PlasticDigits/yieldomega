// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {FeeMath} from "./libraries/FeeMath.sol";

/// @notice Routes fees from TimeCurve (and future primitives) to canonical sinks.
/// @dev Weights are in basis points and must sum to 10 000.
///      Post-update invariants per docs/onchain/fee-routing-and-governance.md.
///      Sink order (TimeCurve launch default): DOUB/CL8Y LP · **CL8Y burned** (sale asset burn sink) · podium pool · team (may be 0 bps) · Rabbit Treasury.
///      The **last** sink receives rounding remainder from `distributeFees`.
///      Production deployments use a UUPS proxy; **proxy address** is canonical for integrators (GitLab #54).
contract FeeRouter is Initializable, AccessControlEnumerableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    uint8 public constant NUM_SINKS = 5;

    struct Sink {
        address destination;
        uint16 weightBps;
    }

    Sink[5] public sinks;

    event SinksUpdated(
        address indexed actor,
        address[5] oldDestinations,
        uint16[5] oldWeights,
        address[5] newDestinations,
        uint16[5] newWeights
    );
    event FeesDistributed(address indexed token, uint256 amount, uint256[5] shares);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address[5] memory destinations, uint16[5] memory weights)
        external
        initializer
    {
        __AccessControlEnumerable_init();
        __AccessControl_init();
        require(admin != address(0), "FeeRouter: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
        _setSinks(destinations, weights);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Distribute `amount` of `token` held by this contract to all sinks.
    ///         Last sink receives any rounding remainder to prevent dust loss.
    function distributeFees(IERC20 token, uint256 amount) external {
        require(amount > 0, "FeeRouter: zero amount");
        uint256 remaining = amount;
        uint256[5] memory shares;

        for (uint8 i; i < NUM_SINKS - 1; ++i) {
            uint256 share = FeeMath.bpsShare(amount, sinks[i].weightBps);
            shares[i] = share;
            remaining -= share;
            token.safeTransfer(sinks[i].destination, share);
        }
        shares[NUM_SINKS - 1] = remaining;
        token.safeTransfer(sinks[NUM_SINKS - 1].destination, remaining);

        emit FeesDistributed(address(token), amount, shares);
    }

    /// @notice Update sink destinations and weights. Emits old+new values per invariant spec.
    function updateSinks(address[5] calldata destinations, uint16[5] calldata weights)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        address[5] memory oldDest;
        uint16[5] memory oldW;
        for (uint8 i; i < NUM_SINKS; ++i) {
            oldDest[i] = sinks[i].destination;
            oldW[i] = sinks[i].weightBps;
        }
        _setSinks(destinations, weights);
        address[5] memory newDest;
        uint16[5] memory newW;
        for (uint8 i; i < NUM_SINKS; ++i) {
            newDest[i] = destinations[i];
            newW[i] = weights[i];
        }
        emit SinksUpdated(msg.sender, oldDest, oldW, newDest, newW);
    }

    function _setSinks(address[5] memory destinations, uint16[5] memory weights) internal {
        uint16[] memory w = new uint16[](NUM_SINKS);
        for (uint8 i; i < NUM_SINKS; ++i) {
            require(destinations[i] != address(0), "FeeRouter: zero address");
            w[i] = weights[i];
        }
        FeeMath.validateWeights(w);
        for (uint8 i; i < NUM_SINKS; ++i) {
            sinks[i] = Sink(destinations[i], weights[i]);
        }
    }

    uint256[50] private __gap;
}
