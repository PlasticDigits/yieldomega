// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TimeCurveTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant GROWTH_RATE = 223_143_551_314_209_700; // ln(1.25) WAD
    uint256 internal constant ONE_DAY = 86_400;

    MockERC20 usdm;
    MockERC20 launchedToken;
    FeeRouter router;
    PrizeVault prizeVault;
    TimeCurve tc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    // Sink addresses (simple receivers)
    address sink0 = makeAddr("sink0");
    address sink1 = makeAddr("sink1");
    address sink2; // prize vault
    address sink3 = makeAddr("sink3");

    function setUp() public {
        usdm = new MockERC20("USDm", "USDM");
        launchedToken = new MockERC20("LaunchToken", "LT");

        prizeVault = new PrizeVault(address(this));
        sink2 = address(prizeVault);

        router = new FeeRouter(
            address(this),
            [sink0, sink1, sink2, sink3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );

        tc = new TimeCurve(
            usdm,
            launchedToken,
            router,
            prizeVault,
            1e18,            // initialMinBuy: 1 USDm
            GROWTH_RATE,
            10,              // purchaseCapMultiple
            60,              // timerExtensionSec
            ONE_DAY,         // timerCapSec
            1_000_000e18,    // totalTokensForSale
            3600,            // openingWindowSec
            3600             // closingWindowSec
        );

        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tc));

        // Fund launched token pool
        launchedToken.mint(address(tc), 1_000_000e18);
    }

    function _fundAndApprove(address user, uint256 amount) internal {
        usdm.mint(user, amount);
        vm.prank(user);
        usdm.approve(address(tc), amount);
    }

    function _fundAndApproveCurve(address user, uint256 amount, TimeCurve target) internal {
        usdm.mint(user, amount);
        vm.prank(user);
        usdm.approve(address(target), amount);
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
            usdm,
            launchedToken,
            router,
            prizeVault,
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tcUnder));
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
        assertEq(tc.userSpend(alice), 1e18);
        assertEq(tc.totalRaised(), 1e18);
    }

    function test_buy_below_minBuy_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 1e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: below min buy");
        tc.buy(0.5e18);
    }

    function test_buy_above_cap_reverts() public {
        tc.startSale();
        // Cap = 10 * minBuy = 10e18
        _fundAndApprove(alice, 20e18);
        vm.prank(alice);
        vm.expectRevert("TimeCurve: above cap");
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

        assertGt(tc.deadline(), initialDeadline - 100 + 60);
    }

    /// @dev Invariant: deadline never exceeds block.timestamp + timerCapSec.
    function test_timer_cap_fuzz(uint16 numBuys) public {
        uint256 n = uint256(numBuys) % 20 + 1;
        tc.startSale();
        for (uint256 i; i < n; ++i) {
            vm.warp(block.timestamp + 10);
            uint256 minBuy = tc.currentMinBuyAmount();
            _fundAndApprove(alice, minBuy);
            vm.prank(alice);
            tc.buy(minBuy);
            assertLe(tc.deadline(), block.timestamp + ONE_DAY, "deadline exceeds cap");
        }
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
        tc.claimAllocation();
        // alice: 2/5 of 1M tokens = 400_000
        assertEq(launchedToken.balanceOf(alice), 400_000e18);

        vm.prank(bob);
        tc.claimAllocation();
        assertEq(launchedToken.balanceOf(bob), 600_000e18);
    }

    function test_claimAllocation_reverts_before_end() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);

        vm.prank(alice);
        vm.expectRevert("TimeCurve: not ended");
        tc.claimAllocation();
    }

    function test_double_claim_reverts() public {
        tc.startSale();
        _fundAndApprove(alice, 2e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();

        vm.prank(alice);
        tc.claimAllocation();
        vm.prank(alice);
        vm.expectRevert("TimeCurve: already claimed");
        tc.claimAllocation();
    }

    // ── Min buy growth ─────────────────────────────────────────────────

    function test_minBuy_grows_over_time() public {
        tc.startSale();
        uint256 mb0 = tc.currentMinBuyAmount();
        vm.warp(block.timestamp + ONE_DAY);
        uint256 mb1 = tc.currentMinBuyAmount();
        assertGt(mb1, mb0);
        assertApproxEqRel(mb1, 1.25e18, 1e14); // ~25% growth after 1 day
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

    function test_most_buys_podium() public {
        tc.startSale();

        // Alice buys 3 times
        for (uint256 i; i < 3; ++i) {
            _fundAndApprove(alice, 2e18);
            vm.prank(alice);
            tc.buy(1e18);
        }
        // Bob buys 2 times
        for (uint256 i; i < 2; ++i) {
            _fundAndApprove(bob, 2e18);
            vm.prank(bob);
            tc.buy(1e18);
        }
        // Carol buys 1 time
        _fundAndApprove(carol, 2e18);
        vm.prank(carol);
        tc.buy(1e18);

        (address[3] memory winners, uint256[3] memory values) = tc.podium(tc.CAT_MOST_BUYS());
        assertEq(winners[0], alice);
        assertEq(values[0], 3);
        assertEq(winners[1], bob);
        assertEq(values[1], 2);
        assertEq(winners[2], carol);
        assertEq(values[2], 1);
    }

    function test_biggest_buy_podium() public {
        tc.startSale();

        _fundAndApprove(alice, 10e18);
        vm.prank(alice);
        tc.buy(5e18);

        _fundAndApprove(bob, 10e18);
        vm.prank(bob);
        tc.buy(3e18);

        _fundAndApprove(carol, 10e18);
        vm.prank(carol);
        tc.buy(7e18);

        (address[3] memory winners, uint256[3] memory values) = tc.podium(tc.CAT_BIGGEST_BUY());
        assertEq(winners[0], carol);
        assertEq(values[0], 7e18);
        assertEq(winners[1], alice);
        assertEq(values[1], 5e18);
        assertEq(winners[2], bob);
        assertEq(values[2], 3e18);
    }

    function test_opening_window_podium() public {
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

        (address[3] memory winners,) = tc.podium(tc.CAT_OPENING_WINDOW());
        assertEq(winners[0], alice);
        assertEq(winners[1], bob);
        assertEq(winners[2], carol);
    }

    function test_closing_window_podium() public {
        // Flat min-buy curve so buys near the end of a long timer are still valid (growth would
        // otherwise push minBuy above 1e18 when elapsed ~ 1 day).
        TimeCurve tcFlat = new TimeCurve(
            usdm,
            launchedToken,
            router,
            prizeVault,
            1e18,
            0,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tcFlat));
        launchedToken.mint(address(tcFlat), 1_000_000e18);
        tcFlat.startSale();
        uint256 d0 = tcFlat.deadline();
        vm.warp(d0 - 100);

        for (uint256 i; i < 3; i++) {
            _fundAndApproveCurve(alice, 2e18, tcFlat);
            vm.prank(alice);
            tcFlat.buy(1e18);
        }
        for (uint256 i; i < 2; i++) {
            _fundAndApproveCurve(bob, 2e18, tcFlat);
            vm.prank(bob);
            tcFlat.buy(1e18);
        }
        _fundAndApproveCurve(carol, 2e18, tcFlat);
        vm.prank(carol);
        tcFlat.buy(1e18);

        (address[3] memory winners, uint256[3] memory values) = tcFlat.podium(tcFlat.CAT_CLOSING_WINDOW());
        assertEq(winners[0], alice);
        assertEq(values[0], 3);
        assertEq(winners[1], bob);
        assertEq(values[1], 2);
        assertEq(winners[2], carol);
        assertEq(values[2], 1);
    }

    function test_highest_cumulative_podium() public {
        tc.startSale();
        _fundAndApprove(alice, 20e18);
        vm.prank(alice);
        tc.buy(2e18);
        vm.prank(alice);
        tc.buy(1e18);

        _fundAndApprove(bob, 20e18);
        vm.prank(bob);
        tc.buy(10e18);

        _fundAndApprove(carol, 20e18);
        vm.prank(carol);
        tc.buy(5e18);

        (address[3] memory winners, uint256[3] memory values) = tc.podium(tc.CAT_HIGHEST_CUMULATIVE());
        assertEq(winners[0], bob);
        assertEq(values[0], 10e18);
        assertEq(winners[1], carol);
        assertEq(values[1], 5e18);
        assertEq(winners[2], alice);
        assertEq(values[2], 3e18);
    }

    function test_fees_routed_on_buy() public {
        tc.startSale();
        _fundAndApprove(alice, 10e18);
        vm.prank(alice);
        tc.buy(10e18);

        // 30% to sink0, 20% to sink1, 35% to prizeVault, 15% to sink3
        assertEq(usdm.balanceOf(sink0), 3e18);
        assertEq(usdm.balanceOf(sink1), 2e18);
        assertEq(usdm.balanceOf(address(prizeVault)), 3.5e18);
        assertEq(usdm.balanceOf(sink3), 1.5e18);
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
            usdm,
            IERC20(address(0)),
            router,
            prizeVault,
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
    }

    function test_constructor_zero_prizeVault_reverts() public {
        vm.expectRevert("TimeCurve: zero prize vault");
        new TimeCurve(
            usdm,
            launchedToken,
            router,
            PrizeVault(address(0)),
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
    }

    function test_constructor_zero_acceptedAsset_reverts() public {
        vm.expectRevert("TimeCurve: zero asset");
        new TimeCurve(
            IERC20(address(0)),
            launchedToken,
            router,
            prizeVault,
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
    }

    function test_constructor_zero_feeRouter_reverts() public {
        vm.expectRevert("TimeCurve: zero router");
        new TimeCurve(
            usdm,
            launchedToken,
            FeeRouter(address(0)),
            prizeVault,
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );
    }

    /// @dev Integer division can round claim to 0 when `totalTokensForSale` is tiny vs `totalRaised`.
    function test_claimAllocation_zero_allocation_reverts() public {
        TimeCurve tcSmall = new TimeCurve(
            usdm,
            launchedToken,
            router,
            prizeVault,
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1,
            3600,
            3600
        );
        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tcSmall));
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
        vm.expectRevert("TimeCurve: zero allocation");
        tcSmall.claimAllocation();
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

        uint256 expectedPrize = usdm.balanceOf(address(prizeVault));
        assertGt(expectedPrize, 0);
        deal(address(usdm), address(prizeVault), 0);

        tc.distributePrizes();
        assertFalse(tc.prizesDistributed());

        deal(address(usdm), address(prizeVault), expectedPrize);
        tc.distributePrizes();
        assertTrue(tc.prizesDistributed());
    }

    /// @dev Integer split rounds to zero for all podium places: must not lock distribution.
    function test_distributePrizes_dust_pool_is_retryable() public {
        tc.startSale();
        _fundAndApprove(alice, 5e18);
        vm.prank(alice);
        tc.buy(1e18);
        vm.warp(tc.deadline() + 1);
        tc.endSale();

        deal(address(usdm), address(prizeVault), 6); // perCategory == 1 → all shares 0
        tc.distributePrizes();
        assertFalse(tc.prizesDistributed());

        deal(address(usdm), address(prizeVault), 1_000_000e18);
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

        uint256 vaultBefore = usdm.balanceOf(address(prizeVault));
        assertGt(vaultBefore, 0);
        tc.distributePrizes();
        assertTrue(tc.prizesDistributed());
        assertLt(usdm.balanceOf(address(prizeVault)), vaultBefore);
    }
}
