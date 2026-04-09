// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Pluggable per-CHARM pricing for TimeCurve (linear, future curves).
/// @dev Returns accepted-asset wei per 1e18 CHARM for `elapsed` seconds since sale start.
///      Canonical DOUB module (`LinearCharmPrice`): **1.0** + **0.1×elapsed/1 day** in 18-decimal asset WAD (linear in **time**, decoupled from the CHARM envelope).
interface ICharmPrice {
    function priceWad(uint256 elapsedSinceSaleStart) external view returns (uint256);
}
