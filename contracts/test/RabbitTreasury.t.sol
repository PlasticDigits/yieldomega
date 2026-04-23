// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {BurrowMath} from "../src/libraries/BurrowMath.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockReserveCl8y is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract RabbitTreasuryTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant ONE_DAY = 86_400;

    // BurrowMath defaults (from simulations)
    uint256 internal constant C_MAX = 2e18;
    uint256 internal constant C_STAR = 1_050_000_000_000_000_000;
    uint256 internal constant ALPHA = 2e16;
    uint256 internal constant BETA = 2e18;
    uint256 internal constant M_MIN = 98e16;
    uint256 internal constant M_MAX = 102e16;
    uint256 internal constant LAM = 5e17;
    uint256 internal constant DELTA_MAX_FRAC = 2e16;
    uint256 internal constant EPS = 1;

    MockReserveCl8y reserve;
    Doubloon doub;
    RabbitTreasury rt;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob_rt_wd");
    address feeSource = makeAddr("feeSource");

    bytes32 internal constant BURROW_HEALTH_SIG =
        0x476424d2159ae843d833615e61b543b8cb93f382b9ad46d8b1545307620a4d6d;

    function setUp() public {
        reserve = new MockReserveCl8y();
        doub = new Doubloon(address(this));
        rt = UUPSDeployLib.deployRabbitTreasury(
            reserve,
            doub,
            ONE_DAY,
            C_MAX,
            C_STAR,
            ALPHA,
            BETA,
            M_MIN,
            M_MAX,
            LAM,
            DELTA_MAX_FRAC,
            EPS,
            25e16, // protocolRevenueBurnShareWad
            1e16, // withdrawFeeWad 1%
            5e17, // minRedemptionEfficiencyWad
            0, // redemptionCooldownEpochs
            address(0), // burnSink
            address(this)
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));
        rt.grantRole(rt.FEE_ROUTER_ROLE(), feeSource);
    }

    function _fundAndApprove(address user, uint256 amount) internal {
        reserve.mint(user, amount);
        vm.prank(user);
        reserve.approve(address(rt), amount);
    }

    /// @dev Withdraw math uses `minRedemptionEfficiencyWad` and `withdrawFeeWad`; tests that need nominal 1:1 redemption at `e=1` should pin efficiency to 100%.
    function _setFullRedemptionEfficiency() internal {
        rt.setMinRedemptionEfficiencyWad(WAD);
    }

    /// @dev No withdrawal fee and full efficiency — deterministic gross-out equals pro-rata/nominal cap before rounding.
    function _setDeterministicWithdrawNoFee() internal {
        _setFullRedemptionEfficiency();
        rt.setWithdrawFeeWad(0);
    }

    // ── Epoch management ───────────────────────────────────────────────

    function test_openFirstEpoch() public {
        rt.openFirstEpoch();
        assertEq(rt.currentEpochId(), 1);
        assertGt(rt.epochEnd(), block.timestamp);
    }

    function test_openFirstEpoch_reverts_twice() public {
        rt.openFirstEpoch();
        vm.expectRevert("RT: epoch exists");
        rt.openFirstEpoch();
    }

    // ── Deposit ────────────────────────────────────────────────────────

    function test_deposit_basic() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 100e18);

        vm.prank(alice);
        rt.deposit(100e18, 0);

        // At e=1.0, 100 CL8Y → 100 DOUB; all in redeemable bucket
        assertEq(doub.balanceOf(alice), 100e18);
        assertEq(rt.redeemableBacking(), 100e18);
        assertEq(rt.protocolOwnedBacking(), 0);
        assertEq(rt.totalReserves(), 100e18);
    }

    function test_deposit_zero_reverts() public {
        rt.openFirstEpoch();
        vm.prank(alice);
        vm.expectRevert("RT: zero amount");
        rt.deposit(0, 0);
    }

    function test_deposit_no_epoch_reverts() public {
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert("RT: no epoch");
        rt.deposit(100e18, 0);
    }

    // ── Withdraw ───────────────────────────────────────────────────────

    function test_withdraw_basic() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        rt.deposit(100e18, 0);

        (uint256 userOut, uint256 wFee) = rt.previewWithdrawFor(alice, 50e18);
        vm.prank(alice);
        rt.withdraw(50e18, 0);

        uint256 gross = userOut + wFee;
        assertEq(doub.balanceOf(alice), 50e18);
        assertEq(reserve.balanceOf(alice), userOut);
        assertEq(rt.redeemableBacking(), 100e18 - gross);
        assertEq(rt.protocolOwnedBacking(), wFee);
        assertEq(rt.totalReserves(), 100e18 - userOut);
    }

    /// @dev Offchain previews and tests must use the same `user` as `withdraw`; {previewWithdrawFor} encodes that.
    function test_previewWithdrawFor_agrees_with_withdraw_fuzz(uint128 depositRaw, uint16 withdrawBps) public {
        rt.openFirstEpoch();
        uint256 dep = bound(uint256(depositRaw), 1e18, 1_000_000e18);
        _fundAndApprove(alice, dep);
        vm.prank(alice);
        rt.deposit(dep, 0);

        uint256 doubBal = doub.balanceOf(alice);
        uint256 amt = bound(uint256(withdrawBps), 1, doubBal);

        uint256 redeemableBefore = rt.redeemableBacking();
        uint256 protocolBefore = rt.protocolOwnedBacking();
        (uint256 expectOut, uint256 expectFee) = rt.previewWithdrawFor(alice, amt);
        vm.assume(expectOut > 0);

        uint256 reserveBefore = reserve.balanceOf(alice);
        vm.prank(alice);
        rt.withdraw(amt, 0);

        assertEq(reserve.balanceOf(alice) - reserveBefore, expectOut, "reserve to user");
        assertEq(rt.protocolOwnedBacking() - protocolBefore, expectFee, "withdraw fee accrual");
        assertEq(redeemableBefore - rt.redeemableBacking(), expectOut + expectFee, "redeemable draw");
    }

    function test_withdraw_more_than_balance_reverts() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 10e18);
        vm.prank(alice);
        rt.deposit(10e18, 0);

        // Alice has 10 DOUB, try to withdraw 20 DOUB (she doesn't have enough)
        vm.prank(alice);
        vm.expectRevert();
        rt.withdraw(20e18, 0);
    }

    // ── Epoch finalization and repricing ────────────────────────────────

    function test_finalizeEpoch_repricing() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 1_000_000e18);
        vm.prank(alice);
        rt.deposit(1_000_000e18, 0);

        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();

        // After repricing, e should have moved based on BurrowMath
        uint256 newE = rt.eWad();
        assertGt(newE, 0);
        assertEq(rt.currentEpochId(), 2);
    }

    function test_finalizeEpoch_can_run_twice_advances_epoch() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        rt.deposit(100e18, 0);

        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();
        assertEq(rt.currentEpochId(), 2);

        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();
        assertEq(rt.currentEpochId(), 3);
    }

    function test_finalizeEpoch_too_early_reverts() public {
        rt.openFirstEpoch();
        vm.expectRevert("RT: epoch not ended");
        rt.finalizeEpoch();
    }

    function test_finalizeEpoch_no_supply() public {
        rt.openFirstEpoch();
        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();
        // With zero supply, e stays at 1.0
        assertEq(rt.eWad(), WAD);
    }

    /// @dev Bank-run style: many partial withdrawals across two holders; token balance always matches `totalReserves`.
    function test_extremeWithdrawal_sequence_preservesReservesBalanceMatch() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 50_000_000e18);
        vm.prank(alice);
        rt.deposit(50_000_000e18, 0);

        vm.prank(alice);
        doub.transfer(bob, 25_000_000e18);

        for (uint256 i; i < 60; ++i) {
            assertEq(reserve.balanceOf(address(rt)), rt.totalReserves(), "reserve balance vs totalReserves");
            if (i % 2 == 0) {
                uint256 aBal = doub.balanceOf(alice);
                if (aBal > 1000e18) {
                    vm.prank(alice);
                    rt.withdraw(aBal / 20, 0);
                }
            } else {
                uint256 bBal = doub.balanceOf(bob);
                if (bBal > 1000e18) {
                    vm.prank(bob);
                    rt.withdraw(bBal / 20, 0);
                }
            }
        }
        assertEq(reserve.balanceOf(address(rt)), rt.totalReserves());
    }

    /// @dev `BurrowHealthEpochFinalized` reserve ratio and backing match on-chain BurrowMath (threat model: accounting mismatch).
    function test_finalizeEpoch_emittedHealthMetrics_matchBurrowFormula() public {
        rt.openFirstEpoch();
        _fundAndApprove(alice, 2_000_000e18);
        vm.prank(alice);
        rt.deposit(2_000_000e18, 0);

        uint256 supply = doub.totalSupply();
        uint256 totalRes = rt.totalReserves();
        uint256 priorE = rt.eWad();
        assertGt(supply, 0);

        uint256 C = BurrowMath.coverageWad(totalRes, supply, priorE, rt.cMaxWad(), rt.eps());
        uint256 m = BurrowMath.multiplierWad(
            C, rt.cStarWad(), rt.alphaWad(), rt.betaWad(), rt.mMinWad(), rt.mMaxWad()
        );
        uint256 nextE = BurrowMath.nextEWad(priorE, m, rt.lamWad(), rt.deltaMaxFracWad());
        uint256 expRepricing = nextE > 0 ? Math.mulDiv(nextE, WAD, priorE) : WAD;
        uint256 expReserveRatio = Math.mulDiv(totalRes, WAD, Math.mulDiv(supply, nextE, WAD) + rt.eps());
        uint256 expBacking = Math.mulDiv(totalRes, WAD, supply);

        vm.warp(rt.epochEnd());

        vm.recordLogs();
        rt.finalizeEpoch();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i; i < logs.length; i++) {
            Vm.Log memory lg = logs[i];
            if (lg.emitter != address(rt) || lg.topics[0] != BURROW_HEALTH_SIG) continue;
            (
                uint256 finalizedAt,
                uint256 reserveRatioWad,
                uint256 doubTotalSupply,
                uint256 repricingFactorWad,
                uint256 backingPerDoubloonWad,
                uint256 internalStateEWad
            ) = abi.decode(lg.data, (uint256, uint256, uint256, uint256, uint256, uint256));
            finalizedAt; // silence unused
            assertEq(doubTotalSupply, supply, "emitted supply");
            assertEq(reserveRatioWad, expReserveRatio, "reserveRatioWad");
            assertEq(repricingFactorWad, expRepricing, "repricingFactorWad");
            assertEq(backingPerDoubloonWad, expBacking, "backingPerDoubloonWad");
            assertEq(internalStateEWad, nextE, "internalStateEWad");
            found = true;
            break;
        }
        assertTrue(found, "BurrowHealthEpochFinalized not found");
        assertEq(rt.eWad(), nextE);
    }

    /// @dev Invariant: reserves never go negative; DOUB supply matches mint-burn accounting.
    function test_deposit_withdraw_fuzz(uint128 depositRaw, uint128 withdrawFrac) public {
        rt.openFirstEpoch();
        // Large enough deposits avoid dust where health-scaled × fee math rounds `userOut` to 0.
        uint256 dep = uint256(depositRaw) % 1_000_000e18 + 1e18;
        _fundAndApprove(alice, dep);
        vm.prank(alice);
        rt.deposit(dep, 0);

        uint256 doubBal = doub.balanceOf(alice);
        uint256 toWithdraw = doubBal * (uint256(withdrawFrac) % 100 + 1) / 100;
        if (toWithdraw > doubBal) toWithdraw = doubBal;
        if (toWithdraw == 0) toWithdraw = 1;

        (uint256 previewOut,) = rt.previewWithdrawFor(alice, toWithdraw);
        vm.assume(previewOut > 0);

        vm.prank(alice);
        rt.withdraw(toWithdraw, 0);

        assertGe(rt.totalReserves(), 0);
        assertEq(doub.balanceOf(alice), doubBal - toWithdraw);
    }

    // ── Fee reception ──────────────────────────────────────────────────

    function test_receiveFee() public {
        rt.openFirstEpoch();
        reserve.mint(feeSource, 50e18);
        vm.prank(feeSource);
        reserve.approve(address(rt), 50e18);
        vm.prank(feeSource);
        rt.receiveFee(50e18);

        assertEq(rt.redeemableBacking(), 0);
        assertEq(rt.protocolOwnedBacking(), 375e17); // 75% of 50
        assertEq(rt.cumulativeBurned(), 125e17);
        assertEq(rt.cumulativeFees(), 50e18);
        assertEq(rt.totalReserves(), 375e17);
        assertEq(reserve.balanceOf(address(rt)), 375e17);
        assertEq(reserve.balanceOf(rt.DEFAULT_BURN_SINK()), 125e17);
    }

    function test_receiveFee_unauthorized_reverts() public {
        rt.openFirstEpoch();
        reserve.mint(alice, 50e18);
        vm.prank(alice);
        reserve.approve(address(rt), 50e18);
        vm.prank(alice);
        vm.expectRevert();
        rt.receiveFee(50e18);
    }

    function test_receiveFee_zero_reverts() public {
        rt.openFirstEpoch();
        vm.prank(feeSource);
        vm.expectRevert("RT: zero fee");
        rt.receiveFee(0);
    }

    // ── Pause ──────────────────────────────────────────────────────────

    function test_pause_blocks_deposit() public {
        rt.openFirstEpoch();
        rt.pause();
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert();
        rt.deposit(100e18, 0);
    }

    function test_unpause_allows_deposit() public {
        rt.openFirstEpoch();
        rt.pause();
        rt.unpause();
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        rt.deposit(100e18, 0);
        assertEq(doub.balanceOf(alice), 100e18);
    }

    // ── Param updates ──────────────────────────────────────────────────

    function test_params_update_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit RabbitTreasury.ParamsUpdated(address(this), "cStarWad", C_STAR, 1.1e18);
        rt.setCStarWad(1.1e18);
        assertEq(rt.cStarWad(), 1.1e18);
    }

    function test_params_update_unauthorized_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        rt.setCStarWad(1.1e18);
    }

    function test_setMBounds_invalid_reverts() public {
        vm.expectRevert("RT: mMin >= mMax");
        rt.setMBoundsWad(M_MAX, M_MIN);
    }

    // ── Bucket model & anti-leak ───────────────────────────────────────

    function test_receiveFee_doesNotMintDoub_andDoesNotIncreaseRedeemable() public {
        rt.openFirstEpoch();
        reserve.mint(feeSource, 200e18);
        vm.prank(feeSource);
        reserve.approve(address(rt), type(uint256).max);
        vm.prank(feeSource);
        rt.receiveFee(200e18);
        assertEq(doub.totalSupply(), 0);
        assertEq(rt.redeemableBacking(), 0);
        assertGt(rt.protocolOwnedBacking(), 0);
    }

    function test_protocolOwned_notExtracted_viaOrdinaryWithdraw() public {
        rt.openFirstEpoch();
        _setFullRedemptionEfficiency();
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        rt.deposit(100e18, 0);

        reserve.mint(feeSource, 1_000e18);
        vm.prank(feeSource);
        reserve.approve(address(rt), type(uint256).max);
        vm.prank(feeSource);
        rt.receiveFee(1_000e18);

        uint256 protocolBefore = rt.protocolOwnedBacking();
        assertGt(protocolBefore, 500e18);

        uint256 balBefore = reserve.balanceOf(alice);
        uint256 aliceDoub = doub.balanceOf(alice);
        vm.prank(alice);
        rt.withdraw(aliceDoub, 0);

        // User only receives redeemable-backed payout (+ withdrawal fee stays in protocol bucket)
        assertLt(reserve.balanceOf(alice) - balBefore, protocolBefore);
        assertEq(rt.redeemableBacking(), 0);
        assertGe(rt.protocolOwnedBacking(), protocolBefore);
    }

    function test_burn_share_zero_sends_all_to_protocol_bucket() public {
        Doubloon d0 = new Doubloon(address(this));
        RabbitTreasury rt0 = UUPSDeployLib.deployRabbitTreasury(
            reserve,
            d0,
            ONE_DAY,
            C_MAX,
            C_STAR,
            ALPHA,
            BETA,
            M_MIN,
            M_MAX,
            LAM,
            DELTA_MAX_FRAC,
            EPS,
            0, // no burn
            0, // no withdraw fee
            WAD, // min eff = 100%
            0,
            address(0),
            address(this)
        );
        d0.grantRole(d0.MINTER_ROLE(), address(rt0));
        rt0.grantRole(rt0.FEE_ROUTER_ROLE(), feeSource);
        rt0.openFirstEpoch();

        reserve.mint(feeSource, 100e18);
        vm.prank(feeSource);
        reserve.approve(address(rt0), type(uint256).max);
        vm.prank(feeSource);
        rt0.receiveFee(100e18);

        assertEq(rt0.cumulativeBurned(), 0);
        assertEq(rt0.protocolOwnedBacking(), 100e18);
        assertEq(reserve.balanceOf(address(rt0)), 100e18);
    }

    function test_redemptionCooldown_blocks_consecutive_withdraws() public {
        rt.openFirstEpoch();
        rt.setRedemptionCooldownEpochs(1);
        _fundAndApprove(alice, 100e18);
        vm.prank(alice);
        rt.deposit(100e18, 0);

        vm.prank(alice);
        rt.withdraw(10e18, 0);

        vm.prank(alice);
        vm.expectRevert("RT: redemption cooldown");
        rt.withdraw(10e18, 0);

        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();

        vm.prank(alice);
        rt.withdraw(10e18, 0);
    }

    /// @dev After a bullish repricing, nominal liability (S * e) can exceed redeemable backing; exits are pro-rata + efficiency capped.
    function test_repricingRaisesLiability_redemptionBelowNominal() public {
        rt.openFirstEpoch();
        rt.setWithdrawFeeWad(0);
        _setFullRedemptionEfficiency();
        _fundAndApprove(alice, 2_000_000e18);
        vm.prank(alice);
        rt.deposit(2_000_000e18, 0);

        // Fee inflow increases total backing without minting DOUB, lifting coverage above c* so e steps up.
        reserve.mint(feeSource, 500_000e18);
        vm.prank(feeSource);
        reserve.approve(address(rt), 500_000e18);
        vm.prank(feeSource);
        rt.receiveFee(500_000e18);

        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();

        assertGt(rt.eWad(), WAD, "e should rise when coverage is strong");

        uint256 s = doub.balanceOf(alice);
        uint256 nominalFull = s * rt.eWad() / WAD;
        assertGt(nominalFull, rt.redeemableBacking(), "nominal liability exceeds redeemable bucket");

        (uint256 userOut, uint256 fee) = rt.previewWithdrawFor(alice, s);
        assertEq(fee, 0);
        assertLt(userOut, nominalFull);
        assertLe(userOut, rt.redeemableBacking());

        vm.prank(alice);
        rt.withdraw(s, 0);
        assertEq(rt.redeemableBacking(), 0);
    }

    function test_stress_manyUsersExit_protocolBucketUntouched() public {
        rt.openFirstEpoch();
        _setDeterministicWithdrawNoFee();
        _fundAndApprove(alice, 1_000e18);
        vm.prank(alice);
        rt.deposit(1_000e18, 0);
        vm.prank(alice);
        doub.transfer(bob, 400e18);

        reserve.mint(feeSource, 5_000e18);
        vm.prank(feeSource);
        reserve.approve(address(rt), type(uint256).max);
        vm.prank(feeSource);
        rt.receiveFee(5_000e18);

        uint256 protoMid = rt.protocolOwnedBacking();

        uint256 aliceDoub = doub.balanceOf(alice);
        vm.prank(alice);
        rt.withdraw(aliceDoub, 0);
        uint256 bobDoub = doub.balanceOf(bob);
        vm.prank(bob);
        rt.withdraw(bobDoub, 0);

        assertEq(doub.totalSupply(), 0);
        assertEq(rt.redeemableBacking(), 0);
        assertGe(rt.protocolOwnedBacking(), protoMid);
        assertEq(reserve.balanceOf(address(rt)), rt.totalReserves());
    }
}
