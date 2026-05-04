// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";

/// @dev Mint vs burn authority separation ([GitLab #132](https://gitlab.com/PlasticDigits/yieldomega/-/issues/132)).
contract DoubloonTest is Test {
    Doubloon internal token;

    address internal admin = address(this);
    address internal minter = makeAddr("minter");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        token = new Doubloon(admin);
        token.grantRole(token.MINTER_ROLE(), minter);
    }

    function test_mint_onlyMinter() public {
        vm.prank(minter);
        token.mint(alice, 100e18);
        assertEq(token.balanceOf(alice), 100e18);
    }

    function test_mint_nonMinter_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(bob, 1);
    }

    function test_burn_self_withoutRole() public {
        vm.prank(minter);
        token.mint(alice, 100e18);

        vm.prank(alice);
        token.burn(40e18);
        assertEq(token.balanceOf(alice), 60e18);
    }

    function test_burnFrom_withAllowance() public {
        vm.prank(minter);
        token.mint(alice, 100e18);

        vm.prank(alice);
        token.approve(bob, 30e18);

        vm.prank(bob);
        token.burnFrom(alice, 30e18);
        assertEq(token.balanceOf(alice), 70e18);
    }

    function test_burnFrom_withoutAllowance_reverts() public {
        vm.prank(minter);
        token.mint(alice, 100e18);

        vm.prank(bob);
        vm.expectRevert();
        token.burnFrom(alice, 1);
    }

    /// @dev Former footgun: minter could wipe arbitrary balances; minter must not bypass allowance.
    function test_minter_cannotBurnFromHolderWithoutAllowance() public {
        vm.prank(minter);
        token.mint(alice, 100e18);

        vm.prank(minter);
        vm.expectRevert();
        token.burnFrom(alice, 1);
    }
}
