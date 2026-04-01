// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {MockCL8Y} from "../src/tokens/MockCL8Y.sol";
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
    uint256 internal constant GROWTH_RATE = 223_143_551_314_209_700;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    MockERC20 usdm;
    MockERC20 launchedToken;
    FeeRouter router;
    PodiumPool podiumPool;
    MockCL8Y cl8y;
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
        usdm = new MockERC20("USDm", "USDM");
        launchedToken = new MockERC20("LaunchToken", "LT");
        podiumPool = new PodiumPool(address(this));
        cl8y = new MockCL8Y();
        reg = new ReferralRegistry(cl8y, 1e18);

        router = new FeeRouter(
            address(this),
            [sink0, sink1, address(podiumPool), sink3, sink4],
            [uint16(3000), uint16(1000), uint16(2000), uint16(500), uint16(3500)]
        );

        linearPrice = new LinearCharmPrice(1e18, 0);
        tc = new TimeCurve(
            usdm,
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
            1_000_000e18
        );

        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));
        launchedToken.mint(address(tc), 1_000_000e18);
        tc.startSale();

        cl8y.mint(alice, 10e18);
        vm.startPrank(alice);
        cl8y.approve(address(reg), type(uint256).max);
        reg.registerCode("ref1");
        vm.stopPrank();
    }

    function test_buy_with_referral_charms_and_full_gross_to_fee_router() public {
        bytes32 codeHash = reg.hashCode("ref1");
        uint256 charmWad = 10e18;
        uint256 amount = charmWad; // price 1:1 in this test setup
        usdm.mint(bob, amount);
        vm.startPrank(bob);
        usdm.approve(address(tc), amount);
        uint256 bobBefore = usdm.balanceOf(bob);
        tc.buy(charmWad, codeHash);
        vm.stopPrank();

        uint256 refEach = (charmWad * 1000) / 10_000;
        assertEq(usdm.balanceOf(bob), bobBefore - amount, "bob pays full gross, no USDm rebate");
        assertEq(tc.charmWeight(bob), charmWad + refEach, "referee CHARM = base + bonus");
        assertEq(tc.charmWeight(alice), refEach, "referrer CHARM");

        uint256 distributed = usdm.balanceOf(sink0) + usdm.balanceOf(sink1) + usdm.balanceOf(address(podiumPool))
            + usdm.balanceOf(sink3) + usdm.balanceOf(sink4);
        assertEq(distributed, amount, "full gross to sinks via FeeRouter");
    }

    function test_buy_self_referral_reverts() public {
        bytes32 codeHash = reg.hashCode("ref1");
        usdm.mint(alice, 10e18);
        vm.startPrank(alice);
        usdm.approve(address(tc), 10e18);
        vm.expectRevert("TimeCurve: self-referral");
        tc.buy(10e18, codeHash);
        vm.stopPrank();
    }

    function test_buy_invalid_code_reverts() public {
        bytes32 bad = keccak256("nope");
        usdm.mint(bob, 10e18);
        vm.startPrank(bob);
        usdm.approve(address(tc), 10e18);
        vm.expectRevert("TimeCurve: invalid referral");
        tc.buy(10e18, bad);
        vm.stopPrank();
    }
}
