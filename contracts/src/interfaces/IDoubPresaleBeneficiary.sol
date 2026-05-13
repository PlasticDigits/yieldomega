// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @title IDoubPresaleBeneficiary
/// @notice Minimal view surface implemented by `DoubPresaleVesting` for `TimeCurve` presale CHARM-weight bonuses.
interface IDoubPresaleBeneficiary {
    /// @return True when `account` receives the on-sale CHARM weight bonus (canonical: `DoubPresaleVesting` beneficiary set, or `PresaleCharmBeneficiaryRegistry` when vesting is not deployed).
    function isBeneficiary(address account) external view returns (bool);
}
