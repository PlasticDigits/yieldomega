// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {MockERC20FeeOnTransfer} from "./mocks/MockERC20FeeOnTransfer.sol";
import {MockERC20AlwaysRevert} from "./mocks/MockERC20AlwaysRevert.sol";
import {MockERC20BlockedSink} from "./mocks/MockERC20BlockedSink.sol";
import {MockERC20Rebasing} from "./mocks/MockERC20Rebasing.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockPlain is ERC20 {
    constructor() ERC20("P", "P") {}
    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev Sad-path tests for non-standard ERC-20 behavior (see docs/onchain/security-and-threat-model.md).
contract NonStandardERC20Test is Test {
    uint256 internal constant GROWTH_RATE = 182_321_556_793_954_592;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;

    uint256 internal constant C_MAX = 2e18;
    uint256 internal constant C_STAR = 1_050_000_000_000_000_000;
    uint256 internal constant ALPHA = 2e16;
    uint256 internal constant BETA = 2e18;
    uint256 internal constant M_MIN = 98e16;
    uint256 internal constant M_MAX = 102e16;
    uint256 internal constant LAM = 5e17;
    uint256 internal constant DELTA_MAX_FRAC = 2e16;
    uint256 internal constant EPS = 1;

    address internal s0 = makeAddr("s0");
    address internal s1 = makeAddr("s1");
    address internal s2 = makeAddr("s2");
    address internal s3 = makeAddr("s3");
    address internal s4 = makeAddr("s4");

    function test_feeOnTransfer_timeCurve_buyReverts_distributeExpectsFullAmount() public {
        MockERC20FeeOnTransfer ft = new MockERC20FeeOnTransfer(100);
        MockPlain lt = new MockPlain();
        PodiumPool pv = UUPSDeployLib.deployPodiumPool(address(this));
        FeeRouter r = UUPSDeployLib.deployFeeRouter(
            address(this),
            [s0, s1, address(pv), s3, s4],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        LinearCharmPrice cp = UUPSDeployLib.deployLinearCharmPrice(1e18, 0, address(this));
        TimeCurve tc = UUPSDeployLib.deployTimeCurve(
            IERC20(address(ft)),
            IERC20(address(lt)),
            r,
            pv,
            address(0),
            ICharmPrice(address(cp)),
            1e18,
            0,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            1,
            address(this)
        );
        pv.grantRole(pv.DISTRIBUTOR_ROLE(), address(tc));
        lt.mint(address(tc), 1_000_000e18);
        tc.startSale();

        address user = makeAddr("user");
        ft.mint(user, 100e18);
        vm.prank(user);
        ft.approve(address(tc), 100e18);

        vm.prank(user);
        vm.expectRevert();
        tc.buy(10e18);
    }

    function test_alwaysRevert_feeRouter_distributeReverts() public {
        MockERC20AlwaysRevert t = new MockERC20AlwaysRevert();
        FeeRouter r = UUPSDeployLib.deployFeeRouter(
            address(this),
            [s0, s1, s2, s3, s4],
            [uint16(2000), uint16(2000), uint16(2000), uint16(2000), uint16(2000)]
        );
        t.mint(address(r), 1000);
        vm.expectRevert(MockERC20AlwaysRevert.TransferBlocked.selector);
        r.distributeFees(IERC20(address(t)), 1000);
    }

    function test_blockedSink_feeRouter_distributeReverts() public {
        address sinkA = makeAddr("sinkA");
        MockERC20BlockedSink t = new MockERC20BlockedSink(sinkA);
        FeeRouter r = UUPSDeployLib.deployFeeRouter(
            address(this),
            [sinkA, s1, s2, s3, s4],
            [uint16(2000), uint16(2000), uint16(2000), uint16(2000), uint16(2000)]
        );
        t.mint(address(r), 1000);
        vm.expectRevert(MockERC20BlockedSink.BlockedRecipient.selector);
        r.distributeFees(IERC20(address(t)), 1000);
    }

    function test_alwaysRevert_rabbitTreasury_depositReverts() public {
        MockERC20AlwaysRevert usdm = new MockERC20AlwaysRevert();
        Doubloon d = new Doubloon(address(this));
        RabbitTreasury rt = UUPSDeployLib.deployRabbitTreasury(
            IERC20(address(usdm)),
            d,
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
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            address(this)
        );
        d.grantRole(d.MINTER_ROLE(), address(rt));
        rt.openFirstEpoch();

        address u = makeAddr("u");
        usdm.mint(u, 100e18);
        vm.prank(u);
        usdm.approve(address(rt), 100e18);
        vm.prank(u);
        vm.expectRevert(MockERC20AlwaysRevert.TransferBlocked.selector);
        rt.deposit(100e18, 0);
    }

    function test_rebasing_treasury_balanceCanDesyncFromTotalReserves() public {
        MockERC20Rebasing usdm = new MockERC20Rebasing();
        Doubloon d = new Doubloon(address(this));
        RabbitTreasury rt = UUPSDeployLib.deployRabbitTreasury(
            IERC20(address(usdm)),
            d,
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
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            address(this)
        );
        d.grantRole(d.MINTER_ROLE(), address(rt));
        rt.openFirstEpoch();

        address u = makeAddr("u");
        usdm.mint(u, 100e18);
        vm.prank(u);
        usdm.approve(address(rt), 100e18);
        vm.prank(u);
        rt.deposit(100e18, 0);

        assertEq(rt.totalReserves(), 100e18);
        usdm.rebaseSimple(address(rt), 150e18);
        assertEq(usdm.balanceOf(address(rt)), 150e18);
        assertEq(rt.totalReserves(), 100e18);
    }
}
