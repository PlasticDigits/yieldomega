// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IDoubPresaleBeneficiary} from "../interfaces/IDoubPresaleBeneficiary.sol";

/// @title PresaleCharmBeneficiaryRegistry — immutable set for TimeCurve +15% CHARM weight
/// @notice Implements **`IDoubPresaleBeneficiary`** so **`TimeCurve.setDoubPresaleVesting`** can point here when
///         there is no **`DoubPresaleVesting`** deployment. **No** DOUB claims or vesting schedule — membership only.
contract PresaleCharmBeneficiaryRegistry is IDoubPresaleBeneficiary {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _beneficiaries;

    /// @param accounts Unique non-zero wallets that receive the presale CHARM weight bonus on buys.
    constructor(address[] memory accounts) {
        uint256 n = accounts.length;
        if (n == 0) revert PresaleCharmBeneficiaryRegistry__EmptySet();

        for (uint256 i; i < n; ++i) {
            address a = accounts[i];
            if (a == address(0)) revert PresaleCharmBeneficiaryRegistry__ZeroAccount();
            if (!_beneficiaries.add(a)) revert PresaleCharmBeneficiaryRegistry__Duplicate(a);
        }
    }

    /// @inheritdoc IDoubPresaleBeneficiary
    function isBeneficiary(address account) external view returns (bool) {
        return _beneficiaries.contains(account);
    }

    error PresaleCharmBeneficiaryRegistry__EmptySet();
    error PresaleCharmBeneficiaryRegistry__ZeroAccount();
    error PresaleCharmBeneficiaryRegistry__Duplicate(address account);
}
