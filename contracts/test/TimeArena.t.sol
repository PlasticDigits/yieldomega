// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {ArenaXp} from "../src/arena/libraries/ArenaXp.sol";

contract TimeArenaTest is Test {
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    AdminSellVault adminVault;
    TimeArena arena;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address admin = address(this);

    function setUp() public {
        doub = new Doubloon(admin);
        cred = new PlayCred(admin);
        vaults = new PodiumVaults(doub, admin);
        adminVault = new AdminSellVault(doub, admin);

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), address(cred), 1000e18, 120, 86_400, 4 * 86_400, 300, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(alice, 1_000_000e18);
        doub.mint(bob, 1_000_000e18);
        vm.prank(alice);
        doub.approve(address(arena), type(uint256).max);
        vm.prank(bob);
        doub.approve(address(arena), type(uint256).max);
        cred.grantRole(cred.MINTER_ROLE(), admin);
        cred.mint(alice, 1000e18);
        cred.mint(bob, 1000e18);
    }

    function test_buy_routes_doub_split() public {
        uint256 charm = 1e18;
        uint256 owed = 1000e18;

        vm.prank(alice);
        arena.buy(charm);

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

    function test_timer_extension_without_hard_reset() public {
        uint256 dl0 = arena.deadline();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.deadline(), dl0 + 120);
        assertEq(arena.lastBuyEpoch(), 0);
    }

    /// INV-TIME-ARENA-TIMER-MULTI: one buy extends all four podium deadlines together.
    function test_multi_podium_deadline_extend() public {
        uint256[] memory before = new uint256[](4);
        for (uint8 c = 0; c < 4; c++) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(alice);
        arena.buy(1e18);
        for (uint8 c = 0; c < 4; c++) {
            assertEq(arena.podiumDeadline(c), before[c] + 120, "category mismatch");
        }
    }

    /// INV-TIME-ARENA-CRED-ACCRUE: DOUB buy adds 35 CRED (18 dec) to the active epoch pool.
    function test_cred_accrue_on_doub_buy() public {
        uint256 ep = arena.lastBuyEpoch();
        uint256 poolBefore = arena.epochCredPool(ep);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.epochCredPool(ep), poolBefore + 35e18);
    }

    function test_cred_pro_rata_claim() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.prank(bob);
        arena.buy(2e18);

        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);

        uint256 ep = 0;
        assertEq(arena.epochCharmTotal(ep), 4e18);

        vm.prank(alice);
        arena.claimCred(ep);
        assertEq(arena.epochCharmWad(ep, alice), 0);
        assertGt(cred.balanceOf(alice), 0);
    }

    function test_buy_with_cred() public {
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(cred.balanceOf(alice), 1000e18 - 70e18);
    }

    function test_xp_levels() public {
        assertEq(ArenaXp.xpForCharm(99e16), 1);
        assertEq(ArenaXp.xpForCharm(10e18), 10);
        assertEq(ArenaXp.levelFromXp(20), 2);
        assertEq(ArenaXp.xpToAdvance(10), 65);
        assertEq(ArenaXp.xpToAdvance(20), 100);
    }

    function _warpPastBuyCooldown() internal {
        vm.warp(block.timestamp + arena.buyCooldownSec() + 1);
    }

    /// INV-TIME-ARENA-XP-GAS: incremental onchain state matches lifetime reference after buys.
    function test_xp_incremental_matches_reference_many_buys() public {
        uint256 charm = 10e18;
        for (uint256 i = 0; i < 40; ++i) {
            _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(charm);
            assertEq(arena.level(alice), ArenaXp.levelFromXp(arena.xp(alice)));
            assertEq(arena.xpToNextLevel(alice), ArenaXp.xpRemainingToNextLevel(arena.level(alice), arena.xpTowardNext(alice)));
        }
    }

    function test_xp_max_charm_first_buy() public {
        vm.prank(alice);
        arena.buy(10e18);
        assertEq(arena.level(alice), 1);
        assertEq(arena.xpTowardNext(alice), 10);
        assertEq(arena.xpToNextLevel(alice), 10);
    }

    function test_xp_buy_with_cred_same_as_doub() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 lvlDoub = arena.level(alice);
        uint256 towardDoub = arena.xpTowardNext(alice);

        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.level(bob), lvlDoub);
        assertEq(arena.xpTowardNext(bob), towardDoub);
    }

    /// INV-TIME-ARENA-XP-GAS: timer hard-reset does not clear progression.
    function test_xp_survives_timer_hard_reset() public {
        vm.prank(alice);
        arena.buy(10e18);
        uint256 lvlBefore = arena.level(alice);
        uint256 towardBefore = arena.xpTowardNext(alice);
        uint256 xpBefore = arena.xp(alice);

        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
        assertEq(arena.level(alice), lvlBefore);
        assertGe(arena.xpTowardNext(alice), towardBefore);
        assertGt(arena.xp(alice), xpBefore);
    }

    function test_xp_high_level_buy_gas_bounded_no_level_up() public {
        uint256 charm = 99e16;
        for (uint256 i = 0; i < 500; ++i) {
            _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(charm);
        }
        assertGt(arena.level(alice), 10);

        _warpPastBuyCooldown();
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        arena.buy(charm);
        uint256 gasWhale = gasBefore - gasleft();

        _warpPastBuyCooldown();
        gasBefore = gasleft();
        vm.prank(bob);
        arena.buy(charm);
        uint256 gasFresh = gasBefore - gasleft();
        assertLt(gasWhale, gasFresh + 80_000, "high-level non-level-up buy should not scale vs fresh wallet");
    }

    function test_roll_podium_after_expiry() public {
        vm.warp(arena.podiumDeadline(1) + 1);
        vm.prank(alice);
        arena.rollPodiumEpoch(1);
        assertEq(arena.podiumEpoch(1), 1);
    }

    function test_warbow_steal_pulls_doub() public {
        vm.startPrank(bob);
        arena.buy(10e18);
        vm.warp(block.timestamp + 301);
        arena.buy(10e18);
        vm.stopPrank();
        vm.prank(alice);
        arena.buy(1e18);
        uint256 balBefore = doub.balanceOf(address(arena));
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        assertEq(doub.balanceOf(address(arena)) - balBefore, 1000e18);
    }

    function test_topUpPodiumPools_700_matches_buy_prize_vaults() public {
        uint256 adminBefore = doub.balanceOf(address(adminVault));
        vm.prank(alice);
        arena.topUpPodiumPools(700e18);
        assertEq(doub.balanceOf(address(vaults)), 700e18);
        assertEq(doub.balanceOf(address(adminVault)), adminBefore);
        assertEq(doub.balanceOf(address(arena)), 0);
        assertEq(arena.totalDoubRaised(), 0);
    }

    function test_topUpPodiumPools_reverts_without_allowance() public {
        vm.prank(bob);
        doub.approve(address(arena), 0);
        vm.prank(bob);
        vm.expectRevert();
        arena.topUpPodiumPools(1e18);
    }
}
