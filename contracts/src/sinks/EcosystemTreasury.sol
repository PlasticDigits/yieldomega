// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FeeSink} from "./FeeSink.sol";

/// @notice CL8Y-governed pool for grants, new games, consumer goods, and tools.
///         Not a direct TimeCurve fee sink — funded via governance allocations.
contract EcosystemTreasury is FeeSink {
    function initialize(address admin) external initializer {
        __FeeSink_init(admin);
    }
}
