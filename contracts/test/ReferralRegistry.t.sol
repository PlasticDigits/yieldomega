// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {ITimeArenaReferralBurn} from "../src/interfaces/ITimeArenaReferralBurn.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

/// @dev Minimal `TimeArena` stand-in for referral burn reads.
contract MockArenaReferralBurn is ITimeArenaReferralBurn {
    IERC20 public doub;
    uint256 public epochCharmAnchorWad;
    uint256 public charmPriceWad;

    constructor(IERC20 _doub, uint256 anchorWad) {
        doub = _doub;
        epochCharmAnchorWad = anchorWad;
        charmPriceWad = anchorWad;
    }

    function setAnchor(uint256 anchorWad) external {
        epochCharmAnchorWad = anchorWad;
        charmPriceWad = anchorWad;
    }
}

contract ReferralRegistryTest is Test {
    Doubloon internal doub;
    MockArenaReferralBurn internal arena;
    ReferralRegistry internal reg;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 internal constant ANCHOR_WAD = 1000e18;

    function setUp() public {
        doub = new Doubloon(address(this));
        doub.grantRole(doub.MINTER_ROLE(), address(this));
        arena = new MockArenaReferralBurn(IERC20(address(doub)), ANCHOR_WAD);
        reg = UUPSDeployLib.deployReferralRegistry(address(this));
        reg.setTimeArena(address(arena));
        doub.mint(alice, 100_000e18);
        doub.mint(bob, 100_000e18);
    }

    function test_registrationBurnAmount_matches_epoch_anchor() public view {
        assertEq(reg.registrationBurnAmount(), ANCHOR_WAD);
        assertEq(reg.doubToken(), address(doub));
        assertEq(reg.cl8yToken(), address(doub));
    }

    function test_registerCode_burns_doub_and_sets_owner() public {
        bytes32 h = reg.hashCode("alice");
        vm.startPrank(alice);
        doub.approve(address(reg), type(uint256).max);
        reg.registerCode("alice");
        vm.stopPrank();
        assertEq(reg.ownerOfCode(h), alice);
        assertEq(reg.ownerCode(alice), h);
        assertEq(doub.balanceOf(reg.BURN_ADDRESS()), ANCHOR_WAD);
    }

    function test_registerCode_burn_tracks_epoch_anchor_roll() public {
        arena.setAnchor(1500e18);
        assertEq(reg.registrationBurnAmount(), 1500e18);

        vm.startPrank(alice);
        doub.approve(address(reg), type(uint256).max);
        reg.registerCode("alice");
        vm.stopPrank();
        assertEq(doub.balanceOf(reg.BURN_ADDRESS()), 1500e18);
    }

    function test_registerCode_case_insensitive_hash() public {
        bytes32 hLower = reg.hashCode("abc");
        bytes32 hMixed = reg.hashCode("AbC");
        assertEq(hLower, hMixed);
    }

    function test_registerCode_duplicate_reverts() public {
        vm.startPrank(alice);
        doub.approve(address(reg), type(uint256).max);
        reg.registerCode("one");
        vm.stopPrank();

        vm.startPrank(bob);
        doub.approve(address(reg), type(uint256).max);
        vm.expectRevert("ReferralRegistry: code taken");
        reg.registerCode("one");
        vm.stopPrank();
    }

    function test_registerCode_twice_same_user_reverts() public {
        vm.startPrank(alice);
        doub.approve(address(reg), type(uint256).max);
        reg.registerCode("first");
        vm.expectRevert("ReferralRegistry: already registered");
        reg.registerCode("second");
        vm.stopPrank();
    }

    function test_setTimeArena_only_once() public {
        vm.expectRevert("ReferralRegistry: arena set");
        reg.setTimeArena(address(arena));
    }

    function test_ownable2step_transfer_requires_accept() public {
        address newOwner = makeAddr("newOwner");
        reg.transferOwnership(newOwner);
        assertEq(reg.owner(), address(this));
        assertEq(reg.pendingOwner(), newOwner);

        vm.prank(newOwner);
        reg.acceptOwnership();
        assertEq(reg.owner(), newOwner);
        assertEq(reg.pendingOwner(), address(0));
    }

    function test_ownable2step_pending_owner_cannot_upgrade() public {
        address pending = makeAddr("pending");
        reg.transferOwnership(pending);
        ReferralRegistry impl2 = new ReferralRegistry();
        vm.prank(pending);
        vm.expectRevert();
        reg.upgradeToAndCall(address(impl2), "");
    }

    function test_uups_upgrade_blocked_for_non_owner() public {
        ReferralRegistry impl2 = new ReferralRegistry();
        vm.prank(alice);
        vm.expectRevert();
        reg.upgradeToAndCall(address(impl2), "");
    }
}
