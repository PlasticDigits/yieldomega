// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {DoubAirdrop} from "../src/DoubAirdrop.sol";

contract DoubAirdropTest is Test {
    Doubloon internal doub;
    DoubAirdrop internal airdrop;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        doub = new Doubloon(address(this));
        doub.grantRole(doub.MINTER_ROLE(), address(this));
        airdrop = new DoubAirdrop();
        doub.mint(address(this), 1_000e18);
    }

    function test_disperseToken_distributes() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory values = new uint256[](2);
        values[0] = 100e18;
        values[1] = 250e18;

        doub.approve(address(airdrop), 350e18);

        vm.expectEmit(true, true, false, true);
        emit DoubAirdrop.AirdropDispersed(address(doub), address(this), 2, 350e18);

        airdrop.disperseToken(doub, recipients, values);

        assertEq(doub.balanceOf(alice), 100e18);
        assertEq(doub.balanceOf(bob), 250e18);
        assertEq(doub.balanceOf(address(airdrop)), 0);
        assertEq(doub.balanceOf(address(this)), 650e18);
    }

    function test_disperseToken_lengthMismatch_reverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory values = new uint256[](2);

        vm.expectRevert(DoubAirdrop.LengthMismatch.selector);
        airdrop.disperseToken(doub, recipients, values);
    }

    function test_disperseToken_empty_reverts() public {
        address[] memory recipients = new address[](0);
        uint256[] memory values = new uint256[](0);

        vm.expectRevert(DoubAirdrop.EmptyBatch.selector);
        airdrop.disperseToken(doub, recipients, values);
    }

    function test_disperseToken_zeroRecipient_reverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = address(0);
        uint256[] memory values = new uint256[](1);
        values[0] = 1e18;

        vm.expectRevert(DoubAirdrop.ZeroRecipient.selector);
        airdrop.disperseToken(doub, recipients, values);
    }

    function test_disperseToken_zeroAmount_reverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        vm.expectRevert(DoubAirdrop.ZeroAmount.selector);
        airdrop.disperseToken(doub, recipients, values);
    }

    function test_disperseToken_insufficientAllowance_reverts() public {
        address[] memory recipients = new address[](1);
        recipients[0] = carol;
        uint256[] memory values = new uint256[](1);
        values[0] = 1e18;

        vm.expectRevert();
        airdrop.disperseToken(doub, recipients, values);
    }
}
