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

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, 5, 15, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
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

    /// GitLab #300: worked example epoch tranches for LB / Streak / WarBow / Booster.
    function test_buy_routes_epoch_tranches_worked_example() public {
        _rollCategoryToEpoch(arena.CAT_TIME_BOOSTER(), 5);
        _rollCategoryToEpoch(arena.CAT_WARBOW(), 2);
        _rollCategoryToEpoch(arena.CAT_DEFENDED_STREAK(), 4);
        _rollCategoryToEpoch(arena.CAT_LAST_BUYERS(), 3);

        uint256[4] memory expectedEpochs = [
            arena.podiumEpoch(0),
            arena.podiumEpoch(1),
            arena.podiumEpoch(2),
            arena.podiumEpoch(3)
        ];

        uint256 raisedBefore = arena.totalDoubRaised();
        vm.recordLogs();
        vm.prank(alice);
        arena.buy(1e18);

        uint256[3] memory trancheAmounts = [uint256(175e18), 50e18, 25e18];

        Vm.Log[] memory entries = vm.getRecordedLogs();
        uint256[3][4] memory seen;
        uint256[4] memory minEpoch;
        for (uint8 c; c < 4; ++c) {
            minEpoch[c] = type(uint256).max;
        }
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].topics[0] != keccak256("PodiumEpochFunded(uint8,uint256,uint256,address)")) {
                continue;
            }
            uint8 cat = uint8(uint256(entries[i].topics[1]));
            uint256 epoch = uint256(entries[i].topics[2]);
            uint256 amount = abi.decode(entries[i].data, (uint256));
            if (epoch < minEpoch[cat]) {
                minEpoch[cat] = epoch;
            }
            for (uint256 t; t < 3; ++t) {
                if (amount == trancheAmounts[t]) {
                    seen[cat][t]++;
                }
            }
        }
        for (uint8 c; c < 4; ++c) {
            for (uint256 t; t < 3; ++t) {
                assertEq(seen[c][t], 1, "cat/tranche funded once");
            }
        }
        assertEq(arena.totalDoubRaised(), raisedBefore + 1000e18);
    }

    function _rollCategoryToEpoch(uint8 cat, uint256 targetEpoch) internal {
        address roller = makeAddr(string(abi.encodePacked("roller", cat)));
        doub.mint(roller, 1_000_000e18);
        vm.prank(roller);
        doub.approve(address(arena), type(uint256).max);
        while (arena.podiumEpoch(cat) < targetEpoch) {
            if (!arena.podiumTimerArmed(cat)) {
                uint256 minLevel = cat == 0 ? 1 : cat + 1;
                _ensureLevel(roller, minLevel);
                vm.prank(roller);
                arena.buy(1e18);
                _warpPastBuyCooldown();
            }
            vm.warp(arena.podiumDeadline(cat) + 1);
            arena.rollPodiumEpoch(cat);
        }
        _freezeCharmPrice();
    }

    /// @dev Podium rolls warp time forward; reset epoch anchor so DOUB pulls stay at 1000/CHARM in tests (#305).
    function _freezeCharmPrice() internal {
        arena.setEpochCharmAnchorWad(1000e18);
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
        uint256 activeBefore = vaults.activePoolBalance(cat);
        assertGt(activeBefore, 0);

        (address[3] memory winners,) = arena.podium(cat);
        uint256 firstBefore = doub.balanceOf(winners[0]);

        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);

        assertEq(arena.podiumEpoch(cat), 1);
        assertTrue(doub.balanceOf(winners[0]) > firstBefore, "4:2:1 payout from rolled active pool");
        assertGt(vaults.activePoolBalance(cat), 0, "former seed tranche promoted to active");
    }

    function test_timer_hard_reset_increments_epoch() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
    }

    /// INV-TIME-ARENA-EPOCH-EVENT (#246): hard reset emits `LastBuyEpochStarted`.
    function test_emits_LastBuyEpochStarted_on_hard_reset() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
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

    /// INV-TIME-ARENA-BUY-ENERGY-332: new wallets start with capped charges.
    function test_buy_energy_initial_state_full_charges() public view {
        (
            uint8 charges,
            uint8 maxCharges,
            uint256 lastRefillAt,
            uint256 lastBuyAt,
            uint256 nextChargeAt,
            uint256 nextAllowedAt
        ) = arena.buyEnergyState(alice);
        assertEq(charges, 5);
        assertEq(maxCharges, 5);
        assertEq(lastRefillAt, block.timestamp);
        assertEq(lastBuyAt, 0);
        assertEq(nextChargeAt, 0);
        assertEq(nextAllowedAt, 0);
    }

    /// INV-TIME-ARENA-BUY-ENERGY-332: each successful buy spends exactly one charge.
    function test_buy_spends_one_buy_charge() public {
        vm.prank(alice);
        arena.buy(1e18);
        (uint8 charges,,,,,) = arena.buyEnergyState(alice);
        assertEq(charges, 4);
    }

    /// INV-TIME-ARENA-BUY-ENERGY-332: burst cooldown gates rapid repeat buys even with charges.
    function test_buy_reverts_inside_burst_cooldown() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.prank(alice);
        vm.expectRevert("TimeArena: burst cooldown");
        arena.buy(1e18);
    }

    function test_buy_succeeds_at_exact_burst_boundary_if_charge_available() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(block.timestamp + arena.burstBuyCooldownSec());
        vm.prank(alice);
        arena.buy(1e18);
        (uint8 charges,,,,,) = arena.buyEnergyState(alice);
        assertEq(charges, 3);
    }

    function test_buy_charge_refills_at_exact_interval() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(block.timestamp + arena.buyChargeIntervalSec());
        (uint8 charges,,,, uint256 nextChargeAt,) = arena.buyEnergyState(alice);
        assertEq(charges, 5);
        assertEq(nextChargeAt, 0);
    }

    function test_buy_charges_cap_after_long_idle() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(block.timestamp + arena.buyChargeIntervalSec() * 20);
        (uint8 charges,,,,,) = arena.buyEnergyState(alice);
        assertEq(charges, arena.maxBuyCharges());
    }

    function test_buy_energy_cap_includes_level_bonus() public {
        _ensureLevel(alice, 2);
        (, uint8 level2Cap,,,,) = arena.buyEnergyState(alice);
        assertEq(level2Cap, 6);

        vm.warp(block.timestamp + arena.buyChargeIntervalSec() * 20);
        (uint8 level2Charges,,,,,) = arena.buyEnergyState(alice);
        assertEq(level2Charges, 6);

        _ensureLevel(alice, 5);
        (, uint8 level5Cap,,,,) = arena.buyEnergyState(alice);
        assertEq(level5Cap, 9);
        assertEq(arena.maxBuyCharges(), 5);

        vm.warp(block.timestamp + arena.buyChargeIntervalSec() * 20);
        (uint8 level5Charges,,,,,) = arena.buyEnergyState(alice);
        assertEq(level5Charges, 9);
    }

    function test_buy_energy_preserves_partial_interval_progress() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(block.timestamp + arena.burstBuyCooldownSec());
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(block.timestamp + arena.buyChargeIntervalSec() + 100);
        vm.prank(alice);
        arena.buy(1e18);
        (uint8 charges,, uint256 lastRefillAt, uint256 lastBuyAt, uint256 nextChargeAt,) = arena.buyEnergyState(alice);
        assertEq(charges, 3);
        assertEq(lastBuyAt, block.timestamp);
        assertEq(nextChargeAt, lastRefillAt + arena.buyChargeIntervalSec());
        assertLt(nextChargeAt, block.timestamp + arena.buyChargeIntervalSec());
    }

    function test_buy_reverts_when_charges_exhausted_until_next_charge() public {
        for (uint256 i; i < 5; ++i) {
            if (i > 0) vm.warp(block.timestamp + arena.burstBuyCooldownSec());
            vm.prank(alice);
            arena.buy(1e18);
        }
        vm.warp(block.timestamp + arena.burstBuyCooldownSec());
        vm.prank(alice);
        vm.expectRevert("TimeArena: no buy charges");
        arena.buy(1e18);

        vm.warp(block.timestamp + arena.buyChargeIntervalSec() - 4 * arena.burstBuyCooldownSec());
        vm.prank(alice);
        arena.buy(1e18);
    }

    /// INV-TIME-ARENA-DOUB-PRICE (#246, #305): owner epoch anchor changes DOUB owed.
    function test_setEpochCharmAnchorWad_changes_doub_owed() public {
        arena.setEpochCharmAnchorWad(2000e18);
        uint256 balBefore = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(doub.balanceOf(alice), balBefore - 2000e18);
    }

    /// INV-ERC20-123 (#246): fee-on-transfer DOUB reverts on ingress parity mismatch.
    function test_feeOnTransfer_buy_reverts_erc20Parity() public {
        MockERC20FeeOnTransfer feeDoub = new MockERC20FeeOnTransfer(100);
        PodiumVaults v = new PodiumVaults(feeDoub, admin);
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (feeDoub, v, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, 5, 15, admin)
        );
        TimeArena feeArena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(feeArena));
        feeArena.startArena();
        feeDoub.mint(alice, 1_000_000e18);
        vm.prank(alice);
        feeDoub.approve(address(feeArena), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        feeArena.buy(1e18);
    }

    /// GitLab #246 / #305 fuzz: in-band CHARM → DOUB pull matches `charmWad × effectiveCharmPriceWad / 1e18`.
    function testFuzz_buy_charmInBand_doubPullParity(uint96 rawCharm) public {
        uint256 charmWad = bound(uint256(rawCharm), CHARM_MIN, CHARM_MAX);
        _warpPastBuyCooldown();
        _freezeCharmPrice();
        uint256 expected = Math.mulDiv(charmWad, arena.effectiveCharmPriceWad(), WAD);
        uint256 aliceBefore = doub.balanceOf(alice);
        uint256 raisedBefore = arena.totalDoubRaised();
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

    function testFuzz_setEpochCharmAnchorWad_doubOwed(uint96 rawCharm, uint128 rawPrice) public {
        uint256 charmWad = bound(uint256(rawCharm), CHARM_MIN, CHARM_MAX);
        uint256 price = bound(uint256(rawPrice), 1, 1e23);
        uint256 expected = Math.mulDiv(charmWad, price, WAD);
        vm.assume(expected <= doub.balanceOf(alice));
        arena.setEpochCharmAnchorWad(price);
        uint256 aliceBefore = doub.balanceOf(alice);
        _warpPastBuyCooldown();
        _freezeCharmPrice();
        expected = Math.mulDiv(charmWad, arena.effectiveCharmPriceWad(), WAD);
        vm.prank(alice);
        arena.buy(charmWad);
        assertEq(doub.balanceOf(alice), aliceBefore - expected);
    }

    function test_timer_extension_without_hard_reset() public {
        uint256 t0 = block.timestamp;
        vm.prank(alice);
        arena.buy(1e18);
        assertTrue(arena.podiumTimerArmed(0));
        assertEq(arena.deadline(), t0 + _init[0] + _ext[0]);
        assertEq(arena.lastBuyEpoch(), 0);
    }

    /// INV-TIME-ARENA-TIMER-MULTI (#271): one buy extends each podium by its category extension.
    function test_multi_podium_deadline_extend() public {
        address player = makeAddr("multiExt");
        doub.mint(player, 1_000_000e18);
        vm.prank(player);
        doub.approve(address(arena), type(uint256).max);
        _ensureLevel(player, 5);
        uint256[4] memory before;
        for (uint8 c = 0; c < 4; c++) {
            before[c] = arena.podiumDeadline(c);
        }
        vm.prank(player);
        arena.buy(1e18);
        for (uint8 c = 0; c < 4; c++) {
            assertEq(arena.podiumDeadline(c), before[c] + _ext[c], "category mismatch");
        }
    }

    /// GitLab #330: timers unarmed at `startArena`; deadlines zero until first qualifying buy.
    function test_start_arena_timers_unarmed() public view {
        for (uint8 c = 0; c < 4; c++) {
            assertFalse(arena.podiumTimerArmed(c));
            assertEq(arena.podiumDeadline(c), 0);
        }
        assertEq(arena.deadline(), 0);
    }

    /// GitLab #330: idle epochs do not autoroll before first qualifying buy arms the timer.
    function test_no_autoroll_before_timer_armed() public {
        vm.warp(block.timestamp + _init[0] + 1);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumEpoch(0), 0);
        assertTrue(arena.podiumTimerArmed(0));
    }

    /// GitLab #330: per-category arm on first qualifying buy (level gates).
    function test_per_category_arm_on_first_qualifying_buy() public {
        address lvl1 = makeAddr("lvl1");
        doub.mint(lvl1, 1_000_000e18);
        vm.prank(lvl1);
        doub.approve(address(arena), type(uint256).max);
        uint256 t0 = block.timestamp;
        vm.prank(lvl1);
        arena.buy(1e18);
        assertTrue(arena.podiumTimerArmed(0));
        assertFalse(arena.podiumTimerArmed(1));
        assertEq(arena.podiumDeadline(0), t0 + _init[0] + _ext[0]);

        address lvl2 = makeAddr("lvl2");
        doub.mint(lvl2, 1_000_000e18);
        vm.prank(lvl2);
        doub.approve(address(arena), type(uint256).max);
        _ensureLevel(lvl2, 2);
        assertTrue(arena.podiumTimerArmed(1));
        assertFalse(arena.podiumTimerArmed(2));
    }

    /// GitLab #330: cannot roll an unarmed epoch.
    function test_roll_podium_reverts_when_unarmed() public {
        vm.expectRevert("TimeArena: timer not armed");
        arena.rollPodiumEpoch(2);
    }

    /// GitLab #271: Time Booster hard-reset band snaps to 300s, not +60s extension.
    function test_time_booster_hard_reset_band_240_to_300() public {
        _ensureLevel(alice, 2);
        _armPodiumTimer(1);
        vm.warp(arena.podiumDeadline(1) - 200);
        uint256 before = arena.podiumDeadline(1);
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(1), block.timestamp + _to[1]);
        assertGt(arena.podiumDeadline(1), before + _ext[1]);
    }

    /// GitLab #271: WarBow BP reset bonus follows Last Buy hard reset, not WarBow timer band.
    function test_warbow_bp_bonus_uses_last_buy_hard_reset_not_warbow_timer() public {
        address wb = makeAddr("wb");
        doub.mint(wb, 1_000_000e18);
        vm.prank(wb);
        doub.approve(address(arena), type(uint256).max);
        _ensureLevel(wb, 4);
        _warpPastBuyCooldown();
        vm.prank(wb);
        arena.buy(1e18);
        uint256 dl3 = arena.podiumDeadline(3);
        uint256 rem3 = dl3 > block.timestamp ? dl3 - block.timestamp : 0;
        if (rem3 > _below[3]) {
            vm.warp(block.timestamp + rem3 - (_below[3] - 100));
        }
        assertLt(arena.podiumDeadline(3) - block.timestamp, _below[3]);

        uint256 bpBefore = arena.battlePoints(wb);
        _warpPastBuyCooldown();
        vm.prank(wb);
        arena.buy(1e18);
        uint256 bpGain = arena.battlePoints(wb) - bpBefore;
        assertEq(bpGain, arena.WARBOW_BASE_BUY_BP(), "no WarBow reset bonus without Last Buy hard reset");
    }

    /// GitLab #271: Defended streak window uses Last Buy remaining, not other podium timers.
    function test_defended_streak_uses_last_buy_timer_not_other_podium() public {
        _armPodiumTimer(1);
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
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(2e18);

        _warpNearHardReset();
        _freezeCharmPrice();
        vm.prank(alice);
        arena.buy(1e18);

        uint256 ep = 0;
        assertEq(arena.epochCharmTotal(ep), 3e18);

        vm.prank(alice);
        arena.claimCred(ep);
        assertEq(arena.epochCharmWad(ep, alice), 0);
        assertGt(cred.balanceOf(alice), 0);
    }

    /// INV-TIME-ARENA-CRED-PRO-RATA-SPLIT: two DOUB buyers at 1:2 CHARM split 70 CRED pool (#248).
    function test_cred_pro_rata_exact_1_2_split() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(2e18);

        uint256 ep = 0;
        assertEq(arena.epochCharmTotal(ep), 3e18);
        assertEq(arena.epochCredPool(ep), 70e18);

        _endLastBuyEpoch();

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

    /// INV-TIME-ARENA-CRED-ACCRUE-CRED-BUY: `buyWithCred` adds 35 CRED to epoch pool (#311).
    function test_cred_accrue_on_cred_buy() public {
        uint256 ep = arena.lastBuyEpoch();
        uint256 poolBefore = arena.epochCredPool(ep);
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(arena.epochCredPool(ep), poolBefore + 35e18);
    }

    /// INV-TIME-ARENA-CRED-BURN-BUY: `buyWithCred` burns 100 CRED per 1e18 CHARM (#268).
    /// INV-TIME-ARENA-CRED-POOL-ACCRUE: `buyWithCred` adds 35 CRED to epoch pool per buy (#311).
    function test_buy_with_cred() public {
        uint256 ep = arena.lastBuyEpoch();
        uint256 poolBefore = arena.epochCredPool(ep);
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(cred.balanceOf(alice), 1000e18 - 100e18);
        assertEq(arena.epochCredPool(ep), poolBefore + 35e18);
    }

    /// INV-TIME-ARENA-CRED-POOL-ACCRUE: each `buyWithCred` adds 35 CRED to the active epoch pool (#311).
    function test_buyWithCred_accrues_epoch_cred_pool() public {
        uint256 ep = arena.lastBuyEpoch();
        assertEq(arena.epochCredPool(ep), 0);
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(arena.epochCredPool(ep), 35e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buyWithCred(2e18);
        assertEq(arena.epochCredPool(ep), 70e18);
    }

    /// INV-TIME-ARENA-CRED-PRO-RATA-MIXED: DOUB + CRED buyers share epoch pool fairly (#311).
    function test_buyWithCred_mixed_pro_rata_with_doub() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buyWithCred(2e18);

        uint256 ep = 0;
        assertEq(arena.epochCharmTotal(ep), 3e18);
        assertEq(arena.epochCredPool(ep), 70e18);

        _endLastBuyEpoch();

        uint256 aliceShare = Math.mulDiv(70e18, 1e18, 3e18);
        uint256 bobShare = Math.mulDiv(70e18, 2e18, 3e18);

        vm.prank(alice);
        arena.claimCred(ep);
        vm.prank(bob);
        arena.claimCred(ep);

        assertEq(cred.balanceOf(alice), 1000e18 + aliceShare);
        assertEq(cred.balanceOf(bob), 1000e18 - 200e18 + bobShare);
        assertLe(aliceShare + bobShare, 70e18);
        assertGe(aliceShare + bobShare, 70e18 - 2);
    }

    /// INV-TIME-ARENA-CRED-POOL-EPOCH-BOUNDARY: epoch roll then `buyWithCred` credits correct pools (#311).
    function test_buyWithCred_epoch_boundary_credits_correct_pool() public {
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.epochCredPool(0), 35e18);

        _endLastBuyEpoch();
        assertEq(arena.lastBuyEpoch(), 1);
        _warpPastBuyCooldown();

        vm.prank(bob);
        arena.buyWithCred(1e18);
        assertEq(arena.epochCredPool(0), 35e18);
        assertEq(arena.epochCredPool(1), 35e18);
    }

    /// INV-TIME-ARENA-CRED-POOL-EPOCH: `buyWithCred` at hard reset credits post-reset epoch pool (#311).
    function test_buyWithCred_at_epoch_boundary() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
        _freezeCharmPrice();

        uint256 epBefore = arena.lastBuyEpoch();
        assertEq(arena.epochCredPool(epBefore), 35e18);

        vm.prank(bob);
        arena.buyWithCred(1e18);

        uint256 epAfter = arena.lastBuyEpoch();
        assertGt(epAfter, epBefore);
        assertEq(arena.epochCredPool(epAfter), 35e18);
        assertEq(arena.epochCredPool(epBefore), 35e18);
    }

    /// INV-TIME-ARENA-CRED-EPOCH-BOUNDARY: `buyWithCred` at hard reset credits post-reset epoch pool (solo) (#311).
    function test_cred_accrue_buyWithCred_at_epoch_boundary() public {
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
        uint256 epBefore = arena.lastBuyEpoch();
        vm.prank(alice);
        arena.buyWithCred(1e18);
        uint256 epAfter = arena.lastBuyEpoch();
        assertEq(epAfter, epBefore + 1);
        assertEq(arena.epochCredPool(epAfter), 35e18);
        assertEq(arena.epochCredPool(epBefore), 35e18);
    }

    /// Attack: CRED-only buyer cannot extract more than fair pro-rata share (#311).
    function test_cred_only_buyer_fair_share() public {
        vm.prank(alice);
        arena.buyWithCred(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buyWithCred(1e18);

        uint256 ep = 0;
        assertEq(arena.epochCredPool(ep), 70e18);
        _endLastBuyEpoch();

        vm.prank(alice);
        arena.claimCred(ep);
        uint256 aliceGot = cred.balanceOf(alice);
        vm.prank(bob);
        arena.claimCred(ep);
        uint256 bobGot = cred.balanceOf(bob);

        assertEq(aliceGot, 1000e18 - 100e18 + 35e18);
        assertEq(bobGot, 1000e18 - 100e18 + 35e18);
        assertEq(aliceGot - (1000e18 - 100e18) + bobGot - (1000e18 - 100e18), 70e18);
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
        uint256 expected = arena.pendingCred(alice, bonusEpoch);

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
        vm.prank(alice);
        arena.buy(1e18);
        _warpNearHardReset();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.lastBuyEpoch(), 1);
        assertEq(arena.epochFixedCredBonus(1, alice), 1100e18);
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
        require(arena.podiumTimerArmed(0), "arm Last Buy first");
        uint256 dl = arena.deadline();
        uint256 remaining = dl > block.timestamp ? dl - block.timestamp : 0;
        if (remaining > 600) {
            vm.warp(block.timestamp + remaining - 600);
        }
        _freezeCharmPrice();
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
        vm.warp(block.timestamp + arena.buyChargeIntervalSec() + 1);
    }

    /// Arms all four podium timers via a level-5 buy (GitLab #330).
    function _armAllPodiumTimers() internal {
        _ensureLevel(alice, 5);
        if (!arena.podiumTimerArmed(3)) {
            vm.prank(alice);
            arena.buy(1e18);
        }
    }

    /// Arms a single category timer with the minimum qualifying buy ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)).
    function _armPodiumTimer(uint8 cat) internal {
        if (arena.podiumTimerArmed(cat)) return;
        uint256 minLevel = cat == 0 ? 1 : cat + 1;
        _ensureLevel(alice, minLevel);
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
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

    /// Level to 4 with exactly one WarBow BP grant (the level-up buy).
    function _reachLevel4OneWarbowBuy(address user) internal {
        while (arena.level(user) < 3) {
            _warpPastBuyCooldown();
            vm.prank(user);
            arena.buy(CHARM_MAX);
        }
        while (arena.level(user) < 4) {
            _warpPastBuyCooldown();
            vm.prank(user);
            arena.buy(CHARM_MAX);
        }
        assertEq(arena.level(user), 4);
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
        _armPodiumTimer(1);
        vm.warp(arena.podiumDeadline(1) + 1);
        vm.prank(alice);
        arena.rollPodiumEpoch(1);
        assertEq(arena.podiumEpoch(1), 1);
        assertFalse(arena.podiumTimerArmed(1));
        assertEq(arena.podiumDeadline(1), 0);
    }

    /// GitLab #247: one category roll disarms only its timer; Streak/Booster/WarBow diverge from Last Buy.
    function test_podium_timers_diverge_after_single_roll() public {
        _armAllPodiumTimers();
        uint256 lastBuyDl = arena.podiumDeadline(0);
        assertTrue(lastBuyDl != arena.podiumDeadline(1));

        vm.warp(arena.podiumDeadline(1) + 1);
        arena.rollPodiumEpoch(arena.CAT_TIME_BOOSTER());

        assertFalse(arena.podiumTimerArmed(1));
        assertEq(arena.podiumDeadline(1), 0);
        assertEq(arena.podiumDeadline(0), lastBuyDl);
        assertTrue(arena.podiumDeadline(0) != arena.podiumDeadline(1));
        assertTrue(arena.podiumDeadline(2) != arena.podiumDeadline(1));
        assertTrue(arena.podiumDeadline(3) != arena.podiumDeadline(1));
    }

    /// GitLab #247: `podiumEpoch[cat]` counters advance independently when categories roll on different schedules.
    function test_podium_epochs_independent_after_skewed_rolls() public {
        _armAllPodiumTimers();
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
        _armPodiumTimer(2);
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

    /// GitLab #247: other podium rolls do not bump global `lastBuyEpoch`.
    function test_last_buy_epoch_on_hard_reset_not_on_other_podium_roll() public {
        address carol = makeAddr("carol");
        doub.mint(carol, 1_000_000e18);
        vm.prank(carol);
        doub.approve(address(arena), type(uint256).max);
        vm.prank(carol);
        arena.buy(1e18);
        address[] memory wallets = new address[](1);
        wallets[0] = carol;
        arena.grandfatherProgression(wallets);
        _warpPastBuyCooldown();
        vm.prank(carol);
        arena.buy(1e18);
        vm.warp(arena.podiumDeadline(arena.CAT_DEFENDED_STREAK()) + 1);
        uint256 lbEpoch = arena.lastBuyEpoch();
        uint256 streakEpoch = arena.podiumEpoch(arena.CAT_DEFENDED_STREAK());
        arena.rollPodiumEpoch(arena.CAT_DEFENDED_STREAK());
        assertEq(arena.lastBuyEpoch(), lbEpoch);
        assertEq(arena.podiumEpoch(arena.CAT_DEFENDED_STREAK()), streakEpoch + 1);
    }

    function test_warbow_steal_pulls_doub() public {
        _ensureLevel(bob, 4);
        _boostWarbowVictim(bob);
        _ensureLevel(alice, 4);
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.buy(1e18);
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        uint256 raisedBefore = arena.totalDoubRaised();
        uint256 arenaBalBefore = doub.balanceOf(address(arena));
        _warpPastBuyCooldown();
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore + arena.WARBOW_STEAL_DOUB());
        assertEq(doub.balanceOf(address(arena)), arenaBalBefore);
        assertEq(arena.totalDoubRaised(), raisedBefore + arena.WARBOW_STEAL_DOUB());
    }

    /// GitLab #252: guard pulls 10_000 DOUB.
    function test_warbow_guard_pulls_doub() public {
        _ensureLevel(alice, 4);
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        uint256 raisedBefore = arena.totalDoubRaised();
        uint256 arenaBalBefore = doub.balanceOf(address(arena));
        vm.prank(alice);
        arena.warbowActivateGuard();
        assertEq(doub.balanceOf(address(vaults)), vaultBefore + arena.WARBOW_GUARD_DOUB());
        assertEq(doub.balanceOf(address(arena)), arenaBalBefore);
        assertEq(arena.totalDoubRaised(), raisedBefore + arena.WARBOW_GUARD_DOUB());
        assertGt(arena.warbowGuardUntil(alice), block.timestamp);
    }

    /// GitLab #252: revenge pulls 1000 DOUB.
    function test_warbow_revenge_pulls_doub() public {
        _seedWarbowStealBand(bob, alice);
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        uint256 raisedBefore = arena.totalDoubRaised();
        uint256 arenaBalBefore = doub.balanceOf(address(arena));
        vm.prank(bob);
        arena.warbowRevenge(alice);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore + arena.WARBOW_REVENGE_DOUB());
        assertEq(doub.balanceOf(address(arena)), arenaBalBefore);
        assertEq(arena.totalDoubRaised(), raisedBefore + arena.WARBOW_REVENGE_DOUB());
    }

    /// GitLab #252: fourth steal on same victim in a UTC day pulls steal + 50_000 DOUB override.
    function test_warbow_steal_limit_override_pulls_doub() public {
        _seedWarbowStealBand(bob, alice);
        for (uint256 i; i < 3; ++i) {
            vm.prank(alice);
            arena.warbowSteal(bob, false);
            _boostWarbowVictim(bob);
        }
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        uint256 raisedBefore = arena.totalDoubRaised();
        uint256 arenaBalBefore = doub.balanceOf(address(arena));
        uint256 expected = arena.WARBOW_STEAL_DOUB() + arena.WARBOW_STEAL_LIMIT_BYPASS_DOUB();
        vm.prank(alice);
        arena.warbowSteal(bob, true);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore + expected);
        assertEq(doub.balanceOf(address(arena)), arenaBalBefore);
        assertEq(arena.totalDoubRaised(), raisedBefore + expected);
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

    /// GitLab #310: streak-break BP when a different buyer buys under the defended-streak window.
    function test_warbow_streak_break_bp() public {
        _ensureLevel(alice, 4);
        _ensureLevel(bob, 4);
        for (uint256 i; i < 3; ++i) {
            _warpNearHardReset();
            _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(1e18);
        }
        assertEq(arena.activeDefendedStreak(alice), 3);

        _warpRemaining(_below[0] + 30);
        uint256 bpBefore = arena.battlePoints(bob);
        vm.prank(bob);
        arena.buy(1e18);
        uint256 expected =
            arena.WARBOW_BASE_BUY_BP() + 3 * arena.WARBOW_STREAK_BREAK_MULT_BP();
        assertEq(arena.battlePoints(bob) - bpBefore, expected);
    }

    /// GitLab #310: ambush bonus stacks on hard reset + streak break under window.
    function test_warbow_ambush_bp_on_hard_reset_streak_break() public {
        _ensureLevel(alice, 4);
        _ensureLevel(bob, 4);
        _warpUnderDefendedStreakWindowNoHardReset();
        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        _warpUnderDefendedStreakWindowNoHardReset();
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.activeDefendedStreak(alice), 2);

        _warpNearHardReset();
        uint256 bpBefore = arena.battlePoints(bob);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(1e18);
        uint256 expected = arena.WARBOW_BASE_BUY_BP() + arena.WARBOW_TIMER_RESET_BONUS_BP()
            + 2 * arena.WARBOW_STREAK_BREAK_MULT_BP() + arena.WARBOW_AMBUSH_BONUS_BP();
        assertEq(arena.battlePoints(bob) - bpBefore, expected);
    }

    /// GitLab #310: WarBow steal routes 100% DOUB to podium vaults like buy.
    function test_warbow_steal_routes_doub_split() public {
        _seedWarbowStealBand(bob, alice);
        uint256 vaultBefore = doub.balanceOf(address(vaults));
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore + arena.WARBOW_STEAL_DOUB());
        assertEq(doub.balanceOf(address(arena)), 0);
    }

    function _warpUnderDefendedStreakWindow() internal {
        _warpRemaining(_below[0] + 30);
    }

    /// Remaining in (hard-reset band, defended-streak window) — streak window without timer snap.
    function _warpUnderDefendedStreakWindowNoHardReset() internal {
        _warpRemaining(_below[0] + 30);
    }

    function _warpRemaining(uint256 target) internal {
        uint256 dl = arena.deadline();
        uint256 remaining = dl > block.timestamp ? dl - block.timestamp : 0;
        require(target < arena.DEFENDED_STREAK_WINDOW_SEC(), "bad timer config");
        if (remaining > target) {
            vm.warp(block.timestamp + remaining - target);
        }
        _freezeCharmPrice();
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

    /// GitLab #312: WarBow roll auto-pays on-chain top-3; admin finalize superseded.
    function test_warbow_roll_auto_pays_onchain_winners() public {
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

        uint256 firstBefore = doub.balanceOf(winners[0]);
        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);

        assertEq(arena.podiumEpoch(cat), 1);
        assertTrue(doub.balanceOf(winners[0]) > firstBefore);
        assertTrue(arena.warbowEpochFinalized(0));
        vm.expectRevert("TimeArena: superseded");
        arena.finalizeWarbowPodium(0, winners[0], winners[1], winners[2]);
    }

    /// GitLab #312: buy succeeds after Last Buy deadline via autoroll.
    function test_buy_autorolls_after_last_buy_deadline() public {
        vm.prank(alice);
        arena.buy(1e18);
        vm.warp(arena.deadline() + 1);
        uint256 epochBefore = arena.podiumEpoch(arena.CAT_LAST_BUYERS());
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumEpoch(arena.CAT_LAST_BUYERS()), epochBefore + 1);
        assertGt(arena.deadline(), block.timestamp);
    }

    /// GitLab #312: WarBow steal succeeds after Last Buy deadline via autoroll.
    function test_warbow_steal_autorolls_after_last_buy_deadline() public {
        _seedWarbowStealBand(bob, alice);
        vm.warp(arena.deadline() + 1);
        uint256 epochBefore = arena.podiumEpoch(arena.CAT_LAST_BUYERS());
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        assertEq(arena.podiumEpoch(arena.CAT_LAST_BUYERS()), epochBefore + 1);
    }

    /// GitLab #312: on-chain top-3 matches brute-force for synthetic players.
    function test_warbow_ranking_matches_brute_force() public {
        uint256 n = 20;
        for (uint256 i; i < n; ++i) {
            address p = address(uint160(0x2000 + i));
            doub.mint(p, 1_000_000e18);
            vm.prank(p);
            doub.approve(address(arena), type(uint256).max);
            _ensureLevel(p, 4);
            if (i > 0) _warpPastBuyCooldown();
            uint256 charm = CHARM_MIN + ((i * 31) % (CHARM_MAX - CHARM_MIN));
            vm.prank(p);
            arena.buy(charm);
        }

        (address[3] memory onchain,) = arena.podium(arena.CAT_WARBOW());
        (address first, address second, address third) = _bruteForceWarbowTop3(n);
        assertEq(onchain[0], first);
        assertEq(onchain[1], second);
        assertEq(onchain[2], third);
    }

    function _bruteForceWarbowTop3(uint256 n) internal view returns (address first, address second, address third) {
        address best1;
        address best2;
        address best3;
        uint256 v1;
        uint256 v2;
        uint256 v3;
        for (uint256 i; i < n; ++i) {
            address p = address(uint160(0x2000 + i));
            uint256 v = arena.battlePoints(p);
            if (v == 0) continue;
            if (v > v1 || (v == v1 && uint160(p) < uint160(best1))) {
                best3 = best2;
                v3 = v2;
                best2 = best1;
                v2 = v1;
                best1 = p;
                v1 = v;
            } else if (v > v2 || (v == v2 && uint160(p) < uint160(best2))) {
                best3 = best2;
                v3 = v2;
                best2 = p;
                v2 = v;
            } else if (v > v3 || (v == v3 && uint160(p) < uint160(best3))) {
                best3 = p;
                v3 = v;
            }
        }
        return (best1, best2, best3);
    }

    /// Security: displaced podium entrant must be re-evaluated (stale third-place).
    function test_warbow_top_three_reinserts_displaced_entrant() public {
        address charlie = address(0xC0FFEE);
        address david = address(0xDA11);
        for (uint256 i; i < 2; ++i) {
            address p = i == 0 ? charlie : david;
            doub.mint(p, 1_000_000e18);
            vm.prank(p);
            doub.approve(address(arena), type(uint256).max);
        }

        _ensureLevel(alice, 4);
        for (uint256 i; i < 5; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(CHARM_MAX);
        }

        _warpPastBuyCooldown();
        _ensureLevel(bob, 4);
        vm.prank(bob);
        arena.buy(CHARM_MAX);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(CHARM_MAX);

        _warpPastBuyCooldown();
        _ensureLevel(charlie, 4);
        vm.prank(charlie);
        arena.buy(CHARM_MAX);

        _warpPastBuyCooldown();
        _ensureLevel(david, 4);
        for (uint256 i; i < 3; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(david);
            arena.buy(CHARM_MAX);
        }

        assertGt(arena.battlePoints(alice), arena.battlePoints(david));
        assertGt(arena.battlePoints(david), arena.battlePoints(bob));
        assertGt(arena.battlePoints(bob), arena.battlePoints(charlie));

        (address[3] memory winners,) = arena.podium(arena.CAT_WARBOW());
        assertEq(winners[0], alice);
        assertEq(winners[1], david);
        assertEq(winners[2], bob);
    }

    /// Security: BP drain must promote off-podium challengers (stale slot after in-place decrease).
    function test_warbow_podium_promotes_challenger_after_bp_decrease() public {
        address charlie = address(0xE0E0);
        address eve = address(0xC0FFEE);
        address stealer = address(0x57EA1);
        for (uint256 i; i < 3; ++i) {
            address p = i == 0 ? charlie : (i == 1 ? eve : stealer);
            doub.mint(p, 1_000_000e18);
            vm.prank(p);
            doub.approve(address(arena), type(uint256).max);
        }

        _ensureLevel(alice, 4);
        for (uint256 i; i < 5; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(bob, 4);
        for (uint256 i; i < 4; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(bob);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(charlie, 4);
        for (uint256 i; i < 3; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(charlie);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(eve, 4);
        for (uint256 i; i < 3; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(eve);
            arena.buy(CHARM_MIN);
        }

        assertEq(arena.battlePoints(charlie), arena.battlePoints(eve));
        assertGt(uint160(eve), uint160(charlie), "eve loses tie-break to charlie");

        (address[3] memory beforeSteal,) = arena.podium(arena.CAT_WARBOW());
        assertEq(beforeSteal[2], charlie, "charlie on podium before steal");
        assertTrue(beforeSteal[0] != eve && beforeSteal[1] != eve, "eve off podium before steal");

        _ensureLevel(stealer, 4);
        _warpPastBuyCooldown();
        vm.prank(stealer);
        arena.buy(CHARM_MIN);

        uint256 charlieBp = arena.battlePoints(charlie);
        uint256 stealerBp = arena.battlePoints(stealer);
        assertGe(charlieBp, 2 * stealerBp, "steal band lower");
        assertLe(charlieBp, 10 * stealerBp, "steal band upper");

        _warpPastBuyCooldown();
        vm.prank(stealer);
        arena.warbowSteal(charlie, false);

        assertLt(arena.battlePoints(charlie), arena.battlePoints(eve));
        (address[3] memory afterSteal,) = arena.podium(arena.CAT_WARBOW());
        assertEq(afterSteal[2], eve, "eve promoted after charlie BP drain");
    }

    /// Security: equal-BP off-podium challenger with better tie-break must reach global top-3.
    function test_warbow_off_podium_tie_break_promotes_to_global() public {
        address carol = address(0x300);
        address d = address(0xD001);
        address e = address(0xE001);
        address f = address(0xF001);
        address greg = address(0x100);
        address[5] memory extras = [carol, d, e, f, greg];
        for (uint256 i; i < extras.length; ++i) {
            doub.mint(extras[i], 1_000_000e18);
            vm.prank(extras[i]);
            doub.approve(address(arena), type(uint256).max);
        }

        _ensureLevel(alice, 4);
        for (uint256 i; i < 5; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(bob, 4);
        for (uint256 i; i < 4; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(bob);
            arena.buy(CHARM_MIN);
        }

        _reachLevel4OneWarbowBuy(carol);
        _reachLevel4OneWarbowBuy(d);
        _reachLevel4OneWarbowBuy(e);
        _reachLevel4OneWarbowBuy(f);

        uint256 sharedBp = arena.battlePoints(carol);
        assertEq(arena.battlePoints(d), sharedBp);
        assertEq(arena.battlePoints(e), sharedBp);
        assertEq(arena.battlePoints(f), sharedBp);
        assertGt(uint160(carol), uint160(greg), "greg wins tie-break over carol");

        (address[3] memory before,) = arena.podium(arena.CAT_WARBOW());
        assertEq(before[2], carol, "carol on global podium before greg");
        assertEq(arena.battlePoints(greg), 0, "greg untracked before first WarBow buy");

        _reachLevel4OneWarbowBuy(greg);

        assertEq(arena.battlePoints(greg), sharedBp);
        (address[3] memory afterBuy,) = arena.podium(arena.CAT_WARBOW());
        assertEq(afterBuy[2], greg, "greg promoted via off-podium tie-break merge");
    }

    /// WarBow ≤6 tracking: a buy with BP above the worst podium slot must enter the merge set.
    function test_warbow_higher_bp_buy_enters_podium() public {
        address carol = address(0xC0FFEE);
        address david = address(0xDA11);
        doub.mint(carol, 1_000_000e18);
        doub.mint(david, 1_000_000e18);
        vm.prank(carol);
        doub.approve(address(arena), type(uint256).max);
        vm.prank(david);
        doub.approve(address(arena), type(uint256).max);

        _ensureLevel(alice, 4);
        for (uint256 i; i < 5; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(bob, 4);
        for (uint256 i; i < 4; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(bob);
            arena.buy(CHARM_MIN);
        }

        _warpPastBuyCooldown();
        _ensureLevel(carol, 4);
        vm.prank(carol);
        arena.buy(CHARM_MIN);

        uint256 carolBp = arena.battlePoints(carol);
        (address[3] memory before,) = arena.podium(arena.CAT_WARBOW());
        assertEq(before[2], carol);

        _warpPastBuyCooldown();
        _ensureLevel(david, 4);
        for (uint256 i; i < 2; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(david);
            arena.buy(CHARM_MIN);
        }

        assertGt(arena.battlePoints(david), carolBp);
        (address[3] memory afterBuy,) = arena.podium(arena.CAT_WARBOW());
        assertTrue(
            afterBuy[0] == david || afterBuy[1] == david || afterBuy[2] == david,
            "higher-BP buy must land on podium"
        );
    }

    /// GitLab #312: equal BP tie-break favors lower address.
    function test_warbow_tie_break_lower_address_wins() public {
        address low = address(0x100);
        address high = address(0x200);
        for (uint256 i; i < 2; ++i) {
            address p = i == 0 ? low : high;
            doub.mint(p, 1_000_000e18);
            vm.prank(p);
            doub.approve(address(arena), type(uint256).max);
            _ensureLevel(p, 4);
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(p);
            arena.buy(CHARM_MIN);
        }
        (address[3] memory winners, uint256[3] memory values) = arena.podium(arena.CAT_WARBOW());
        assertEq(values[0], values[1]);
        assertEq(winners[0], low);
        assertEq(winners[1], high);
    }

    /// GitLab #312: autoroll cannot double-pay within one buy tx.
    function test_autoroll_no_double_payout_same_tx() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        arena.buy(10e18);
        uint8 cat = arena.CAT_WARBOW();
        (address[3] memory winners,) = arena.podium(cat);
        uint256 firstBefore = doub.balanceOf(winners[0]);
        uint256 poolBal = vaults.activePoolBalance(cat);
        assertGt(poolBal, 0);

        vm.warp(arena.podiumDeadline(cat) + 1);
        vm.prank(alice);
        arena.warbowActivateGuard();

        assertTrue(arena.warbowEpochFinalized(0));
        assertGt(doub.balanceOf(winners[0]), firstBefore, "single autoroll payout");
        vm.expectRevert("TimeArena: timer not armed");
        arena.rollPodiumEpoch(cat);
    }

    /// Security: multi-expired autoroll must pay each category's active tranche, not the commingled vault.
    function test_autoroll_multi_expired_pays_each_category_tranche() public {
        address carol = address(0xCA801);
        address dave = address(0xDA11);
        address eve = address(0xE0E0);
        for (uint256 i; i < 3; ++i) {
            address p = i == 0 ? carol : (i == 1 ? dave : eve);
            doub.mint(p, 1_000_000e18);
            vm.prank(p);
            doub.approve(address(arena), type(uint256).max);
        }

        for (uint256 i; i < 5; ++i) {
            if (i > 0) _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(10e18);
        }

        _warpPastBuyCooldown();
        vm.prank(carol);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(dave);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(eve);
        arena.buy(1e18);

        uint8 lastBuy = arena.CAT_LAST_BUYERS();
        uint8 warbow = arena.CAT_WARBOW();
        (address[3] memory lbWinners,) = arena.podium(lastBuy);
        (address[3] memory wbWinners,) = arena.podium(warbow);
        assertEq(lbWinners[0], eve);
        assertEq(wbWinners[0], alice);

        assertGt(vaults.activePoolBalance(lastBuy), 0);
        assertGt(vaults.activePoolBalance(warbow), 0);

        uint256 eveBefore = doub.balanceOf(eve);
        uint256 warbowFirstBefore = doub.balanceOf(wbWinners[0]);
        uint256 vaultBefore = doub.balanceOf(address(vaults));

        uint256 maxDeadline = arena.podiumDeadline(lastBuy);
        for (uint8 c = 0; c < arena.NUM_PODIUM_CATEGORIES(); ++c) {
            uint256 d = arena.podiumDeadline(c);
            if (d > maxDeadline) maxDeadline = d;
        }
        vm.warp(maxDeadline + 1);

        vm.prank(eve);
        arena.buy(1e18);

        assertTrue(arena.warbowEpochFinalized(0));
        uint256 warbowGain = doub.balanceOf(wbWinners[0]) - warbowFirstBefore;
        uint256 eveGain = doub.balanceOf(eve) - eveBefore;
        assertGt(warbowGain, 0, "WarBow #1 paid from WarBow tranche");
        assertGt(eveGain, 0, "Last Buy #1 paid from Last Buy tranche");
        assertLt(eveGain, (vaultBefore * 4) / 7, "Last Buy did not capture 4/7 of entire vault");
        assertGt(warbowGain + eveGain, 0, "both categories received payout");
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
        vm.prank(alice);
        arena.topUpPodiumPools(700e18);
        assertEq(doub.balanceOf(address(vaults)), 700e18);
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
        vm.prank(bob);
        doub.approve(address(arena), 0);
        vm.prank(bob);
        vm.expectRevert();
        arena.topUpPodiumPools(1e18);
        assertEq(doub.balanceOf(address(vaults)), vaultBefore);
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
        assertEq(doub.balanceOf(address(_vaultsFor(topUpArena))), 700e18);
    }

    function test_topUpPodiumPools_1000_routes_all_to_vaults() public {
        vm.prank(alice);
        arena.topUpPodiumPools(1000e18);
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
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, v, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, 5, 15, admin)
        );
        a = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(a));
        a.startArena();
        vm.prank(alice);
        doub.approve(address(a), type(uint256).max);
    }

    function _vaultsFor(TimeArena a) internal view returns (PodiumVaults) {
        return PodiumVaults(a.podiumVaults());
    }

    /// @dev Fresh arena + ReferralRegistry for GitLab #253 referral CRED tests.
    function _arenaWithReferrals()
        internal
        returns (TimeArena ar, ReferralRegistry reg)
    {
        reg = UUPSDeployLib.deployReferralRegistry(admin);
        PodiumVaults v = new PodiumVaults(doub, admin);
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (
                doub,
                v,
                address(reg),
                address(cred),
                1000e18,
                _ext,
                _init,
                _cap,
                _below,
                _to,
                300,
                5,
                15,
                admin
            )
        );
        ar = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(ar));
        reg.setTimeArena(address(ar));
        cred.grantRole(cred.MINTER_ROLE(), address(ar));
        ar.startArena();
    }

    /// GitLab #253 / #272: referred buy mints flat Play CRED per side, not CHARM weight.
    function test_referred_buy_mints_cred_not_charm() public {
        (TimeArena ar, ReferralRegistry reg) = _arenaWithReferrals();
        address referrer = makeAddr("referrer");
        address buyer = makeAddr("buyer");

        doub.mint(referrer, 10_000e18);
        vm.startPrank(referrer);
        doub.approve(address(reg), type(uint256).max);
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
        (TimeArena ar, ReferralRegistry reg) = _arenaWithReferrals();
        address referrer = makeAddr("selfref");

        doub.mint(referrer, 1_000_000e18);
        vm.startPrank(referrer);
        doub.approve(address(reg), type(uint256).max);
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
        uint256 t0 = block.timestamp;
        vm.prank(alice);
        arena.buy(1e18);
        assertEq(arena.podiumDeadline(0), t0 + _init[0] + _ext[0]);
        assertFalse(arena.podiumTimerArmed(1));
        assertEq(arena.podiumDeadline(1), 0);
        assertFalse(arena.podiumTimerArmed(2));
        assertEq(arena.podiumDeadline(2), 0);
        assertFalse(arena.podiumTimerArmed(3));
        assertEq(arena.podiumDeadline(3), 0);
    }

    /// GitLab #299: level-2 unlocks Time Booster timer only among secondary podiums.
    function test_level_2_gates_timers() public {
        address player = makeAddr("lvl2gate");
        doub.mint(player, 1_000_000e18);
        vm.prank(player);
        doub.approve(address(arena), type(uint256).max);
        _ensureLevel(player, 2);
        assertTrue(arena.podiumTimerArmed(0));
        assertTrue(arena.podiumTimerArmed(1));
        assertFalse(arena.podiumTimerArmed(2));
        assertEq(arena.podiumDeadline(2), 0);
        assertFalse(arena.podiumTimerArmed(3));
        assertEq(arena.podiumDeadline(3), 0);
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

    // --- GitLab #316: pause matrix (blocks all user-facing mutating paths via `_requireLive`) ---

    /// Prevents buys while ops pause is active (front-run / incident response).
    function test_pause_blocks_buy() public {
        arena.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: paused");
        arena.buy(1e18);
    }

    function test_pause_blocks_buyWithCred() public {
        arena.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: paused");
        arena.buyWithCred(1e18);
    }

    function test_pause_blocks_warbow_steal() public {
        _seedWarbowStealBand(bob, alice);
        arena.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: paused");
        arena.warbowSteal(bob, false);
    }

    function test_pause_blocks_warbow_guard() public {
        _ensureLevel(alice, 4);
        arena.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: paused");
        arena.warbowActivateGuard();
    }

    function test_pause_blocks_warbow_revenge() public {
        _seedWarbowStealBand(bob, alice);
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        arena.setPaused(true);
        vm.prank(bob);
        vm.expectRevert("TimeArena: paused");
        arena.warbowRevenge(alice);
    }

    function test_pause_blocks_claimWarBowFlag() public {
        _ensureLevel(alice, 5);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(alice, 1e18, bytes32(0), true);
        vm.warp(block.timestamp + arena.WARBOW_FLAG_SILENCE_SEC());
        arena.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: paused");
        arena.claimWarBowFlag();
    }

    // --- GitLab #316: WarBow revert matrix ---

    /// Prevents stealing outside the 2×–10× BP band (whale griefing low-BP wallets).
    function test_warbow_steal_reverts_steal_band() public {
        _ensureLevel(alice, 4);
        _boostWarbowVictim(alice);
        _ensureLevel(bob, 4);
        vm.prank(bob);
        arena.buy(1e18);
        vm.prank(alice);
        vm.expectRevert("TimeArena: steal band");
        arena.warbowSteal(bob, false);
    }

    /// Prevents bypassing the daily steal cap without paying the override burn.
    function test_warbow_steal_reverts_steal_limit() public {
        _seedWarbowStealBand(bob, alice);
        for (uint256 i; i < 3; ++i) {
            vm.prank(alice);
            arena.warbowSteal(bob, false);
            _boostWarbowVictim(bob);
        }
        vm.prank(alice);
        vm.expectRevert("TimeArena: steal limit");
        arena.warbowSteal(bob, false);
    }

    /// Prevents revenge after the 24h window (stale grudge txs).
    function test_warbow_revenge_reverts_expired() public {
        _seedWarbowStealBand(bob, alice);
        vm.prank(alice);
        arena.warbowSteal(bob, false);
        uint256 exp = block.timestamp + arena.WARBOW_REVENGE_WINDOW_SEC();
        while (arena.deadline() < exp + 1) {
            _warpPastBuyCooldown();
            vm.prank(alice);
            arena.buy(1e18);
        }
        vm.warp(exp + 1);
        vm.prank(bob);
        vm.expectRevert("TimeArena: revenge");
        arena.warbowRevenge(alice);
    }

    function test_warbow_revenge_reverts_no_pending() public {
        _ensureLevel(alice, 4);
        _ensureLevel(bob, 4);
        vm.prank(bob);
        vm.expectRevert("TimeArena: revenge");
        arena.warbowRevenge(alice);
    }

    /// Prevents non-holders from claiming planted flags.
    function test_warbow_flag_reverts_not_holder() public {
        _ensureLevel(alice, 5);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(alice, 1e18, bytes32(0), true);
        vm.warp(block.timestamp + arena.WARBOW_FLAG_SILENCE_SEC());
        vm.prank(bob);
        vm.expectRevert("TimeArena: not flag holder");
        arena.claimWarBowFlag();
    }

    /// Prevents early flag claims before the silence period.
    function test_warbow_flag_reverts_silence() public {
        _ensureLevel(alice, 5);
        arena.setTimeArenaBuyRouter(address(this));
        doub.mint(address(this), 10_000e18);
        doub.approve(address(arena), type(uint256).max);
        arena.buyFor(alice, 1e18, bytes32(0), true);
        vm.prank(alice);
        vm.expectRevert("TimeArena: flag silence");
        arena.claimWarBowFlag();
    }

    /// GitLab #312: admin finalizeWarbowPodium superseded after on-chain roll payout.
    function test_finalize_warbow_podium_reverts_double() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        arena.buy(10e18);
        uint8 cat = arena.CAT_WARBOW();
        vm.warp(arena.podiumDeadline(cat) + 1);
        arena.rollPodiumEpoch(cat);
        (address[3] memory winners,) = arena.podium(cat);
        vm.expectRevert("TimeArena: superseded");
        arena.finalizeWarbowPodium(0, winners[0], winners[1], winners[2]);
    }

    function test_finalize_warbow_podium_reverts_bad_epoch() public {
        vm.expectRevert("TimeArena: superseded");
        arena.finalizeWarbowPodium(99, alice, bob, address(0));
    }

    function test_warbow_steal_reverts_bad_victim_zero() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        vm.expectRevert("TimeArena: bad victim");
        arena.warbowSteal(address(0), false);
    }

    function test_warbow_steal_reverts_bad_victim_self() public {
        _ensureLevel(alice, 4);
        vm.prank(alice);
        vm.expectRevert("TimeArena: bad victim");
        arena.warbowSteal(alice, false);
    }

    function test_ownable2step_transfer_requires_accept() public {
        address newOwner = makeAddr("newOwner");
        arena.transferOwnership(newOwner);
        assertEq(arena.owner(), admin);
        assertEq(arena.pendingOwner(), newOwner);

        vm.prank(newOwner);
        arena.acceptOwnership();
        assertEq(arena.owner(), newOwner);
        assertEq(arena.pendingOwner(), address(0));
    }

    function test_ownable2step_pending_owner_cannot_upgrade() public {
        address pending = makeAddr("pending");
        arena.transferOwnership(pending);
        TimeArena impl2 = new TimeArena();
        vm.prank(pending);
        vm.expectRevert();
        arena.upgradeToAndCall(address(impl2), "");
    }

    function test_uups_upgrade_blocked_for_non_owner() public {
        TimeArena impl2 = new TimeArena();
        vm.prank(alice);
        vm.expectRevert();
        arena.upgradeToAndCall(address(impl2), "");
    }
}
