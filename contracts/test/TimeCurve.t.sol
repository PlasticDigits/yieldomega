// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

// Invariant ↔ test mapping: docs/testing/invariants-and-business-logic.md (TimeCurve section)

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TimeCurveTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant GROWTH_RATE = 182_321_556_793_954_592; // ln(1.2) WAD
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    MockERC20 reserve;
    MockERC20 launchedToken;
    FeeRouter router;
    PodiumPool podiumPool;
    LinearCharmPrice linearPrice;
    TimeCurve tc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    // FeeRouter sinks: LP 25% · CL8Y 35% · podium 20% · team 0% · Rabbit 20% (bps)
    address sinkLp = makeAddr("sinkLp");
    address sinkCl8y = makeAddr("sinkCl8y");
    address sinkTeam = makeAddr("sinkTeam");
    address sinkRabbit = makeAddr("sinkRabbit");

    function setUp() public {
        reserve = new MockERC20("CL8Y", "CL8Y");
        launchedToken = new MockERC20("LaunchToken", "LT");

        podiumPool = new PodiumPool(address(this));

        router = new FeeRouter(
            address(this),
            [sinkLp, sinkCl8y, address(podiumPool), sinkTeam, sinkRabbit],
            [uint16(2500), uint16(3500), uint16(2000), uint16(0), uint16(2000)]
        );

        linearPrice = new LinearCharmPrice(1e18, 0); // flat 1:1 asset wei per 1e18 CHARM for tests
        tc = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18, // charm envelope reference WAD
            GROWTH_RATE,
            120, // timerExtensionSec (2 min; canonical deploy)
            ONE_DAY, // initialTimerSec (24h)
            FOUR_DAYS, // timerCapSec (max 96h remaining)
            1_000_000e18 // totalTokensForSale
        );

        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));

        // Fund launched token pool
        launchedToken.mint(address(tc), 1_000_000e18);
    }

    function _fundAndApprove(address user, uint256 amount) internal {
        reserve.mint(user, amount);
        vm.prank(user);
        reserve.approve(address(tc), amount);
    }

    function _fundAndApproveCurve(address user, uint256 amount, TimeCurve target) internal {
        reserve.mint(user, amount);
        vm.prank(user);
        reserve.approve(address(target), amount);
    }

    /// @dev Small `initialTimerSec` so `warp(deadline - ε)` stays near sale start (CHARM envelope still cheap).
    function _newTimeCurveShortTimer(uint256 initialTimerSec) internal returns (TimeCurve) {
        require(initialTimerSec >= 120, "test: initial timer");
        TimeCurve t = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            initialTimerSec,
            FOUR_DAYS,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(t));
        launchedToken.mint(address(t), 1_000_000e18);
        return t;
    }

    // ── Sale lifecycle ─────────────────────────────────────────────────

    function test_startSale() public {
        tc.startSale();
        assertGt(tc.saleStart(), 0);
        assertGt(tc.deadline(), block.timestamp);
    }

    function test_startSale_reverts_twice() public {
        tc.startSale();
        vm.expectRevert("TimeCurve: already started");
        tc.startSale();
    }

    function test_startSale_insufficient_launched_tokens_reverts() public {
        TimeCurve tcUnder = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcUnder));
        launchedToken.mint(address(tcUnder), 1_000_000e18 - 1);
        vm.expectRevert("TimeCurve: insufficient launched tokens");
        tcUnder.startSale();
    }

    function test_endSale_not_started_reverts() public {
        vm.expectRevert("TimeCurve: not started");
        tc.endSale();
    }

    function test_endSale_already_ended_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();
        vm.expectRevert("TimeCurve: already ended");
        tc.endSale();
    }

    function test_buy_basic() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        assertEq(tc.charmWeight(alice), 1e18);
        assertEq(tc.totalCharmWeight(), 1e18);
        assertEq(tc.totalRaised(), 1e18);
    }

    function test_buy_below_minBuy_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 1e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: below min charms");
        tc.buy(0.5e18);
    }

    function test_buy_above_cap_reverts() public {
        tc.startSale();
        // Max CHARM at envelope start = 10e18 (flat 1:1 price → 10e18 asset cap)
        _fundAndApprove(alice, 20e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: above max charms");
        tc.buy(11e18);
    }

    function test_buy_after_timer_expires_reverts() public {
        tc.startSale();
        vm.warp(block.timestamp + ONE_DAY + 1);
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: timer expired");
        tc.buy(2e18);
    }

    function test_buy_not_started_reverts() public {
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: not started");
        tc.buy(1e18);
    }

    // ── Timer mechanics ────────────────────────────────────────────────

    function test_timer_extends_on_buy() public {
        tc.startSale();
        uint256 initialDeadline = tc.deadline();

        vm.warp(block.timestamp + 100);
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(2e18);

        assertGt(tc.deadline(), initialDeadline - 100 + 120);
    }

    /// @dev Invariant: deadline never exceeds block.timestamp + timerCapSec (extension cap; threat #2).
    function test_timer_cap_fuzz(uint16 numBuys) public {
        uint256 n = uint256(numBuys) % 20 + 1;
        tc.startSale();
        for (uint256 i; i < n; ++i) {
            vm.warp(block.timestamp + 10);
            (uint256 minCharm,) = tc.currentCharmBoundsWad();
            uint256 spend = tc.currentMinBuyAmount();
            _fundAndApprove(alice, spend);
            vm.prank(alice);
            tc.buy(minCharm);
            assertLe(tc.deadline(), block.timestamp + FOUR_DAYS, "deadline exceeds cap");
        }
    }

    /// @dev Initial sale window can be shorter than the per-buy remaining-time ceiling (e.g. 24h vs 96h).
    function test_timer_initial_can_be_lower_than_cap() public {
        uint256 fourDay = 4 * ONE_DAY;
        TimeCurve tcWide = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            fourDay,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcWide));
        launchedToken.mint(address(tcWide), 1_000_000e18);
        tcWide.startSale();
        assertEq(tcWide.deadline(), block.timestamp + ONE_DAY);

        _fundAndApproveCurve(alice, 2e18, tcWide);
        vm.prank(alice);
        tcWide.buy(1e18);
        assertLe(tcWide.deadline(), block.timestamp + fourDay);
        assertGt(tcWide.deadline(), block.timestamp + ONE_DAY);
    }

    function test_constructor_cap_below_initial_timer_reverts() public {
        vm.expectRevert("TimeCurve: cap < initial timer");
        new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            ONE_DAY - 1,
            1_000_000e18
        );
    }

    // ── Sale end and claims ────────────────────────────────────────────

    function test_endSale_and_claim() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(2e18);

        _fundAndApprove(bob, 5e18);
        vm.prank(bob);
        tc.buy(3e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();
        assertTrue(tc.ended());

        vm.prank(alice);
        tc.redeemCharms();
        // alice: 2/5 of 1M tokens = 400_000
        assertEq(launchedToken.balanceOf(alice), 400_000e18);

        vm.prank(bob);
        tc.redeemCharms();
        assertEq(launchedToken.balanceOf(bob), 600_000e18);
    }

    function test_redeemCharms_reverts_before_end() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);

        vm.prank(alice);
        vm.expectRevert("TimeCurve: not ended");
        tc.redeemCharms();
    }

    function test_double_redeem_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();

        vm.prank(alice);
        tc.redeemCharms();
        vm.prank(alice);
        vm.expectRevert("TimeCurve: already redeemed");
        tc.redeemCharms();
    }

    // ── Min buy growth ─────────────────────────────────────────────────

    function test_minBuy_grows_over_time() public {
        tc.startSale();
        uint256 mb0 = tc.currentMinBuyAmount();
        vm.warp(block.timestamp + ONE_DAY);
        uint256 mb1 = tc.currentMinBuyAmount();
        assertGt(mb1, mb0);
        // Envelope scales ~20%/day; min spend = minCharm × flat price (1:1 in test).
        assertApproxEqRel(mb1, (mb0 * 120) / 100, 1e14);
    }

    // ── Prize podiums ──────────────────────────────────────────────────

    function test_last_buyers_podium() public {
        tc.startSale();

        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);

        _fundAndApprove(bob, 5e18);
        vm.prank(bob);
        tc.buy(1e18);

        _fundAndApprove(carol, 5e18);
        vm.prank(carol);
        tc.buy(1e18);

        _fundAndApprove(dave, 5e18);
        vm.prank(dave);
        tc.buy(1e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        (address[3] memory winners,) = tc.podium(tc.CAT_LAST_BUYERS());
        assertEq(winners[0], dave);  // last buyer = 1st
        assertEq(winners[1], carol); // second to last = 2nd
        assertEq(winners[2], bob);   // third to last = 3rd
    }

    function test_warbow_ladder_podium_orders_by_battle_points() public {
        tc.startSale();

        for (uint256 i; i < 3; ++i) {
            _fundAndApprove(alice, 2e18);
            vm.prank(alice);
            tc.buy(1e18);
        }
        for (uint256 i; i < 2; ++i) {
            _fundAndApprove(bob, 2e18);
            vm.prank(bob);
            tc.buy(1e18);
        }
        _fundAndApprove(carol, 2e18);
        vm.prank(carol);
        tc.buy(1e18);

        uint256 base = tc.WARBOW_BASE_BUY_BP();
        assertEq(tc.battlePoints(alice), 3 * base);
        assertEq(tc.battlePoints(bob), 2 * base);
        assertEq(tc.battlePoints(carol), base);

        (address[3] memory winners, uint256[3] memory values) = tc.warbowLadderPodium();
        assertEq(winners[0], alice);
        assertEq(values[0], 3 * base);
        assertEq(winners[1], bob);
        assertEq(values[1], 2 * base);
        assertEq(winners[2], carol);
        assertEq(values[2], base);
    }

    function test_time_booster_tracks_effective_seconds_not_nominal_when_clipped() public {
        uint256 cap = 200;
        TimeCurve tcClip = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            cap,
            cap,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcClip));
        launchedToken.mint(address(tcClip), 1_000_000e18);
        tcClip.startSale();

        vm.warp(block.timestamp + 100);
        _fundAndApproveCurve(alice, 2e18, tcClip);
        vm.prank(alice);
        tcClip.buy(1e18);

        assertEq(tcClip.totalEffectiveTimerSecAdded(alice), 100);
        (address[3] memory w, uint256[3] memory v) = tcClip.podium(tcClip.CAT_TIME_BOOSTER());
        assertEq(w[0], alice);
        assertEq(v[0], 100);
    }

    function test_time_booster_zero_when_already_at_cap() public {
        uint256 cap = 200;
        TimeCurve tcCap = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            cap,
            cap,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcCap));
        launchedToken.mint(address(tcCap), 1_000_000e18);
        tcCap.startSale();

        _fundAndApproveCurve(alice, 2e18, tcCap);
        vm.prank(alice);
        tcCap.buy(1e18);

        assertEq(tcCap.totalEffectiveTimerSecAdded(alice), 0);
        (address[3] memory w, uint256[3] memory v) = tcCap.podium(tcCap.CAT_TIME_BOOSTER());
        assertEq(w[0], address(0));
        assertEq(v[0], 0);
    }

    function test_warbow_steal_drains_ten_percent_and_burns_one_reserve() public {
        tc.startSale();

        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);
        uint256 a0 = tc.battlePoints(alice);

        uint256 deadBefore = reserve.balanceOf(0x000000000000000000000000000000000000dEaD);
        _fundAndApprove(bob, 2e18 + tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(bob);
        tc.warbowSteal(alice, false);

        assertEq(tc.battlePoints(alice), a0 - (a0 * 1000) / 10_000);
        assertEq(tc.battlePoints(bob), (a0 * 1000) / 10_000);
        assertEq(reserve.balanceOf(0x000000000000000000000000000000000000dEaD) - deadBefore, tc.WARBOW_STEAL_BURN_WAD());
    }

    function test_warbow_steal_revert_2x_rule() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);
        _fundAndApprove(bob, 2e18);
        vm.prank(bob);
        tc.buy(1e18);
        _fundAndApprove(carol, 2e18);
        vm.prank(carol);
        tc.buy(1e18);
        _fundAndApprove(carol, tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(carol);
        vm.expectRevert("TimeCurve: steal 2x rule");
        tc.warbowSteal(bob, false);
    }

    function test_warbow_revenge_once() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);

        _fundAndApprove(bob, tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(bob);
        tc.warbowSteal(alice, false);
        uint256 bobBpAfterSteal = tc.battlePoints(bob);

        uint256 dead0 = reserve.balanceOf(0x000000000000000000000000000000000000dEaD);
        _fundAndApprove(alice, 2e18 + tc.WARBOW_REVENGE_BURN_WAD());
        vm.prank(alice);
        tc.warbowRevenge(bob);

        uint256 revTake = (bobBpAfterSteal * 1000) / 10_000;
        assertEq(tc.battlePoints(bob), bobBpAfterSteal - revTake);
        assertEq(
            reserve.balanceOf(0x000000000000000000000000000000000000dEaD) - dead0,
            tc.WARBOW_REVENGE_BURN_WAD()
        );
    }

    function test_warbow_guard_emits_cl8y_burned() public {
        tc.startSale();
        _fundAndApprove(alice, 100e18);
        vm.expectEmit(true, true, false, true);
        emit TimeCurve.WarBowCl8yBurned(
            alice, uint8(TimeCurve.WarBowBurnReason.Guard), tc.WARBOW_GUARD_BURN_WAD()
        );
        vm.prank(alice);
        tc.warbowActivateGuard();
    }

    /// @dev After a hard reset, remaining is exactly 15m; warp so remaining < 15m before the second qualifying buy.
    function test_defended_streak_same_wallet_two_resets_under_15m_window() public {
        TimeCurve t800 = _newTimeCurveShortTimer(800);
        t800.startSale();
        vm.warp(t800.saleStart() + 100);
        _fundAndApproveCurve(alice, 4e18, t800);
        vm.prank(alice);
        t800.buy(1e18);
        vm.warp(block.timestamp + 2);
        vm.prank(alice);
        t800.buy(1e18);

        assertEq(t800.activeDefendedStreak(alice), 2);
        assertEq(t800.bestDefendedStreak(alice), 2);
        (address[3] memory w, uint256[3] memory v) = t800.podium(t800.CAT_DEFENDED_STREAK());
        assertEq(w[0], alice);
        assertEq(v[0], 2);
    }

    /// @dev Second wallet buying inside the window clears the first wallet's **active** streak; best stays recorded.
    function test_defended_streak_second_player_under_window_ends_first_active() public {
        TimeCurve t800 = _newTimeCurveShortTimer(800);
        t800.startSale();
        vm.warp(t800.saleStart() + 100);
        _fundAndApproveCurve(alice, 2e18, t800);
        vm.prank(alice);
        t800.buy(1e18);
        assertEq(t800.activeDefendedStreak(alice), 1);

        vm.warp(block.timestamp + 2);
        _fundAndApproveCurve(bob, 2e18, t800);
        vm.prank(bob);
        t800.buy(1e18);

        assertEq(t800.activeDefendedStreak(alice), 0);
        assertEq(t800.bestDefendedStreak(alice), 1);
        assertEq(t800.activeDefendedStreak(bob), 1);
        assertEq(t800.bestDefendedStreak(bob), 1);
    }

    /// @dev Buys while at least 15 minutes remain do not increase defended streak.
    function test_defended_streak_no_increment_outside_15m_window() public {
        tc.startSale();
        _fundAndApprove(alice, 4e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.prank(alice);
        tc.buy(1e18);

        assertEq(tc.bestDefendedStreak(alice), 0);
        assertEq(tc.activeDefendedStreak(alice), 0);
    }

    /// @dev Buy with remaining ≥ window clears active streak holder; best unchanged.
    function test_defended_streak_leaving_window_clears_active() public {
        TimeCurve t800 = _newTimeCurveShortTimer(800);
        t800.startSale();
        vm.warp(t800.saleStart() + 100);
        _fundAndApproveCurve(alice, 4e18, t800);
        vm.prank(alice);
        t800.buy(1e18);
        vm.warp(block.timestamp + 2);
        vm.prank(alice);
        t800.buy(1e18);
        assertEq(t800.bestDefendedStreak(alice), 2);

        uint256 dl = t800.deadline();
        vm.warp(dl - 901);

        _fundAndApproveCurve(bob, 2e18, t800);
        vm.prank(bob);
        t800.buy(1e18);

        assertEq(t800.activeDefendedStreak(alice), 0);
        assertEq(t800.bestDefendedStreak(alice), 2);
    }

    // ── Last buy (compete to be the last person to buy) ─────────────────

    /// @dev With 5+ buys, podium keeps the three most recent buyers; values are 3,2,1 (ordering / ranking).
    function test_last_buy_three_most_recent_rank_values() public {
        address eve = makeAddr("eve");
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        _fundAndApprove(bob, 5e18);
        vm.prank(bob);
        tc.buy(1e18);
        _fundAndApprove(carol, 5e18);
        vm.prank(carol);
        tc.buy(1e18);
        _fundAndApprove(dave, 5e18);
        vm.prank(dave);
        tc.buy(1e18);
        _fundAndApprove(eve, 5e18);
        vm.prank(eve);
        tc.buy(1e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        (address[3] memory w, uint256[3] memory v) = tc.podium(tc.CAT_LAST_BUYERS());
        assertEq(w[0], eve, "1st = last person to buy");
        assertEq(w[1], dave);
        assertEq(w[2], carol);
        assertEq(v[0], 3);
        assertEq(v[1], 2);
        assertEq(v[2], 1);
    }

    /// @dev Last-buy 1st place receives reserve from `distributePrizes` (three-category settlement).
    function test_last_buy_distribute_prizes_pays_first_place() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        _fundAndApprove(bob, 5e18);
        vm.prank(bob);
        tc.buy(1e18);
        _fundAndApprove(carol, 5e18);
        vm.prank(carol);
        tc.buy(1e18);
        _fundAndApprove(dave, 5e18);
        vm.prank(dave);
        tc.buy(1e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        (address[3] memory w,) = tc.podium(tc.CAT_LAST_BUYERS());
        address winner = w[0];
        uint256 balBefore = reserve.balanceOf(winner);
        tc.distributePrizes();
        assertGt(reserve.balanceOf(winner), balBefore);
    }

    // ── Time booster (most actual time added) ───────────────────────────

    /// @dev `totalEffectiveTimerSecAdded` matches the sum of per-buy deadline deltas.
    function test_time_booster_score_matches_sum_of_deadline_deltas() public {
        tc.startSale();
        _fundAndApprove(alice, 20e18);
        uint256 d0 = tc.deadline();
        vm.prank(alice);
        tc.buy(1e18);
        uint256 d1 = tc.deadline();
        uint256 add1 = d1 - d0;
        vm.warp(block.timestamp + 50);
        uint256 dPre2 = tc.deadline();
        vm.prank(alice);
        tc.buy(1e18);
        uint256 d2 = tc.deadline();
        uint256 add2 = d2 - dPre2;
        assertEq(tc.totalEffectiveTimerSecAdded(alice), add1 + add2);
    }

    /// @dev Under-15m remaining: Time booster still credits **actual** `newDeadline - oldDeadline` only.
    function test_time_booster_under_15m_window_uses_actual_seconds_added() public {
        TimeCurve t800 = _newTimeCurveShortTimer(800);
        t800.startSale();
        vm.warp(t800.saleStart() + 100);
        uint256 beforeD = t800.deadline();
        _fundAndApproveCurve(alice, 4e18, t800);
        vm.prank(alice);
        t800.buy(1e18);
        uint256 afterD = t800.deadline();
        assertEq(t800.totalEffectiveTimerSecAdded(alice), afterD - beforeD);
    }

    /// @dev Leaderboard: higher total effective seconds ranks above lower.
    function test_time_booster_leaderboard_orders_by_total_effective_seconds() public {
        tc.startSale();
        _fundAndApprove(alice, 30e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(block.timestamp + 10);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(block.timestamp + 10);
        vm.prank(alice);
        tc.buy(1e18);

        _fundAndApprove(bob, 10e18);
        vm.prank(bob);
        tc.buy(1e18);

        (address[3] memory w, uint256[3] memory v) = tc.podium(tc.CAT_TIME_BOOSTER());
        assertEq(w[0], alice);
        assertEq(w[1], bob);
        assertGt(v[0], v[1]);
    }

    // ── WarBow Ladder (Battle Points on buy) ───────────────────────────

    /// @dev Min vs max CHARM in band at start: each qualifying buy adds base BP (no reset bonus on 24h clock).
    function test_warbow_base_bp_flat_per_buy_independent_of_charm_wad() public {
        tc.startSale();
        (uint256 minC, uint256 maxC) = tc.currentCharmBoundsWad();
        uint256 spendMin = tc.currentMinBuyAmount();
        uint256 spendMax = tc.currentMaxBuyAmount();
        uint256 b = tc.WARBOW_BASE_BUY_BP();
        _fundAndApprove(alice, spendMin + spendMax + 1e18);
        vm.prank(alice);
        tc.buy(minC);
        assertEq(tc.battlePoints(alice), b);
        vm.prank(alice);
        tc.buy(maxC);
        assertEq(tc.battlePoints(alice), 2 * b);
    }

    function test_warbow_steal_burn_is_one_cl8y_wad() public view {
        assertEq(tc.WARBOW_STEAL_BURN_WAD(), 1e18);
    }

    /// @dev Remaining < 13m triggers hard reset toward 15m; awards reset + ambush when breaking a 1-tick streak.
    function test_timer_hard_reset_below_13m_and_ambush_bonus() public {
        TimeCurve t800 = _newTimeCurveShortTimer(800);
        t800.startSale();
        vm.warp(t800.saleStart() + 100);
        _fundAndApproveCurve(alice, 2e18, t800);
        vm.prank(alice);
        t800.buy(1e18);
        // Remaining after reset is 15m; need <13m left before bob's buy for another hard reset + ambush.
        vm.warp(block.timestamp + 121);
        _fundAndApproveCurve(bob, 4e18, t800);
        vm.prank(bob);
        t800.buy(1e18);

        uint256 b = t800.WARBOW_BASE_BUY_BP();
        uint256 reset = t800.WARBOW_TIMER_RESET_BONUS_BP();
        uint256 amb = t800.WARBOW_AMBUSH_BONUS_BP();
        uint256 brk = t800.WARBOW_STREAK_BREAK_MULT_BP();
        assertEq(t800.battlePoints(bob), b + reset + brk + amb);
    }

    // ── Defended streak (under 15m; second player ends & records) ────────

    /// @dev Three defended increments: park `now` at `deadline - 700s` before buys 2–3 so remaining stays in (<13m, <15m) band.
    function test_defended_streak_same_wallet_three_resets_under_15m() public {
        TimeCurve t600 = _newTimeCurveShortTimer(600);
        t600.startSale();
        vm.warp(t600.saleStart() + 100);
        _fundAndApproveCurve(alice, 20e18, t600);
        vm.prank(alice);
        t600.buy(1e18);
        vm.warp(t600.deadline() - 700);
        vm.prank(alice);
        t600.buy(1e18);
        vm.warp(t600.deadline() - 700);
        vm.prank(alice);
        t600.buy(1e18);

        assertEq(t600.bestDefendedStreak(alice), 3);
        assertEq(t600.activeDefendedStreak(alice), 3);
    }

    /// @dev Podium uses **best** streak; after a rival ends your active run, your peak stays on the board.
    function test_defended_streak_podium_orders_by_best_streak() public {
        TimeCurve t600 = _newTimeCurveShortTimer(600);
        t600.startSale();
        vm.warp(t600.saleStart() + 100);
        _fundAndApproveCurve(alice, 20e18, t600);
        vm.prank(alice);
        t600.buy(1e18);
        vm.warp(t600.deadline() - 700);
        vm.prank(alice);
        t600.buy(1e18);
        vm.warp(t600.deadline() - 700);
        vm.prank(alice);
        t600.buy(1e18);

        vm.warp(t600.deadline() - 700);
        _fundAndApproveCurve(bob, 2e18, t600);
        vm.prank(bob);
        t600.buy(1e18);

        assertEq(t600.bestDefendedStreak(alice), 3);
        assertEq(t600.activeDefendedStreak(alice), 0);
        assertEq(t600.bestDefendedStreak(bob), 1);

        (address[3] memory w, uint256[3] memory v) = t600.podium(t600.CAT_DEFENDED_STREAK());
        assertEq(w[0], alice);
        assertEq(v[0], 3);
        assertEq(w[1], bob);
        assertEq(v[1], 1);
    }

    // ── Three-category round settlement (integration) ─────────────────

    function test_round_settlement_three_categories_podium_payouts_smoke() public {
        TimeCurve t = _newTimeCurveShortTimer(800);
        t.startSale();
        vm.warp(t.saleStart() + 100);

        _fundAndApproveCurve(alice, 80e18, t);
        vm.prank(alice);
        t.buy(1e18);
        vm.prank(alice);
        t.buy(1e18);

        _fundAndApproveCurve(bob, 80e18, t);
        vm.prank(bob);
        t.buy(1e18);

        vm.warp(block.timestamp + 30);
        _fundAndApproveCurve(carol, 80e18, t);
        vm.prank(carol);
        t.buy(2e18);

        _fundAndApproveCurve(dave, 80e18, t);
        vm.prank(dave);
        t.buy(1e18);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        t.buy(1e18);
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        t.buy(1e18);
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        t.buy(1e18);

        vm.warp(t.deadline() + 1);
        t.endSale();

        uint256 poolBefore = reserve.balanceOf(address(podiumPool));
        assertGt(poolBefore, 0);

        (address[3] memory lb,) = t.podium(t.CAT_LAST_BUYERS());
        uint256 lastWinnerBalBefore = reserve.balanceOf(lb[0]);

        t.distributePrizes();

        assertTrue(t.prizesDistributed());
        assertLt(reserve.balanceOf(address(podiumPool)), poolBefore);
        assertGt(reserve.balanceOf(lb[0]), lastWinnerBalBefore);
    }

    function test_fees_routed_on_buy() public {
        tc.startSale();
        _fundAndApprove(alice, 10e18);
        vm.prank(alice);
        tc.buy(10e18);

        assertEq(reserve.balanceOf(sinkLp), 2.5e18);
        assertEq(reserve.balanceOf(sinkCl8y), 3.5e18);
        assertEq(reserve.balanceOf(address(podiumPool)), 2e18);
        assertEq(reserve.balanceOf(sinkTeam), 0);
        assertEq(reserve.balanceOf(sinkRabbit), 2e18);
    }

    /// @dev Curve timing parameters are constructor immutables — no mid-sale governance drift (threat #3).
    function test_timeCurve_saleParams_immutable_across_sale() public {
        uint256 gr = tc.growthRateWad();
        uint256 ext = tc.timerExtensionSec();
        uint256 cap = tc.timerCapSec();
        uint256 initT = tc.initialTimerSec();
        uint256 initMin = tc.initialMinBuy();
        address cp = address(tc.charmPrice());

        tc.startSale();
        _fundAndApprove(alice, 3e18);
        vm.prank(alice);
        tc.buy(1e18);

        assertEq(tc.growthRateWad(), gr);
        assertEq(tc.timerExtensionSec(), ext);
        assertEq(tc.timerCapSec(), cap);
        assertEq(tc.initialTimerSec(), initT);
        assertEq(tc.initialMinBuy(), initMin);
        assertEq(address(tc.charmPrice()), cp);
    }

    /// @dev Sequential `vm.prank` buys in one test share `block.number` in Foundry; last-buyer podium
    ///      reflects **call order** (same as tx index ordering in a real block). See
    ///      `docs/onchain/security-and-threat-model.md` — TimeCurve threat #1.
    function test_sameBlock_buyOrder_lastBuyerReflectsSecondCall() public {
        uint256 bn = block.number;
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        _fundAndApprove(bob, 5e18);

        vm.prank(alice);
        tc.buy(1e18);
        assertEq(block.number, bn, "block changed mid-test");

        vm.prank(bob);
        tc.buy(1e18);
        assertEq(block.number, bn);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        (address[3] memory winners,) = tc.podium(tc.CAT_LAST_BUYERS());
        assertEq(winners[0], bob, "most recent last-buy slot should be second call");
    }

    // ── Ended state invariant ──────────────────────────────────────────

    function test_buy_after_end_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        _fundAndApprove(bob, 2e18);
        vm.prank(bob);
        vm.expectRevert("TimeCurve: ended");
        tc.buy(1e18);
    }

    // ── Constructor validation ─────────────────────────────────────────

    function test_constructor_zero_launchedToken_reverts() public {
        vm.expectRevert("TimeCurve: zero launched token");
        new TimeCurve(
            reserve,
            IERC20(address(0)),
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
    }

    function test_constructor_zero_podiumPool_reverts() public {
        vm.expectRevert("TimeCurve: zero podium pool");
        new TimeCurve(
            reserve,
            launchedToken,
            router,
            PodiumPool(address(0)),
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
    }

    function test_constructor_zero_acceptedAsset_reverts() public {
        vm.expectRevert("TimeCurve: zero asset");
        new TimeCurve(
            IERC20(address(0)),
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
    }

    function test_constructor_zero_feeRouter_reverts() public {
        vm.expectRevert("TimeCurve: zero router");
        new TimeCurve(
            reserve,
            launchedToken,
            FeeRouter(address(0)),
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
    }

    function test_constructor_zero_charmPrice_reverts() public {
        vm.expectRevert("TimeCurve: zero charm price");
        new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(0)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18
        );
    }

    /// @dev Integer division can round claim to 0 when `totalTokensForSale` is tiny vs `totalRaised`.
    function test_redeemCharms_nothing_to_redeem_reverts() public {
        TimeCurve tcSmall = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcSmall));
        launchedToken.mint(address(tcSmall), 1);
        tcSmall.startSale();
        _fundAndApproveCurve(alice, 10e18, tcSmall);
        _fundAndApproveCurve(bob, 10e18, tcSmall);
        vm.prank(alice);
        tcSmall.buy(1e18);
        vm.prank(bob);
        tcSmall.buy(1e18);
        vm.warp(tcSmall.deadline() + 1);
        tcSmall.endSale();
        vm.prank(alice);
        vm.expectRevert("TimeCurve: nothing to redeem");
        tcSmall.redeemCharms();
    }

    // ── Prize distribution (griefing / sad paths) ──────────────────────

    /// @dev Empty vault must not set `prizesDistributed` (otherwise a griefer could brick prizes forever).
    function test_distributePrizes_empty_vault_is_retryable() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();

        uint256 expectedPrize = reserve.balanceOf(address(podiumPool));
        assertGt(expectedPrize, 0);
        deal(address(reserve), address(podiumPool), 0);

        tc.distributePrizes();
        assertFalse(tc.prizesDistributed());

        deal(address(reserve), address(podiumPool), expectedPrize);
        tc.distributePrizes();
        assertTrue(tc.prizesDistributed());
    }

    /// @dev Tiny pool with no payable integer splits for filled podiums should stay retryable.
    function test_distributePrizes_dust_pool_is_retryable() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();

        deal(address(reserve), address(podiumPool), 0);
        tc.distributePrizes();
        assertFalse(tc.prizesDistributed());

        deal(address(reserve), address(podiumPool), 1_000_000e18);
        tc.distributePrizes();
        assertTrue(tc.prizesDistributed());
    }

    function test_distributePrizes_reduces_vault_and_sets_flag() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        _fundAndApprove(bob, 5e18);
        vm.prank(bob);
        tc.buy(1e18);
        _fundAndApprove(carol, 5e18);
        vm.prank(carol);
        tc.buy(1e18);
        _fundAndApprove(dave, 5e18);
        vm.prank(dave);
        tc.buy(1e18);

        vm.warp(tc.deadline() + 1);
        tc.endSale();

        uint256 vaultBefore = reserve.balanceOf(address(podiumPool));
        assertGt(vaultBefore, 0);
        tc.distributePrizes();
        assertTrue(tc.prizesDistributed());
        assertLt(reserve.balanceOf(address(podiumPool)), vaultBefore);
    }

    // ── CHARM band × exponential envelope vs linear price ─────────────────
    // See docs/testing/invariants-and-business-logic.md (TimeCurve invariants).

    /// @dev Min/max CHARM share one envelope factor; integer `mulDiv` floors ⇒ check ~10/0.99 within rounding slack.
    function test_charmBounds_ratio_10_over_099_fuzz(uint32 elapsedSec) public {
        tc.startSale();
        uint256 el = uint256(elapsedSec) % (30 * ONE_DAY);
        vm.warp(block.timestamp + el);
        (uint256 minC, uint256 maxC) = tc.currentCharmBoundsWad();
        assertGt(minC, 0);
        assertGt(maxC, minC);
        uint256 lhs = minC * 10e18;
        uint256 rhs = maxC * 99e16;
        uint256 diff = lhs > rhs ? lhs - rhs : rhs - lhs;
        assertLe(diff, maxC, "10*minCharm ~ 0.99*maxCharm after floor division");
    }

    /// @dev CHARM bounds scale ~20%/day with canonical `growthRateWad` (exponential envelope).
    function test_charmBounds_scale_approx_20_percent_per_day() public {
        tc.startSale();
        (uint256 min0, uint256 max0) = tc.currentCharmBoundsWad();
        vm.warp(block.timestamp + ONE_DAY);
        (uint256 min1, uint256 max1) = tc.currentCharmBoundsWad();
        assertApproxEqRel(min1, (min0 * 120) / 100, 1e14);
        assertApproxEqRel(max1, (max0 * 120) / 100, 1e14);
    }

    /// @dev Gross spend equals `charmWad * priceWad / WAD` for arbitrary valid CHARM in band (fuzz).
    function test_buy_charmWad_in_bounds_fuzz(uint128 charmRaw) public {
        tc.startSale();
        (uint256 minC, uint256 maxC) = tc.currentCharmBoundsWad();
        uint256 c = bound(uint256(charmRaw), minC, maxC);
        uint256 p = tc.currentPricePerCharmWad();
        uint256 spend = (c * p) / WAD;
        _fundAndApprove(alice, spend);
        vm.prank(alice);
        tc.buy(c);
        assertEq(tc.charmWeight(alice), c);
        assertEq(tc.totalRaised(), spend);
    }

    /// @dev Linear `ICharmPrice` schedule: +daily per second step; envelope flat (`growthRateWad = 0`).
    function test_linear_price_per_charm_independent_of_envelope() public {
        LinearCharmPrice lp = new LinearCharmPrice(1e18, 1e17);
        TimeCurve tcLin = new TimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(lp)),
            1e18,
            0,
            120,
            10 * ONE_DAY,
            10 * ONE_DAY,
            1_000_000e18
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tcLin));
        launchedToken.mint(address(tcLin), 1_000_000e18);
        tcLin.startSale();

        assertEq(tcLin.currentPricePerCharmWad(), 1e18);
        vm.warp(block.timestamp + ONE_DAY);
        assertEq(tcLin.currentPricePerCharmWad(), 1e18 + 1e17);

        (uint256 minC, uint256 maxC) = tcLin.currentCharmBoundsWad();
        assertEq(minC, 99e16);
        assertEq(maxC, 10e18);

        uint256 spend = (1e18 * tcLin.currentPricePerCharmWad()) / WAD;
        _fundAndApproveCurve(alice, spend, tcLin);
        vm.prank(alice);
        tcLin.buy(1e18);
        assertEq(tcLin.totalRaised(), spend);
    }
}

