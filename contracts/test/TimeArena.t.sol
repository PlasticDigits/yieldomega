// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
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

    /// INV-TIME-ARENA-CRED-PRO-RATA-SPLIT: two DOUB buyers at 1:2 CHARM split 70 CRED pool (#248).
    function test_cred_pro_rata_exact_1_2_split() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(2e18);
        assertGt(arena.lastBuyEpoch(), 0);

        uint256 ep = 0;
        assertEq(arena.epochCharmTotal(ep), 3e18);
        assertEq(arena.epochCredPool(ep), 70e18);

        uint256 aliceShare = Math.mulDiv(70e18, 1e18, 3e18);
        uint256 bobShare = Math.mulDiv(70e18, 2e18, 3e18);

        vm.prank(alice);
        arena.claimCred(ep);
        vm.prank(bob);
        arena.claimCred(ep);

        assertEq(cred.balanceOf(alice), 1000e18 + aliceShare);
        assertEq(cred.balanceOf(bob), 1000e18 + bobShare);
        assertLe(aliceShare + bobShare, 70e18);
        assertGe(aliceShare + bobShare, 70e18 - 2);
    }

    /// INV-TIME-ARENA-CRED-NO-DOUBLE-CLAIM: second `claimCred` reverts after epoch CHARM zeroed (#248).
    function test_claimCred_cannot_double_claim() public {
        vm.prank(alice);
        arena.buy(1e18);
        _endLastBuyEpoch();

        vm.prank(alice);
        arena.claimCred(0);
        vm.prank(alice);
        vm.expectRevert("TimeArena: nothing to claim");
        arena.claimCred(0);
    }

    function test_buyWithCred_reverts_charm_bounds() public {
        vm.startPrank(alice);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buyWithCred(98e16);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buyWithCred(11e18);
        vm.stopPrank();
    }

    /// INV-TIME-ARENA-CRED-BURN-BUY: `buyWithCred` burns 100 CRED per 1e18 CHARM (#268).
    function test_buy_with_cred() public {
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(cred.balanceOf(alice), 1000e18 - 100e18);
    }

    function test_buyWithCred_10charm_burns_1000_cred() public {
        cred.mint(alice, 2000e18);
        vm.prank(alice);
        arena.buyWithCred(10e18);
        assertEq(cred.balanceOf(alice), 3000e18 - 1000e18);
    }

    function test_buyWithCred_min_charm_burns_scaled() public {
        cred.mint(alice, 2000e18);
        vm.prank(alice);
        arena.buyWithCred(99e16);
        assertEq(cred.balanceOf(alice), 3000e18 - 99e18);
    }

    function test_buyWithCred_reverts_insufficient_cred() public {
        vm.prank(bob);
        cred.burn(bob, cred.balanceOf(bob) - 50e18);
        vm.prank(bob);
        vm.expectRevert();
        arena.buyWithCred(1e18);
    }

    /// INV-TIME-ARENA-FIRST-BUY-CRED-BONUS: first DOUB buy schedules 150 CRED for next epoch (#268).
    function test_first_buy_doub_schedules_bonus() public {
        uint256 target = arena.lastBuyEpoch() + 1;
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.epochFixedCredBonus(target, alice), 150e18);
        assertEq(arena.pendingCred(alice, target), 150e18);
        assertEq(arena.buyCount(alice), 1);
    }

    function test_first_buy_cred_schedules_bonus_once() public {
        uint256 target = arena.lastBuyEpoch() + 1;
        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.epochFixedCredBonus(target, bob), 150e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.epochFixedCredBonus(target, bob), 150e18);
    }

    function test_second_buy_no_additional_bonus() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 target = arena.lastBuyEpoch() + 1;
        assertEq(arena.epochFixedCredBonus(target, alice), 150e18);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.epochFixedCredBonus(target, alice), 150e18);
    }

    function test_claim_cred_bonus_only_no_charm() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 bonusEpoch = 1;

        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);

        _warpNearHardReset();
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(1e18);

        assertEq(arena.epochCharmWad(bonusEpoch, alice), 0);
        assertGt(arena.lastBuyEpoch(), bonusEpoch);
        assertEq(arena.pendingCred(alice, bonusEpoch), 150e18);

        vm.prank(alice);
        arena.claimCred(bonusEpoch);
        assertEq(cred.balanceOf(alice), 1000e18 + 150e18);
        assertEq(arena.pendingCred(alice, bonusEpoch), 0);
    }

    function test_claim_cred_pro_rata_plus_bonus() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 bonusEpoch = 1;
        assertEq(arena.epochFixedCredBonus(bonusEpoch, alice), 150e18);

        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);

        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(1e18);

        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);

        assertGt(arena.lastBuyEpoch(), bonusEpoch);
        uint256 expected = 35e18 + 150e18;

        vm.prank(alice);
        arena.claimCred(bonusEpoch);
        assertEq(cred.balanceOf(alice), 1000e18 + expected);
        assertEq(arena.pendingCred(alice, bonusEpoch), 0);
    }

    function test_claimCred_reverts_active_epoch() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 future = arena.lastBuyEpoch() + 1;
        vm.prank(alice);
        vm.expectRevert("TimeArena: epoch active");
        arena.claimCred(future);
    }

    function test_first_buy_hard_reset_targets_post_epoch() public {
        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
        assertEq(arena.epochFixedCredBonus(2, alice), 150e18);
    }

    function test_first_buy_flag_survives_epoch_roll() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 target = arena.lastBuyEpoch() + 1;
        assertEq(arena.epochFixedCredBonus(target, alice), 150e18);

        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);
        assertEq(arena.epochFixedCredBonus(target, alice), 150e18);
        assertEq(arena.buyCount(alice), 1);
    }

    function _warpNearHardReset() internal {
        uint256 dl = arena.deadline();
        uint256 remaining = dl > block.timestamp ? dl - block.timestamp : 0;
        if (remaining > 600) {
            vm.warp(block.timestamp + remaining - 600);
        }
    }

    function _endLastBuyEpoch() internal {
        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);
        assertGt(arena.lastBuyEpoch(), 0);
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

    /// GitLab #250: `_finishBuy` emits `XpGained(buyer, amount, newLevel)`.
    function test_xp_emits_XpGained() public {
        vm.expectEmit(true, false, false, true);
        emit TimeArena.XpGained(alice, 10, 1);
        vm.prank(alice);
        arena.buy(10e18);
        assertEq(arena.xp(alice), 10);
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

    /// GitLab #261: 700 DOUB top-up prize slice equals DOUB prize portion of a 1000 DOUB buy.
    function test_topUpPodiumPools_equivalent_to_buy_prize_vaults() public {
        TimeArena buyArena = _newArena();
        vm.prank(alice);
        buyArena.buy(1e18);

        TimeArena topUpArena = _newArena();
        vm.prank(alice);
        topUpArena.topUpPodiumPools(700e18);

        assertEq(doub.balanceOf(address(_vaultsFor(buyArena))), doub.balanceOf(address(_vaultsFor(topUpArena))));
        assertEq(doub.balanceOf(address(_adminFor(buyArena))), 300e18);
        assertEq(doub.balanceOf(address(_adminFor(topUpArena))), 0);
    }

    function test_topUpPodiumPools_1000_admin_vault_unchanged() public {
        uint256 adminBefore = doub.balanceOf(address(adminVault));
        vm.prank(alice);
        arena.topUpPodiumPools(1000e18);
        assertEq(doub.balanceOf(address(adminVault)), adminBefore);
        assertEq(doub.balanceOf(address(vaults)), 1000e18);
    }

    function test_topUpPodiumPools_emits_topped_up() public {
        vm.expectEmit(true, false, false, true);
        emit TimeArena.PodiumPoolsToppedUp(alice, 700e18);
        vm.prank(alice);
        arena.topUpPodiumPools(700e18);
    }

    function test_topUpPodiumPools_reverts_without_allowance() public {
        vm.prank(bob);
        doub.approve(address(arena), 0);
        vm.prank(bob);
        vm.expectRevert();
        arena.topUpPodiumPools(1e18);
    }

    function _newArena() internal returns (TimeArena a) {
        PodiumVaults v = new PodiumVaults(doub, admin);
        AdminSellVault av = new AdminSellVault(doub, admin);
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, v, av, address(0), address(cred), 1000e18, 120, 86_400, 4 * 86_400, 300, admin)
        );
        a = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(a));
        av.setArena(address(a));
        a.startArena();
        vm.prank(alice);
        doub.approve(address(a), type(uint256).max);
    }

    function _vaultsFor(TimeArena a) internal view returns (PodiumVaults) {
        return PodiumVaults(a.podiumVaults());
    }

    function _adminFor(TimeArena a) internal view returns (AdminSellVault) {
        return AdminSellVault(a.adminSellVault());
    }
}
