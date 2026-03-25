// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {MockCL8Y} from "../src/tokens/MockCL8Y.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Referral splits on TimeCurve buys (see docs/product/referrals.md).
contract TimeCurveReferralTest is Test {
    uint256 internal constant GROWTH_RATE = 223_143_551_314_209_700;
    uint256 internal constant ONE_DAY = 86_400;

    MockERC20 usdm;
    MockERC20 launchedToken;
    FeeRouter router;
    PrizeVault prizeVault;
    MockCL8Y cl8y;
    ReferralRegistry reg;
    TimeCurve tc;

    address sink0 = makeAddr("sink0");
    address sink1 = makeAddr("sink1");
    address sink3 = makeAddr("sink3");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdm = new MockERC20("USDm", "USDM");
        launchedToken = new MockERC20("LaunchToken", "LT");
        prizeVault = new PrizeVault(address(this));
        cl8y = new MockCL8Y();
        reg = new ReferralRegistry(cl8y, 1e18);

        router = new FeeRouter(
            address(this),
            [sink0, sink1, address(prizeVault), sink3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );

        tc = new TimeCurve(
            usdm,
            launchedToken,
            router,
            prizeVault,
            address(reg),
            1e18,
            GROWTH_RATE,
            10,
            60,
            ONE_DAY,
            1_000_000e18,
            3600,
            3600
        );

        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tc));
        launchedToken.mint(address(tc), 1_000_000e18);
        tc.startSale();

        // Alice registers referral code "ref1"
        cl8y.mint(alice, 10e18);
        vm.startPrank(alice);
        cl8y.approve(address(reg), type(uint256).max);
        reg.registerCode("ref1");
        vm.stopPrank();
    }

    function test_buy_with_referral_splits() public {
        bytes32 codeHash = reg.hashCode("ref1");
        uint256 amount = 10e18;
        usdm.mint(bob, amount);
        vm.startPrank(bob);
        usdm.approve(address(tc), amount);
        uint256 bobBefore = usdm.balanceOf(bob);
        uint256 aliceBefore = usdm.balanceOf(alice);
        tc.buy(amount, codeHash);
        vm.stopPrank();

        uint256 refEach = (amount * 1000) / 10_000;
        assertEq(usdm.balanceOf(bob), bobBefore - amount + refEach, "referee rebate");
        assertEq(usdm.balanceOf(alice), aliceBefore + refEach, "referrer");

        uint256 toFee = amount - 2 * refEach;
        // FeeRouter immediately distributes to sinks (router balance is 0).
        uint256 distributed =
            usdm.balanceOf(sink0) + usdm.balanceOf(sink1) + usdm.balanceOf(address(prizeVault)) + usdm.balanceOf(sink3);
        assertEq(distributed, toFee, "total to sinks");
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
