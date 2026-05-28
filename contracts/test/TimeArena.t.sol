// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";

contract TimeArenaTest is Test {
    Doubloon doub;
    PodiumVaults vaults;
    AdminSellVault adminVault;
    TimeArena arena;

    address alice = address(0xA11CE);
    address admin = address(this);

    function setUp() public {
        doub = new Doubloon(admin);
        vaults = new PodiumVaults(doub, admin);
        adminVault = new AdminSellVault(doub, admin);

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), 1000e18, 120, 86_400, 4 * 86_400, 300, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(alice, 1_000_000e18);
        vm.prank(alice);
        doub.approve(address(arena), type(uint256).max);
    }

    function test_buy_routes_doub_split() public {
        uint256 charm = 1e18;
        uint256 owed = 1000e18;

        vm.prank(alice);
        arena.buy(charm);

        // Default pools all point at PodiumVaults — combined active+seed = 70% of buy.
        assertEq(doub.balanceOf(address(vaults)), 700e18);
        assertEq(doub.balanceOf(address(adminVault)), 300e18);
        assertEq(doub.balanceOf(address(arena)), 0);
        assertEq(arena.totalDoubRaised(), owed);
    }

    function test_timer_hard_reset_increments_epoch() public {
        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
    }
}
