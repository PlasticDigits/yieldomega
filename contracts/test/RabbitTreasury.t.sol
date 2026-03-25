// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";

contract MockUSDm is ERC20 {
    constructor() ERC20("USDm", "USDM") {}
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

    MockUSDm usdm;
    Doubloon doub;
    RabbitTreasury rt;

    address alice = makeAddr("alice");
    address feeSource = makeAddr("feeSource");

    function setUp() public {
        usdm = new MockUSDm();
        doub = new Doubloon(address(this));
        rt = new RabbitTreasury(
            usdm, doub, ONE_DAY,
            C_MAX, C_STAR, ALPHA, BETA, M_MIN, M_MAX, LAM, DELTA_MAX_FRAC, EPS,
            address(this)
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));
        rt.grantRole(rt.FEE_ROUTER_ROLE(), feeSource);
    }

    function _fundAndApprove(address user, uint256 amount) internal {
        usdm.mint(user, amount);
        vm.prank(user);
        usdm.approve(address(rt), amount);
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

        // At e=1.0, 100 USDm → 100 DOUB
        assertEq(doub.balanceOf(alice), 100e18);
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

        vm.prank(alice);
        rt.withdraw(50e18, 0);

        assertEq(doub.balanceOf(alice), 50e18);
        assertEq(usdm.balanceOf(alice), 50e18);
        assertEq(rt.totalReserves(), 50e18);
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

    /// @dev Invariant: reserves never go negative; DOUB supply matches mint-burn accounting.
    function test_deposit_withdraw_fuzz(uint128 depositRaw, uint128 withdrawFrac) public {
        rt.openFirstEpoch();
        uint256 dep = uint256(depositRaw) % 1_000_000e18 + 1;
        _fundAndApprove(alice, dep);
        vm.prank(alice);
        rt.deposit(dep, 0);

        uint256 doubBal = doub.balanceOf(alice);
        uint256 toWithdraw = doubBal * (uint256(withdrawFrac) % 100 + 1) / 100;
        if (toWithdraw > doubBal) toWithdraw = doubBal;
        if (toWithdraw == 0) toWithdraw = 1;

        vm.prank(alice);
        rt.withdraw(toWithdraw, 0);

        assertGe(rt.totalReserves(), 0);
        assertEq(doub.balanceOf(alice), doubBal - toWithdraw);
    }

    // ── Fee reception ──────────────────────────────────────────────────

    function test_receiveFee() public {
        rt.openFirstEpoch();
        usdm.mint(feeSource, 50e18);
        vm.prank(feeSource);
        usdm.approve(address(rt), 50e18);
        vm.prank(feeSource);
        rt.receiveFee(50e18);

        assertEq(rt.totalReserves(), 50e18);
        assertEq(rt.cumulativeFees(), 50e18);
    }

    function test_receiveFee_unauthorized_reverts() public {
        rt.openFirstEpoch();
        usdm.mint(alice, 50e18);
        vm.prank(alice);
        usdm.approve(address(rt), 50e18);
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
}
