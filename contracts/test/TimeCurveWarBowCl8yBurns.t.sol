// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

// Invariant ↔ test mapping: docs/testing/invariants-and-business-logic.md (GitLab #70 — WarBow CL8Y burns)

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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

/// @notice Fuzz + regression for **user-driven** WarBow CL8Y burns: every successful burn moves exactly the
///         documented WAD from the payer into `TimeCurve` then to `BURN_SINK` (0xdEaD) in one atomic tx.
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

    /// @dev Invariant: each successful `warbowActivateGuard` increases dead-address CL8Y by exactly `WARBOW_GUARD_BURN_WAD`.
    function testFuzz_warbow_guard_burn_exact_to_sink(uint160 callerRaw) public {
        vm.assume(callerRaw != uint160(0));
        address caller = address(callerRaw);

        tc.startSaleAt(block.timestamp);
        _fund(caller, 100e18);

        uint256 sinkBefore = reserve.balanceOf(BURN_SINK);
        vm.prank(caller);
        tc.warbowActivateGuard();
        assertEq(reserve.balanceOf(BURN_SINK) - sinkBefore, tc.WARBOW_GUARD_BURN_WAD());
    }

    /// @dev Invariant: `warbowRevenge` burns exactly `WARBOW_REVENGE_BURN_WAD` after a qualifying steal setup.
    function testFuzz_warbow_revenge_burn_exact_to_sink(uint160 victim160, uint160 stealer160) public {
        vm.assume(victim160 != uint160(0) && stealer160 != uint160(0));
        vm.assume(victim160 != stealer160);
        address victim = address(victim160);
        address stealer = address(stealer160);

        tc.startSaleAt(block.timestamp);
        _fund(victim, 50e18);
        vm.prank(victim);
        tc.buy(1e18);

        _fund(stealer, 50e18 + tc.WARBOW_STEAL_BURN_WAD());
        vm.prank(stealer);
        tc.warbowSteal(victim, false);

        uint256 sinkBefore = reserve.balanceOf(BURN_SINK);
        _fund(victim, 50e18 + tc.WARBOW_REVENGE_BURN_WAD());
        vm.prank(victim);
        tc.warbowRevenge(stealer);
        assertEq(reserve.balanceOf(BURN_SINK) - sinkBefore, tc.WARBOW_REVENGE_BURN_WAD());
    }

    /// @dev Invariant: `warbowSteal` without bypass moves exactly `WARBOW_STEAL_BURN_WAD` to the burn sink.
    ///      Victim has BP from a buy; stealer has zero BP (2× rule satisfied).
    function testFuzz_warbow_steal_burn_exact_to_sink(uint160 victim160, uint160 stealer160) public {
        vm.assume(victim160 != uint160(0) && stealer160 != uint160(0));
        vm.assume(victim160 != stealer160);
        address victim = address(victim160);
        address stealer = address(stealer160);

        tc.startSaleAt(block.timestamp);
        _fund(victim, 50e18);
        vm.prank(victim);
        tc.buy(1e18);

        _fund(stealer, 50e18 + tc.WARBOW_STEAL_BURN_WAD());
        uint256 sinkBefore = reserve.balanceOf(BURN_SINK);
        vm.prank(stealer);
        tc.warbowSteal(victim, false);
        assertEq(reserve.balanceOf(BURN_SINK) - sinkBefore, tc.WARBOW_STEAL_BURN_WAD());
    }
}
