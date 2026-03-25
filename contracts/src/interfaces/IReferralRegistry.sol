// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Resolves referral code hashes to owner addresses for TimeCurve.
interface IReferralRegistry {
    /// @return owner The address that registered `codeHash`, or `address(0)` if none.
    function ownerOfCode(bytes32 codeHash) external view returns (address owner);
}
