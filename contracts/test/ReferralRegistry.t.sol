// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {MockCL8Y} from "../src/tokens/MockCL8Y.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract ReferralRegistryTest is Test {
    MockCL8Y internal cl8y;
    ReferralRegistry internal reg;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        cl8y = new MockCL8Y();
        reg = UUPSDeployLib.deployReferralRegistry(IERC20(address(cl8y)), 1e18, address(this));
        cl8y.mint(alice, 100e18);
        cl8y.mint(bob, 100e18);
    }

    function test_registerCode_burns_and_sets_owner() public {
        bytes32 h = reg.hashCode("alice");
        vm.startPrank(alice);
        cl8y.approve(address(reg), type(uint256).max);
        reg.registerCode("alice");
        vm.stopPrank();
        assertEq(reg.ownerOfCode(h), alice);
        assertEq(reg.ownerCode(alice), h);
        assertEq(cl8y.balanceOf(reg.BURN_ADDRESS()), 1e18);
    }

    function test_registerCode_case_insensitive_hash() public {
        bytes32 hLower = reg.hashCode("abc");
        bytes32 hMixed = reg.hashCode("AbC");
        assertEq(hLower, hMixed);
    }

    function test_registerCode_duplicate_reverts() public {
        vm.startPrank(alice);
        cl8y.approve(address(reg), type(uint256).max);
        reg.registerCode("one");
        vm.stopPrank();

        vm.startPrank(bob);
        cl8y.approve(address(reg), type(uint256).max);
        vm.expectRevert("ReferralRegistry: code taken");
        reg.registerCode("one");
        vm.stopPrank();
    }

    function test_registerCode_twice_same_user_reverts() public {
        vm.startPrank(alice);
        cl8y.approve(address(reg), type(uint256).max);
        reg.registerCode("first");
        vm.expectRevert("ReferralRegistry: already registered");
        reg.registerCode("second");
        vm.stopPrank();
    }
}
