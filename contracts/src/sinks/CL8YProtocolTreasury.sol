// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FeeSink} from "./FeeSink.sol";

/// @notice Receives 15 % of TimeCurve fees for CL8Y buy-and-burn.
///         Withdrawal executes the buy-and-burn (offchain orchestration or
///         future onchain automation).
contract CL8YProtocolTreasury is FeeSink {
    constructor(address admin) FeeSink(admin) {}
}
