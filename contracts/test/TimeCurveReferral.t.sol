// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Referral CHARM + full gross routed to FeeRouter (see docs/product/referrals.md).
contract TimeCurveReferralTest is Test {
    uint256 internal constant GROWTH_RATE = 182_321_556_793_954_592;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    MockERC20 reserve;
    MockERC20 launchedToken;
    FeeRouter router;
    PodiumPool podiumPool;
    ReferralRegistry reg;
    LinearCharmPrice linearPrice;
    TimeCurve tc;

    address sink0 = makeAddr("sink0");
    address sink1 = makeAddr("sink1");
    address sink3 = makeAddr("sink3");
    address sink4 = makeAddr("sink4");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        reserve = new MockERC20("CL8Y", "CL8Y");
        launchedToken = new MockERC20("LaunchToken", "LT");
        podiumPool = UUPSDeployLib.deployPodiumPool(address(this));
        reg = UUPSDeployLib.deployReferralRegistry(IERC20(address(reserve)), 1e18, address(this));

        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            [sink0, sink1, address(podiumPool), sink3, sink4],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );

        linearPrice = UUPSDeployLib.deployLinearCharmPrice(1e18, 0, address(this));
        tc = UUPSDeployLib.deployTimeCurve(
            reserve,
            launchedToken,
            router,
            podiumPool,
            address(reg),
            ICharmPrice(address(linearPrice)),
            1e18,
            GROWTH_RATE,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            300,
            address(this)
        );

        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));
        launchedToken.mint(address(tc), 1_000_000e18);
        tc.startSaleAt(block.timestamp);

        reserve.mint(alice, 10e18);
        vm.startPrank(alice);
        reserve.approve(address(reg), type(uint256).max);
        reg.registerCode("ref1");
        vm.stopPrank();
    }

    function test_buy_with_referral_charms_and_full_gross_to_fee_router() public {
        bytes32 codeHash = reg.hashCode("ref1");
        uint256 charmWad = 10e18;
        uint256 amount = charmWad; // price 1:1 in this test setup
        reserve.mint(bob, amount);
        vm.startPrank(bob);
        reserve.approve(address(tc), amount);
        uint256 bobBefore = reserve.balanceOf(bob);
        tc.buy(charmWad, codeHash, false);
        vm.stopPrank();

        uint256 refEach = (charmWad * uint256(tc.REFERRAL_EACH_BPS())) / 10_000;
        assertEq(reserve.balanceOf(bob), bobBefore - amount, "bob pays full gross, no reserve rebate");
        assertEq(tc.charmWeight(bob), charmWad + refEach, "referee CHARM = base + bonus");
        assertEq(tc.charmWeight(alice), refEach, "referrer CHARM");

        uint256 distributed = reserve.balanceOf(sink0) + reserve.balanceOf(sink1) + reserve.balanceOf(address(podiumPool))
            + reserve.balanceOf(sink3) + reserve.balanceOf(sink4);
        assertEq(distributed, amount, "full gross to sinks via FeeRouter");
    }

    function test_buy_self_referral_reverts() public {
        bytes32 codeHash = reg.hashCode("ref1");
        reserve.mint(alice, 10e18);
        vm.startPrank(alice);
        reserve.approve(address(tc), 10e18);
        vm.expectRevert("TimeCurve: self-referral");
        tc.buy(10e18, codeHash, false);
        vm.stopPrank();
    }

    function test_buy_invalid_code_reverts() public {
        bytes32 bad = keccak256("nope");
        reserve.mint(bob, 10e18);
        vm.startPrank(bob);
        reserve.approve(address(tc), 10e18);
        vm.expectRevert("TimeCurve: invalid referral");
        tc.buy(10e18, bad, false);
        vm.stopPrank();
    }

    /// @dev GitLab #77 — `buy(charmWad, codeHash, false)` does not touch WarBow pending slot (#63 wiring).
    function test_referral_buy_with_plant_false_does_not_plant() public {
        bytes32 codeHash = reg.hashCode("ref1");
        reserve.mint(bob, 10e18);
        vm.startPrank(bob);
        reserve.approve(address(tc), 10e18);
        tc.buy(10e18, codeHash, false);
        vm.stopPrank();
        assertEq(tc.warbowPendingFlagOwner(), address(0));
        assertEq(tc.warbowPendingFlagPlantAt(), 0);
    }

    /// @dev GitLab #77 — referral buy with `plant=true` sets pending flag to **referee** (`buyer`), not referrer.
    function test_referral_buy_with_plant_true_plants() public {
        bytes32 codeHash = reg.hashCode("ref1");
        reserve.mint(bob, 10e18);
        vm.startPrank(bob);
        reserve.approve(address(tc), 10e18);
        tc.buy(10e18, codeHash, true);
        vm.stopPrank();
        assertEq(tc.warbowPendingFlagOwner(), bob);
        assertGt(tc.warbowPendingFlagPlantAt(), 0);
    }
}
