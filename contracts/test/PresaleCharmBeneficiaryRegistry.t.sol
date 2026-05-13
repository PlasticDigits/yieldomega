// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PresaleCharmBeneficiaryRegistry} from "../src/vesting/PresaleCharmBeneficiaryRegistry.sol";

contract PresaleCharmBeneficiaryRegistryTest is Test {
    address internal constant A = address(0xA11);
    address internal constant B = address(0xB22);

    function test_membership() public {
        address[] memory addrs = new address[](2);
        addrs[0] = A;
        addrs[1] = B;
        PresaleCharmBeneficiaryRegistry r = new PresaleCharmBeneficiaryRegistry(addrs);
        assertTrue(r.isBeneficiary(A));
        assertTrue(r.isBeneficiary(B));
        assertFalse(r.isBeneficiary(address(0xC33)));
    }

    function test_RevertWhen_empty() public {
        address[] memory addrs = new address[](0);
        vm.expectRevert(PresaleCharmBeneficiaryRegistry.PresaleCharmBeneficiaryRegistry__EmptySet.selector);
        new PresaleCharmBeneficiaryRegistry(addrs);
    }

    function test_RevertWhen_duplicate() public {
        address[] memory addrs = new address[](2);
        addrs[0] = A;
        addrs[1] = A;
        vm.expectRevert(abi.encodeWithSelector(PresaleCharmBeneficiaryRegistry.PresaleCharmBeneficiaryRegistry__Duplicate.selector, A));
        new PresaleCharmBeneficiaryRegistry(addrs);
    }
}
