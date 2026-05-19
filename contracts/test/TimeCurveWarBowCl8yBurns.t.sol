// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

// Invariant ↔ test mapping: docs/testing/invariants-and-business-logic.md (WarBow CL8Y → FeeRouter, 2026-05-19)

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Fuzz + regression: WarBow CL8Y spend routes through `FeeRouter` (canonical buy split) and increments `totalRaised`.
contract TimeCurveWarBowCl8yBurnsTest is Test {
    address internal constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    uint256 internal constant TEST_BUY_COOLDOWN_SEC = 1;
    uint256 internal constant GROWTH_RATE = 182_321_556_793_954_592;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    MockERC20 reserve;
    MockERC20 launchedToken;
    PodiumPool podiumPool;
    FeeRouter router;
    LinearCharmPrice linearPrice;
    TimeCurve tc;

    address sinkLp = makeAddr("sinkLp");
    address sinkBurn = makeAddr("sinkBurn");
    address sinkTeam = makeAddr("sinkTeam");
    address sinkRabbit = makeAddr("sinkRabbit");

    function setUp() public {
        reserve = new MockERC20("CL8Y", "CL8Y");
        launchedToken = new MockERC20("LaunchToken", "LT");
        podiumPool = UUPSDeployLib.deployPodiumPool(address(this));
        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            [sinkLp, sinkBurn, address(podiumPool), sinkTeam, sinkRabbit],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        router.setDistributableToken(IERC20(address(reserve)), true);
        linearPrice = UUPSDeployLib.deployLinearCharmPrice(1e18, 0, address(this));
        tc = UUPSDeployLib.deployTimeCurve(
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
            1_000_000e18,
            TEST_BUY_COOLDOWN_SEC,
            address(this)
        );
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));
        launchedToken.mint(address(tc), 1_000_000e18);
        tc.setCharmRedemptionEnabled(true);
        tc.setReservePodiumPayoutsEnabled(true);
    }

    function _fund(address user, uint256 amount) internal {
        reserve.mint(user, amount);
        vm.prank(user);
        reserve.approve(address(tc), amount);
    }

    function _sinkBalances()
        internal
        view
        returns (uint256 lp, uint256 burn, uint256 podium, uint256 team, uint256 rabbit)
    {
        lp = reserve.balanceOf(sinkLp);
        burn = reserve.balanceOf(sinkBurn);
        podium = reserve.balanceOf(address(podiumPool));
        team = reserve.balanceOf(sinkTeam);
        rabbit = reserve.balanceOf(sinkRabbit);
    }

    function _warpPastBuyCooldown(address user) internal {
        uint256 until = tc.nextBuyAllowedAt(user);
        if (until > block.timestamp) {
            vm.warp(until);
        }
    }

    function _assertCanonicalFeeSplitDelta(
        uint256 lpBefore,
        uint256 burnBefore,
        uint256 podiumBefore,
        uint256 teamBefore,
        uint256 rabbitBefore,
        uint256 gross
    ) internal view {
        assertEq(reserve.balanceOf(sinkLp) - lpBefore, (gross * 3000) / 10_000);
        assertEq(reserve.balanceOf(sinkBurn) - burnBefore, (gross * 4000) / 10_000);
        assertEq(reserve.balanceOf(address(podiumPool)) - podiumBefore, (gross * 2000) / 10_000);
        assertEq(reserve.balanceOf(sinkTeam) - teamBefore, 0);
        assertEq(reserve.balanceOf(sinkRabbit) - rabbitBefore, gross - (gross * 9000) / 10_000);
    }

    /// @dev Invariant: `warbowActivateGuard` routes `WARBOW_GUARD_BURN_WAD` via FeeRouter and raises `totalRaised`.
    function testFuzz_warbow_guard_routes_via_fee_router(uint160 callerRaw) public {
        vm.assume(callerRaw != uint160(0));
        address caller = address(callerRaw);
        vm.assume(caller != address(tc));
        vm.assume(caller != BURN_SINK);

        tc.startSaleAt(block.timestamp);
        _fund(caller, 100e18);

        uint256 raisedBefore = tc.totalRaised();
        (uint256 lpB, uint256 burnB, uint256 podB, uint256 teamB, uint256 rabB) = _sinkBalances();
        vm.prank(caller);
        tc.warbowActivateGuard();
        uint256 spent = tc.WARBOW_GUARD_BURN_WAD();
        assertEq(tc.totalRaised(), raisedBefore + spent);
        _assertCanonicalFeeSplitDelta(lpB, burnB, podB, teamB, rabB, spent);
    }

    /// @dev Invariant: `warbowRevenge` routes spend via FeeRouter after qualifying steal setup.
    function testFuzz_warbow_revenge_routes_via_fee_router(uint160 victim160, uint160 stealer160) public {
        vm.assume(victim160 != uint160(0) && stealer160 != uint160(0));
        vm.assume(victim160 != stealer160);
        address victim = address(victim160);
        address stealer = address(stealer160);
        vm.assume(victim != address(tc) && stealer != address(tc));
        vm.assume(victim != BURN_SINK && stealer != BURN_SINK);
        vm.assume(victim.code.length == 0 && stealer.code.length == 0);

        tc.startSaleAt(block.timestamp);
        _fund(stealer, 50e18);
        vm.prank(stealer);
        tc.buy(1e18);

        _fund(victim, 50e18);
        vm.prank(victim);
        tc.buy(1e18);
        _warpPastBuyCooldown(victim);
        vm.prank(victim);
        tc.buy(1e18);

        _fund(stealer, 50e18 + tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(stealer);
        tc.warbowSteal(victim, false);

        uint256 raisedBefore = tc.totalRaised();
        (uint256 lpB, uint256 burnB, uint256 podB, uint256 teamB, uint256 rabB) = _sinkBalances();
        _fund(victim, 50e18 + tc.WARBOW_REVENGE_BURN_WAD());
        vm.prank(victim);
        tc.warbowRevenge(stealer);
        uint256 spent = tc.WARBOW_REVENGE_BURN_WAD();
        assertEq(tc.totalRaised(), raisedBefore + spent);
        _assertCanonicalFeeSplitDelta(lpB, burnB, podB, teamB, rabB, spent);
    }

    /// @dev Invariant: `warbowSteal` without bypass routes `WARBOW_STEAL_BURN_WAD` via FeeRouter.
    function testFuzz_warbow_steal_routes_via_fee_router(uint160 victim160, uint160 stealer160) public {
        vm.assume(victim160 != uint160(0) && stealer160 != uint160(0));
        vm.assume(victim160 != stealer160);
        address victim = address(victim160);
        address stealer = address(stealer160);
        vm.assume(victim != address(tc) && stealer != address(tc));
        vm.assume(victim != BURN_SINK && stealer != BURN_SINK);
        vm.assume(victim.code.length == 0 && stealer.code.length == 0);

        tc.startSaleAt(block.timestamp);
        _fund(stealer, 50e18);
        vm.prank(stealer);
        tc.buy(1e18);

        _fund(victim, 50e18);
        vm.prank(victim);
        tc.buy(1e18);
        _warpPastBuyCooldown(victim);
        vm.prank(victim);
        tc.buy(1e18);

        uint256 raisedBefore = tc.totalRaised();
        (uint256 lpB, uint256 burnB, uint256 podB, uint256 teamB, uint256 rabB) = _sinkBalances();
        _fund(stealer, 50e18 + tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(stealer);
        tc.warbowSteal(victim, false);
        uint256 spent = tc.WARBOW_STEAL_BURN_WAD();
        assertEq(tc.totalRaised(), raisedBefore + spent);
        _assertCanonicalFeeSplitDelta(lpB, burnB, podB, teamB, rabB, spent);
    }

    function test_warbow_steal_increases_podium_pool_by_twenty_percent() public {
        tc.startSaleAt(block.timestamp);
        address victim = makeAddr("victimPod");
        address stealer = makeAddr("stealerPod");

        _fund(stealer, 50e18);
        vm.prank(stealer);
        tc.buy(1e18);
        _fund(victim, 50e18);
        vm.prank(victim);
        tc.buy(1e18);
        _warpPastBuyCooldown(victim);
        vm.prank(victim);
        tc.buy(1e18);

        uint256 podiumBefore = reserve.balanceOf(address(podiumPool));
        _fund(stealer, 50e18 + tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(stealer);
        tc.warbowSteal(victim, false);
        uint256 spent = tc.WARBOW_STEAL_BURN_WAD();
        assertEq(reserve.balanceOf(address(podiumPool)) - podiumBefore, (spent * 2000) / 10_000);
    }

    /// @dev GitLab #123 — forbids **`msg.sender == BURN_SINK`** (`INV-WARBOW-123-BURN-CALLER`).
    function test_warbow_steal_reverts_when_caller_is_burn_sink() public {
        tc.startSaleAt(block.timestamp);
        vm.prank(BURN_SINK);
        vm.expectRevert("TimeCurve: burn sink caller");
        tc.warbowSteal(makeAddr("victim"), false);
    }

    function test_warbow_revenge_reverts_when_caller_is_burn_sink() public {
        tc.startSaleAt(block.timestamp);
        vm.prank(BURN_SINK);
        vm.expectRevert("TimeCurve: burn sink caller");
        tc.warbowRevenge(makeAddr("stealer"));
    }

    function test_warbow_guard_reverts_when_caller_is_burn_sink() public {
        tc.startSaleAt(block.timestamp);
        vm.prank(BURN_SINK);
        vm.expectRevert("TimeCurve: burn sink caller");
        tc.warbowActivateGuard();
    }
}
