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

        assertEq(doub.balanceOf(address(vaults)), owed);
        assertEq(doub.balanceOf(address(adminVault)), 0);
        assertEq(doub.balanceOf(address(arena)), 0);
        assertEq(arena.totalDoubRaised(), owed);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        uint256 epochFundedEvents;
        uint256 sum175;
        uint256 sum50;
        uint256 sum25;
        bool sawAdminFunded;
        bool sawLegacyPodiumFunded;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].topics[0] == keccak256("PodiumEpochFunded(uint8,uint256,uint256,address)")) {
                epochFundedEvents++;
                uint256 amount = abi.decode(entries[i].data, (uint256));
                if (amount == 175e18) sum175++;
                else if (amount == 50e18) sum50++;
                else if (amount == 25e18) sum25++;
            } else if (entries[i].topics[0] == keccak256("PodiumFunded(uint8,uint256,address)")) {
                sawLegacyPodiumFunded = true;
            } else if (entries[i].topics[0] == keccak256("AdminVaultFunded(uint256)")) {
                sawAdminFunded = true;
            }
        }
        assertEq(epochFundedEvents, 12);
        assertEq(sum175, 4);
        assertEq(sum50, 4);
        assertEq(sum25, 4);
        assertFalse(sawAdminFunded);
        assertFalse(sawLegacyPodiumFunded);
    }

    /// GitLab #300: worked example epochs 3/4/2/5 for LB / Streak / WarBow / Booster.
    function test_buy_routes_epoch_tranches_worked_example() public {
        _rollCategoryToEpoch(arena.CAT_LAST_BUYERS(), 3);
        _rollCategoryToEpoch(arena.CAT_DEFENDED_STREAK(), 4);
        _rollCategoryToEpoch(arena.CAT_WARBOW(), 2);
        _rollCategoryToEpoch(arena.CAT_TIME_BOOSTER(), 5);

        assertEq(arena.podiumEpoch(0), 3);
        assertEq(arena.podiumEpoch(2), 4);
        assertEq(arena.podiumEpoch(3), 2);
        assertEq(arena.podiumEpoch(1), 5);

        uint256 buyAmount = 1000e18;
        vm.recordLogs();
        vm.prank(alice);
        arena.buy(1e18);

        uint256[4] memory expectedEpochs = [uint256(3), 5, 4, 2];
        uint256[3] memory trancheAmounts = [uint256(175e18), 50e18, 25e18];
        uint256[4] memory epochOffsets = [uint256(0), 1, 2, 0];

        Vm.Log[] memory entries = vm.getRecordedLogs();
        uint256[3][4] memory seen;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].topics[0] != keccak256("PodiumEpochFunded(uint8,uint256,uint256,address)")) {
                continue;
            }
            uint8 cat = uint8(uint256(entries[i].topics[1]));
            uint256 epoch = uint256(entries[i].topics[2]);
            uint256 amount = abi.decode(entries[i].data, (uint256));
            for (uint256 t; t < 3; ++t) {
                if (epoch == expectedEpochs[cat] + epochOffsets[t] && amount == trancheAmounts[t]) {
                    seen[cat][t]++;
                }
            }
        }
        for (uint8 c; c < 4; ++c) {
            for (uint256 t; t < 3; ++t) {
                assertEq(seen[c][t], 1, "cat/tranche funded once");
            }
        }
        assertEq(doub.balanceOf(address(vaults)), buyAmount);
    }

    function _rollCategoryToEpoch(uint8 cat, uint256 targetEpoch) internal {
        while (arena.podiumEpoch(cat) < targetEpoch) {
            vm.warp(arena.podiumDeadline(cat) + 1);
            arena.rollPodiumEpoch(cat);
            _warpPastBuyCooldown();
        }
    }

    /// GitLab #300: fund epoch N/N+1/N+2 tranches; roll pays active (70%) and promotes seed/future.
    function test_roll_promotes_epoch_tranches_and_pays_active() public {
        uint8 cat = arena.CAT_LAST_BUYERS();
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(1e18);

        address pool = vaults.activePools(cat);
        uint256 activeBefore = doub.balanceOf(pool);
        assertGt(activeBefore, 0);

        (address[3] memory winners,) = arena.podium(cat);
        uint256 firstBefore = doub.balanceOf(winners[0]);

        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);

        assertEq(arena.podiumEpoch(cat), 1);
        assertTrue(doub.balanceOf(winners[0]) > firstBefore, "4:2:1 payout from rolled active pool");
        assertGt(doub.balanceOf(pool), 0, "former seed tranche promoted to active");
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
        _ensureLevel(alice, 5);
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
        _ensureLevel(alice, 2);
        vm.warp(arena.podiumDeadline(1) - 200);
        uint256 before = arena.podiumDeadline(1);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(1), block.timestamp + _to[1]);
        assertGt(arena.podiumDeadline(1), before + _ext[1]);
    }

    /// GitLab #271: WarBow BP reset bonus follows Last Buy hard reset, not WarBow timer band.
    function test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer() public {
        _ensureLevel(alice, 4);
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
        assertEq(arena.epochFixedCredBonus(target, alice), 1100e18);
        assertEq(arena.pendingCred(alice, target), 1100e18);
        assertEq(arena.buyCount(alice), 1);
    }

    function test_first_buy_cred_schedules_bonus_once() public {
        uint256 target = arena.lastBuyEpoch() + 1;
        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.epochFixedCredBonus(target, bob), 1100e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.epochFixedCredBonus(target, bob), 1100e18);
    }

    function test_second_buy_no_additional_bonus() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 target = arena.lastBuyEpoch() + 1;
        assertEq(arena.epochFixedCredBonus(target, alice), 1100e18);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.epochFixedCredBonus(target, alice), 1100e18);
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
        assertEq(arena.pendingCred(alice, bonusEpoch), 1100e18);

        vm.prank(alice);
        arena.claimCred(bonusEpoch);
        assertEq(cred.balanceOf(alice), 1000e18 + 1100e18);
        assertEq(arena.pendingCred(alice, bonusEpoch), 0);
    }

    function test_claim_cred_pro_rata_plus_bonus() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 bonusEpoch = 1;
        assertEq(arena.epochFixedCredBonus(bonusEpoch, alice), 1100e18);

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
        uint256 expected = 35e18 + 1100e18;

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
        assertEq(arena.epochFixedCredBonus(2, alice), 1100e18);
    }

    function test_first_buy_flag_survives_epoch_roll() public {
        vm.prank(alice);
        arena.buy(1e18);
        uint256 target = arena.lastBuyEpoch() + 1;
        assertEq(arena.epochFixedCredBonus(target, alice), 1100e18);

        _warpNearHardReset();
        vm.prank(bob);
        arena.buy(1e18);
        assertEq(arena.epochFixedCredBonus(target, alice), 1100e18);
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
        assertEq(ArenaXp.levelFromXp(10), 2);
        assertEq(ArenaXp.xpToAdvance(10), 55);
        assertEq(ArenaXp.xpToAdvance(20), 100);
    }

    function _warpPastBuyCooldown() internal {
        vm.warp(block.timestamp + arena.buyCooldownSec() + 1);
    }

    /// GitLab #299: buy max CHARM until wallet reaches `target` level (1–5).
    function _ensureLevel(address user, uint256 target) internal {
        require(target >= 1 && target <= ArenaXp.MAX_PLAYER_LEVEL, "bad level");
        while (arena.level(user) < target) {
            _warpPastBuyCooldown();
            vm.prank(user);
            arena.buy(CHARM_MAX);
        }
        _warpPastBuyCooldown();
    }

    /// INV-TIME-ARENA-XP-GAS: incremental onchain state matches lifetime reference after buys.
    function test_xp_incremental_matches_reference_many_buys() public {
        uint256 charm = 10e18;
        for (uint256 i = 0; i < 40; ++i) {
            _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(charm);
            assertEq(arena.level(alice), ArenaXp.clampLevel(ArenaXp.levelFromXp(arena.xp(alice))));
            assertEq(arena.xpToNextLevel(alice), ArenaXp.xpRemainingToNextLevel(arena.level(alice), arena.xpTowardNext(alice)));
        }
    }

    function test_xp_max_charm_first_buy() public {
        vm.prank(alice);
        arena.buy(10e18);
        assertEq(arena.level(alice), 2);
        assertEq(arena.xpTowardNext(alice), 0);
        assertEq(arena.xpToNextLevel(alice), 15);
    }

    /// GitLab #250: `_finishBuy` emits `XpGained(buyer, amount, newLevel)`.
    function test_xp_emits_XpGained() public {
        vm.expectEmit(true, false, false, true);
        emit TimeArena.XpGained(alice, 10, 2);
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

    /// GitLab #304: min-band buy → 1 XP; max-band buy → 10 XP (~10× delta).
    function test_xp_min_vs_max_charm_single_buy() public {
        vm.prank(alice);
        arena.buy(CHARM_MIN);
        assertEq(arena.xp(alice), 1);

        vm.prank(bob);
        arena.buy(CHARM_MAX);
        assertEq(arena.xp(bob), 10);
        assertEq(arena.xp(bob) / arena.xp(alice), 10);
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
        assertEq(arena.level(alice), ArenaXp.MAX_PLAYER_LEVEL);

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
        _ensureLevel(alice, 2);
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        _ensureLevel(bob, 2);
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
        _ensureLevel(bob, 4);
        _boostWarbowVictim(bob);
        _ensureLevel(alice, 4);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(1e18);
        uint256 balBefore = doub.balanceOf(address(arena));
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        assertEq(doub.balanceOf(address(arena)) - balBefore, 1000e18);
    }

    /// GitLab #252: guard pulls 10_000 DOUB.
    function test_warbow_guard_pulls_doub() public {
        _ensureLevel(alice, 4);
        uint256 balBefore = doub.balanceOf(address(arena));
        vm.prank(alice);
        arena.warbowActivateGuard();
        assertEq(doub.balanceOf(address(arena)) - balBefore, 10_000e18);
        assertGt(arena.warbowGuardUntil(alice), block.timestamp);
    }

    /// GitLab #252: revenge pulls 1000 DOUB.
    function test_warbow_revenge_pulls_doub() public {
        _seedWarbowStealBand(bob, alice);
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        uint256 balBefore = doub.balanceOf(address(arena));
        vm.prank(bob);
        arena.warbowRevenge(alice);
        assertEq(doub.balanceOf(address(arena)) - balBefore, 1000e18);
    }

    /// GitLab #252: fourth steal on same victim in a UTC day pulls steal + 50_000 DOUB override.
    function test_warbow_steal_limit_override_pulls_doub() public {
        _seedWarbowStealBand(bob, alice);
        for (uint256 i; i < 3; ++i) {
            vm.prank(alice);
            arena.warbowSteal(bob, false);
            _boostWarbowVictim(bob);
        }
        uint256 balBefore = doub.balanceOf(address(arena));
        vm.prank(alice);
        arena.warbowSteal(bob, true);
        assertEq(doub.balanceOf(address(arena)) - balBefore, 1000e18 + 50_000e18);
    }

    /// GitLab #252: flag claim costs zero DOUB and awards BP.
    function test_warbow_flag_claim_zero_doub() public {
        _ensureLevel(alice, 5);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(alice, 1e18, bytes32(0), true);
        uint256 arenaBalBefore = doub.balanceOf(address(arena));
        vm.warp(block.timestamp + arena.WARBOW_FLAG_SILENCE_SEC());
        uint256 bpBefore = arena.battlePoints(alice);
        vm.prank(alice);
        arena.claimWarBowFlag();
        assertEq(doub.balanceOf(address(arena)), arenaBalBefore);
        assertEq(arena.battlePoints(alice), bpBefore + arena.WARBOW_FLAG_CLAIM_BP());
    }

    /// GitLab #252: WarBow epoch roll clears live battlePoints (generation bump).
    function test_warbow_epoch_roll_clears_battle_points() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        arena.buy(1e18);
        assertGt(arena.battlePoints(alice), 0);

        vm.warp(arena.podiumDeadline(arena.CAT_WARBOW()) + 1);
        arena.rollPodiumEpoch(arena.CAT_WARBOW());

        assertEq(arena.battlePoints(alice), 0);
        assertEq(arena.podiumEpoch(arena.CAT_WARBOW()), 1);
    }

    /// GitLab #252: roll retains pool; admin finalizeWarbowPodium pays 4:2:1 for past epoch.
    function test_finalize_warbow_podium_pays_after_roll() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        arena.buy(10e18);
        _warpPastBuyCooldown();
        _ensureLevel(bob, 4);
        vm.prank(bob);
        arena.buy(10e18);

        uint8 cat = arena.CAT_WARBOW();
        address pool = vaults.activePools(cat);
        uint256 poolBal = doub.balanceOf(pool);
        assertGt(poolBal, 0);

        (address[3] memory winners,) = arena.podium(cat);
        assertTrue(winners[0] != address(0));

        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);

        assertEq(arena.podiumEpoch(cat), 1);
        assertEq(doub.balanceOf(pool), poolBal, "WarBow roll must not auto-pay");

        uint256 firstBefore = doub.balanceOf(winners[0]);
        arena.finalizeWarbowPodium(0, winners[0], winners[1], winners[2]);
        assertTrue(doub.balanceOf(winners[0]) > firstBefore);
        assertTrue(arena.warbowEpochFinalized(0));
    }

    /// Sets victim BP high and attacker BP low so steal band (2x–10x) passes.
    function _seedWarbowStealBand(address victim, address attacker) internal {
        _ensureLevel(victim, 4);
        _boostWarbowVictim(victim);
        _ensureLevel(attacker, 4);
        _warpPastBuyCooldown();
        vm.prank(attacker);
        arena.buy(1e18);
        _warpPastBuyCooldown();
    }

    function _boostWarbowVictim(address victim) internal {
        vm.startPrank(victim);
        for (uint256 i; i < 4; ++i) {
            _warpPastBuyCooldown();
            arena.buy(10e18);
        }
        vm.stopPrank();
        _warpPastBuyCooldown();
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

    /// GitLab #261: four PodiumFunded + four SeedFunded at 100e18 / 75e18; no AdminVaultFunded.
    function test_topUpPodiumPools_700_emits_per_category_funding() public {
        vm.recordLogs();
        vm.prank(alice);
        arena.topUpPodiumPools(700e18);

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
                sawAdminFunded = true;
            }
        }
        assertEq(podiumEvents, 4);
        assertEq(seedEvents, 4);
        assertFalse(sawAdminFunded);
    }

    function test_topUpPodiumPools_reverts_without_allowance_no_vault_mutation() public {
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        uint256 adminBefore = doub.balanceOf(address(adminVault));
        vm.prank(bob);
        doub.approve(address(arena), 0);
        vm.prank(bob);
        vm.expectRevert();
        arena.topUpPodiumPools(1e18);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore);
        assertEq(doub.balanceOf(address(adminVault)), adminBefore);
    }

    /// GitLab #300: buy routes 100% to podiums; top-up (#261) uses legacy 10:7.5 active:seed — distinct paths.
    function test_topUpPodiumPools_distinct_from_buy_routing() public {
        TimeArena buyArena = _newArena();
        vm.prank(alice);
        buyArena.buy(1e18);

        TimeArena topUpArena = _newArena();
        vm.prank(alice);
        topUpArena.topUpPodiumPools(700e18);

        assertEq(doub.balanceOf(address(_vaultsFor(buyArena))), 1000e18);
        assertEq(doub.balanceOf(address(_adminFor(buyArena))), 0);
        assertEq(doub.balanceOf(address(_vaultsFor(topUpArena))), 700e18);
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

    /// GitLab #253 / #272: referred buy mints flat Play CRED per side, not CHARM weight.
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

        uint256 expectedEach = ar.REFERRAL_CRED_FLAT_WAD();
        assertEq(expectedEach, 5e18);
        assertTrue(ar.CRED_PER_BUY() != expectedEach, "referral flat decoupled from epoch CRED tranche");
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

    /// GitLab #299: level cap at 5 onchain.
    function test_level_cap_at_five() public {
        _ensureLevel(alice, 5);
        assertEq(arena.level(alice), 5);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(CHARM_MAX);
        assertEq(arena.level(alice), 5);
        assertEq(arena.xpTowardNext(alice), 0);
        assertEq(arena.xpToNextLevel(alice), 0);
    }

    /// GitLab #299: level-1 buy extends only Last Buy timer.
    function test_level_1_gates_timers() public {
        uint256[4] memory before;
        for (uint8 c = 0; c < 4; ++c) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(0), before[0] + _ext[0]);
        assertEq(arena.podiumDeadline(1), before[1]);
        assertEq(arena.podiumDeadline(2), before[2]);
        assertEq(arena.podiumDeadline(3), before[3]);
    }

    /// GitLab #299: level-2 unlocks Time Booster timer only among secondary podiums.
    function test_level_2_gates_timers() public {
        _ensureLevel(alice, 2);
        uint256[4] memory before;
        for (uint8 c = 0; c < 4; ++c) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(0), before[0] + _ext[0]);
        assertEq(arena.podiumDeadline(1), before[1] + _ext[1]);
        assertEq(arena.podiumDeadline(2), before[2]);
        assertEq(arena.podiumDeadline(3), before[3]);
    }

    /// GitLab #299: level-3 unlocks Defended Streak timer extension.
    function test_level_3_gates_timers() public {
        _ensureLevel(alice, 3);
        uint256[4] memory before;
        for (uint8 c = 0; c < 4; ++c) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(2), before[2] + _ext[2]);
        assertEq(arena.podiumDeadline(3), before[3]);
    }

    /// GitLab #299: level-4 unlocks WarBow timer + BP; level-5 for flags.
    function test_level_4_warbow_bp_and_level_5_flag() public {
        _ensureLevel(alice, 4);
        uint256 bpBefore = arena.battlePoints(alice);
        vm.prank(alice);
        arena.buy(1e18);
        assertGt(arena.battlePoints(alice), bpBefore);

        address flagger = makeAddr("flagger");
        doub.mint(flagger, 1_000_000e18);
        vm.prank(flagger);
        doub.approve(address(arena), type(uint256).max);
        _ensureLevel(flagger, 5);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(flagger, 1e18, bytes32(0), true);
        assertEq(arena.warbowPendingFlagOwner(), flagger);
    }

    /// GitLab #299: level < 5 cannot plant flag via buy.
    function test_level_4_buy_plant_flag_ignored() public {
        _ensureLevel(alice, 4);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(alice, 1e18, bytes32(0), true);
        assertEq(arena.warbowPendingFlagOwner(), address(0));
    }

    /// GitLab #299: level < 4 cannot WarBow steal.
    function test_level_3_warbow_steal_reverts() public {
        _ensureLevel(bob, 4);
        _boostWarbowVictim(bob);
        _ensureLevel(alice, 3);
        vm.prank(alice);
        vm.expectRevert("TimeArena: level");
        arena.warbowSteal(bob, false);
    }

    /// GitLab #299: onboarding — two starter CHARM buys reach level 2.
    function test_onboarding_two_starter_buys_reach_level_two() public {
        cred.mint(alice, 10_000e18);
        uint256 starter = arena.ONBOARDING_STARTER_CHARM_WAD();
        vm.startPrank(alice);
        arena.buyWithCred(starter);
        assertEq(arena.level(alice), 2);
        _warpPastBuyCooldown();
        arena.buyWithCred(starter);
        vm.stopPrank();
        assertGe(arena.level(alice), 2);
    }

    /// GitLab #299: grandfather migration grants level 5 to prior buyers.
    function test_grandfather_progression() public {
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.level(alice), 1);
        address[] memory wallets = new address[](1);
        wallets[0] = alice;
        arena.grandfatherProgression(wallets);
        assertEq(arena.level(alice), 5);
    }
}
