// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FeeSink} from "./FeeSink.sol";

/// @notice Receives 30 % of TimeCurve fees earmarked for DOUB liquidity.
///         TODO: finalize AMM/pool targets, claim mechanics, and
///         vault-to-pool routing per docs/onchain/fee-routing-and-governance.md.
contract DoubLPIncentives is FeeSink {
    constructor(address admin) FeeSink(admin) {}
}
