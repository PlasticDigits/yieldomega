// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PlayCred} from "../src/PlayCred.sol";

/// @dev Play CRED ledger invariants (GitLab #248).
contract PlayCredTest is Test {
    PlayCred cred;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address minter = address(0x1117);

    function setUp() public {
        cred = new PlayCred(address(this));
        cred.grantRole(cred.MINTER_ROLE(), minter);
    }

    /// INV-PLAY-CRED-NON-TRANSFER: mint/burn only; wallet-to-wallet transfer reverts.
    function test_non_transferable() public {
        vm.prank(minter);
        cred.mint(alice, 100e18);

        vm.prank(alice);
        vm.expectRevert("PlayCred: non-transferable");
        cred.transfer(bob, 1e18);

        vm.prank(alice);
        cred.approve(bob, 1e18);
        vm.prank(bob);
        vm.expectRevert("PlayCred: non-transferable");
        cred.transferFrom(alice, bob, 1e18);
    }

    function test_minter_role_required() public {
        vm.prank(alice);
        vm.expectRevert();
        cred.mint(bob, 1e18);
    }
}
