// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FeeSink} from "./FeeSink.sol";

/// @notice Receives 30 % of TimeCurve **reserve** fees for **locked DOUB liquidity** on **SIR / Kumbaya**
///         (not generic farm incentives). Pairing and ticks follow launch policy (1.2× clearing anchor;
///         Kumbaya 0.8×–∞ band) — see `docs/onchain/fee-routing-and-governance.md` and `launchplan-timecurve.md`.
contract DoubLPIncentives is FeeSink {
    constructor(address admin) FeeSink(admin) {}
}
