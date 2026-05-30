// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {ArenaXp} from "../src/arena/libraries/ArenaXp.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {MockERC20FeeOnTransfer} from "./mocks/MockERC20FeeOnTransfer.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {MockCL8Y} from "../src/tokens/MockCL8Y.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TimeArenaTest is Test {
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    AdminSellVault adminVault;
    TimeArena arena;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address admin = address(this);

    uint256 internal constant WAD = 1e18;
    uint256 internal constant CHARM_MIN = 99e16;
    uint256 internal constant CHARM_MAX = 10e18;

    uint256[4] internal _ext;
    uint256[4] internal _init;
    uint256[4] internal _cap;
    uint256[4] internal _below;
    uint256[4] internal _to;

    function setUp() public {
        (_ext, _init, _cap, _below, _to) = ArenaPodiumTimerConfig.getProductionDefaults();

        doub = new Doubloon(admin);
        cred = new PlayCred(admin);
        vaults = new PodiumVaults(doub, admin);
        adminVault = new AdminSellVault(doub, admin);

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, admin)
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

        vm.recordLogs();
        vm.prank(alice);
        arena.buy(charm);

        assertEq(doub.balanceOf(address(vaults)), 700e18);
        assertEq(doub.balanceOf(address(adminVault)), 300e18);
        assertEq(doub.balanceOf(address(arena)), 0);
        assertEq(arena.totalDoubRaised(), owed);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        uint256 podiumEvents;
        uint256 seedEvents;
        bool sawAdminFunded;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].topics[0] == keccak256("PodiumFunded(uint8,uint256,address)")) {
                podiumEvents++;
                assertEq(abi.decode(entries[i].data, (uint256)), 100e18);
            } else if (entries[i].topics[0] == keccak256("SeedFunded(uint8,uint256,address)")) {
                seedEvents++;
                assertEq(abi.decode(entries[i].data, (uint256)), 75e18);
            } else if (entries[i].topics[0] == keccak256("AdminVaultFunded(uint256)")) {
                assertEq(abi.decode(entries[i].data, (uint256)), 300e18);
                sawAdminFunded = true;
            }
        }
        assertEq(podiumEvents, 4);
        assertEq(seedEvents, 4);
        assertTrue(sawAdminFunded);
    }

    function test_timer_hard_reset_increments_epoch() public {
        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
    }

    /// INV-TIME-ARENA-EPOCH-EVENT (#246): hard reset emits `LastBuyEpochStarted`.
    function test_emits_LastBuyEpochStarted_on_hard_reset() public {
        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.expectEmit(true, false, false, true);
        emit TimeArena.LastBuyEpochStarted(1, block.timestamp + 900);
        vm.prank(alice);
        arena.buy(1e18);
    }

    /// INV-TIME-ARENA-CHARM-BAND (#246): fixed min/max CHARM envelope.
    function test_buy_reverts_charm_below_min() public {
        vm.prank(alice);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buy(CHARM_MIN - 1);
    }

    function test_buy_reverts_charm_above_max() public {
        vm.prank(alice);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buy(CHARM_MAX + 1);
    }

    /// INV-TIME-ARENA-COOLDOWN (#246): per-wallet rolling cooldown.
    function test_buy_reverts_on_cooldown() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.prank(alice);
        vm.expectRevert("TimeArena: buy cooldown");
        arena.buy(1e18);
    }

    /// INV-TIME-ARENA-DOUB-PRICE (#246): governance `setCharmPriceWad` changes DOUB owed.
    function test_setCharmPriceWad_changes_doub_owed() public {
        arena.setCharmPriceWad(2000e18);
        uint256 balBefore = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(doub.balanceOf(alice), balBefore - 2000e18);
    }

    /// INV-ERC20-123 (#246): fee-on-transfer DOUB reverts on ingress parity mismatch.
    function test_feeOnTransfer_buy_reverts_erc20Parity() public {
        MockERC20FeeOnTransfer feeDoub = new MockERC20FeeOnTransfer(100);
        PodiumVaults v = new PodiumVaults(feeDoub, admin);
        AdminSellVault av = new AdminSellVault(feeDoub, admin);
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (feeDoub, v, av, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, admin)
        );
        TimeArena feeArena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(feeArena));
        av.setArena(address(feeArena));
        feeArena.startArena();
        feeDoub.mint(alice, 1_000_000e18);
        vm.prank(alice);
        feeDoub.approve(address(feeArena), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        feeArena.buy(1e18);
    }

    /// GitLab #246 fuzz: in-band CHARM → DOUB pull matches `charmWad × charmPriceWad / 1e18`.
    function testFuzz_buy_charmInBand_doubPullParity(uint96 rawCharm) public {
        uint256 charmWad = bound(uint256(rawCharm), CHARM_MIN, CHARM_MAX);
        uint256 expected = Math.mulDiv(charmWad, arena.charmPriceWad(), WAD);
        uint256 aliceBefore = doub.balanceOf(alice);
        uint256 raisedBefore = arena.totalDoubRaised();
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(charmWad);
        assertEq(doub.balanceOf(alice), aliceBefore - expected, "buyer balance delta");
        assertEq(arena.totalDoubRaised(), raisedBefore + expected, "totalDoubRaised");
        assertEq(doub.balanceOf(address(arena)), 0, "arena retains no DOUB");
    }

    function testFuzz_buy_charmBelowMin_reverts(uint96 raw) public {
        uint256 charmWad = bound(uint256(raw), 1, CHARM_MIN - 1);
        _warpPastBuyCooldown();
        vm.prank(alice);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buy(charmWad);
    }

    function testFuzz_buy_charmAboveMax_reverts(uint96 raw) public {
        uint256 charmWad = bound(uint256(raw), CHARM_MAX + 1, type(uint96).max);
        _warpPastBuyCooldown();
        vm.prank(alice);
        vm.expectRevert("TimeArena: charm bounds");
        arena.buy(charmWad);
    }

    function testFuzz_setCharmPriceWad_doubOwed(uint96 rawCharm, uint128 rawPrice) public {
        uint256 charmWad = bound(uint256(rawCharm), CHARM_MIN, CHARM_MAX);
        uint256 price = bound(uint256(rawPrice), 1, 1e23);
        uint256 expected = Math.mulDiv(charmWad, price, WAD);
        vm.assume(expected <= doub.balanceOf(alice));
        arena.setCharmPriceWad(price);
        uint256 aliceBefore = doub.balanceOf(alice);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(charmWad);
        assertEq(doub.balanceOf(alice), aliceBefore - expected);
    }

    function test_timer_extension_without_hard_reset() public {
        uint256 dl0 = arena.deadline();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.deadline(), dl0 + 120);
        assertEq(arena.lastBuyEpoch(), 0);
    }

    /// INV-TIME-ARENA-TIMER-MULTI (#271): one buy extends each podium by its category extension.
    function test_multi_podium_deadline_extend() public {
        uint256[] memory before = new uint256[](4);
        uint256[4] memory expectedDelta = _ext;
        for (uint8 c = 0; c < 4; c++) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(alice);
        arena.buy(1e18);
        for (uint8 c = 0; c < 4; c++) {
            assertEq(arena.podiumDeadline(c), before[c] + expectedDelta[c], "category mismatch");
        }
    }

    /// GitLab #271: `startArena` seeds distinct initial deadlines per category.
    function test_start_arena_initial_deadlines_differ_by_category() public view {
        uint256 start = arena.arenaStart();
        assertEq(arena.podiumDeadline(0), start + _init[0]);
        assertEq(arena.podiumDeadline(1), start + _init[1]);
        assertEq(arena.podiumDeadline(2), start + _init[2]);
        assertEq(arena.podiumDeadline(3), start + _init[3]);
        assertTrue(arena.podiumDeadline(0) != arena.podiumDeadline(1));
        assertTrue(arena.podiumDeadline(1) != arena.podiumDeadline(2));
        assertTrue(arena.podiumDeadline(2) != arena.podiumDeadline(3));
    }

    /// GitLab #271: Time Booster hard-reset band snaps to 300s, not +60s extension.
    function test_time_booster_hard_reset_band_240_to_300() public {
        vm.warp(arena.podiumDeadline(1) - 200);
        uint256 before = arena.podiumDeadline(1);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(1), block.timestamp + _to[1]);
        assertGt(arena.podiumDeadline(1), before + _ext[1]);
    }

    /// GitLab #271: WarBow BP reset bonus follows Last Buy hard reset, not WarBow timer band.
    function test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(arena.podiumDeadline(0) + 1);
        arena.rollPodiumEpoch(arena.CAT_LAST_BUYERS());
        uint256 lastBuyDl = arena.podiumDeadline(0);
        vm.warp(lastBuyDl - 1000);
        assertGt(arena.podiumDeadline(0) - block.timestamp, _below[0]);
        vm.warp(arena.podiumDeadline(3) - 2000);
        assertLt(arena.podiumDeadline(3) - block.timestamp, _below[3]);

        uint256 bpBefore = arena.battlePoints(alice);
        vm.prank(alice);
        arena.buy(1e18);
        uint256 bpGain = arena.battlePoints(alice) - bpBefore;
        assertEq(bpGain, arena.WARBOW_BASE_BUY_BP(), "no WarBow reset bonus without Last Buy hard reset");
    }

    /// GitLab #271: Defended streak window uses Last Buy remaining, not other podium timers.
    function test_defended_streak_uses_last_buy_timer_not_other_podium() public {
        vm.warp(arena.podiumDeadline(1) - 100);
        assertLt(arena.podiumDeadline(1) - block.timestamp, _below[1]);
        assertGt(arena.podiumDeadline(0) - block.timestamp, arena.DEFENDED_STREAK_WINDOW_SEC());

        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.activeDefendedStreak(alice), 0);
        assertEq(arena.bestDefendedStreak(alice), 0);
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

    /// GitLab #247: one category roll resets only its timer; Streak/Booster/WarBow diverge from Last Buy.
    function test_podium_timers_diverge_after_single_roll() public {
        uint256 lastBuyDl = arena.podiumDeadline(0);
        assertEq(arena.podiumDeadline(1), arena.arenaStart() + _init[1]);
        assertTrue(lastBuyDl != arena.podiumDeadline(1));

        vm.warp(arena.podiumDeadline(1) + 1);
        uint256 ts = block.timestamp;
        arena.rollPodiumEpoch(arena.CAT_TIME_BOOSTER());

        assertEq(arena.podiumDeadline(1), ts + _init[1]);
        assertEq(arena.podiumDeadline(0), lastBuyDl);
        assertTrue(arena.podiumDeadline(0) != arena.podiumDeadline(1));
        assertTrue(arena.podiumDeadline(2) != arena.podiumDeadline(1));
        assertTrue(arena.podiumDeadline(3) != arena.podiumDeadline(1));
    }

    /// GitLab #247: `podiumEpoch[cat]` counters advance independently when categories roll on different schedules.
    function test_podium_epochs_independent_after_skewed_rolls() public {
        vm.warp(arena.podiumDeadline(1) + 1);
        arena.rollPodiumEpoch(arena.CAT_TIME_BOOSTER());
        assertEq(arena.podiumEpoch(1), 1);

        vm.warp(arena.podiumDeadline(3) + 1);
        arena.rollPodiumEpoch(arena.CAT_WARBOW());
        assertEq(arena.podiumEpoch(3), 1);

        assertEq(arena.podiumEpoch(0), 0);
        assertEq(arena.podiumEpoch(2), 0);
        assertTrue(arena.podiumEpoch(0) != arena.podiumEpoch(1));
        assertTrue(arena.podiumEpoch(2) != arena.podiumEpoch(3));
    }

    function test_roll_podium_reverts_while_timer_live() public {
        vm.expectRevert("TimeArena: timer live");
        arena.rollPodiumEpoch(2);
    }
    /// GitLab #247: settlement pays winners, clears live scores, bumps epoch (default test vault shares one DOUB holder per pool slot).
    function test_roll_podium_settlement_pays_and_clears_scores() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(2e18);

        uint8 cat = arena.CAT_TIME_BOOSTER();
        (address[3] memory winners,) = arena.podium(cat);
        assertTrue(winners[0] != address(0));

        uint256 winnerBefore = doub.balanceOf(winners[0]);
        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);

        assertGt(doub.balanceOf(winners[0]), winnerBefore);
        (address[3] memory cleared,) = arena.podium(cat);
        assertEq(cleared[0], address(0));
        assertEq(cleared[1], address(0));
        assertEq(cleared[2], address(0));
        assertEq(arena.podiumEpoch(cat), 1);
    }

    /// GitLab #247: Last Buy hard reset on buy bumps `lastBuyEpoch` (CHARM/CRED epoch), not on other podium rolls.
    function test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll() public {
        vm.warp(block.timestamp + arena.deadline() - 600);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);

        vm.warp(arena.podiumDeadline(2) + 1);
        arena.rollPodiumEpoch(arena.CAT_DEFENDED_STREAK());
        assertEq(arena.lastBuyEpoch(), 1);
        assertEq(arena.podiumEpoch(2), 1);
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
            (doub, v, av, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, admin)
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

    /// @dev Fresh arena + ReferralRegistry for GitLab #253 referral CRED tests.
    function _arenaWithReferrals()
        internal
        returns (TimeArena ar, ReferralRegistry reg, MockCL8Y reserve)
    {
        reserve = new MockCL8Y();
        reg = UUPSDeployLib.deployReferralRegistry(IERC20(address(reserve)), 1e18, admin);
        PodiumVaults v = new PodiumVaults(doub, admin);
        AdminSellVault av = new AdminSellVault(doub, admin);
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (
                doub,
                v,
                av,
                address(reg),
                address(cred),
                1000e18,
                _ext,
                _init,
                _cap,
                _below,
                _to,
                300,
                admin
            )
        );
        ar = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(ar));
        av.setArena(address(ar));
        cred.grantRole(cred.MINTER_ROLE(), address(ar));
        ar.startArena();
    }

    /// GitLab #253: referred buy mints Play CRED (5% + 5% of 35 CRED), not CHARM weight.
    function test_referred_buy_mints_cred_not_charm() public {
        (TimeArena ar, ReferralRegistry reg, MockCL8Y reserve) = _arenaWithReferrals();
        address referrer = makeAddr("referrer");
        address buyer = makeAddr("buyer");

        reserve.mint(referrer, 10e18);
        vm.startPrank(referrer);
        reserve.approve(address(reg), type(uint256).max);
        reg.registerCode("refcode");
        vm.stopPrank();

        bytes32 codeHash = reg.hashCode("refcode");
        doub.mint(buyer, 1_000_000e18);
        vm.startPrank(buyer);
        doub.approve(address(ar), type(uint256).max);

        uint256 expectedEach = Math.mulDiv(ar.CRED_PER_BUY(), ar.REFERRAL_CRED_BPS(), 10_000);
        uint256 referrerCredBefore = cred.balanceOf(referrer);
        uint256 buyerCredBefore = cred.balanceOf(buyer);
        uint256 totalCharmBefore = ar.totalCharmWeight();
        uint256 buyerCharmBefore = ar.charmWeight(buyer);
        uint256 referrerCharmBefore = ar.charmWeight(referrer);

        vm.recordLogs();
        ar.buy(1e18, codeHash);
        vm.stopPrank();

        assertEq(cred.balanceOf(referrer) - referrerCredBefore, expectedEach);
        assertEq(cred.balanceOf(buyer) - buyerCredBefore, expectedEach);
        assertEq(ar.charmWeight(buyer) - buyerCharmBefore, 1e18);
        assertEq(ar.charmWeight(referrer) - referrerCharmBefore, 0);
        assertEq(ar.totalCharmWeight() - totalCharmBefore, 1e18);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 sig = keccak256("ReferralCredApplied(address,address,bytes32,uint256,uint256)");
        bool sawCredEvent;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].topics[0] == sig) {
                sawCredEvent = true;
                (uint256 refCred, uint256 buyCred) = abi.decode(entries[i].data, (uint256, uint256));
                assertEq(refCred, expectedEach);
                assertEq(buyCred, expectedEach);
            }
        }
        assertTrue(sawCredEvent);
    }

    /// GitLab #253: self-referral still reverts.
    function test_self_referral_reverts() public {
        (TimeArena ar, ReferralRegistry reg, MockCL8Y reserve) = _arenaWithReferrals();
        address referrer = makeAddr("selfref");

        reserve.mint(referrer, 10e18);
        doub.mint(referrer, 1_000_000e18);
        vm.startPrank(referrer);
        reserve.approve(address(reg), type(uint256).max);
        reg.registerCode("selfref");
        bytes32 codeHash = reg.hashCode("selfref");
        doub.approve(address(ar), type(uint256).max);
        vm.expectRevert("TimeArena: self-referral");
        ar.buy(1e18, codeHash);
        vm.stopPrank();
    }
}
