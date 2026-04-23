// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FeeSink} from "./FeeSink.sol";

/// @notice Optional **legacy** sink for CL8Y held pending offchain automation.
///         Canonical TimeCurve routing sends the burn slice to `0x…dEaD` (sale asset is already CL8Y).
contract CL8YProtocolTreasury is FeeSink {
    function initialize(address admin) external initializer {
        __FeeSink_init(admin);
    }
}
