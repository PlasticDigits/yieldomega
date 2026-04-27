// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";
import {
    AnvilWETH9,
    AnvilMockUSDM,
    AnvilKumbayaRouter
} from "../src/fixtures/AnvilKumbayaFixture.sol";

contract MockReserveCl8y is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockLaunchToken is ERC20 {
    constructor() ERC20("MLT", "MLT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Single-tx USDM → Kumbaya → `buyFor` (GitLab #65).
contract TimeCurveBuyRouterTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;
    uint256 internal constant GROWTH_WAD = 182_321_556_793_954_592;
    address internal constant SALE_CL8Y_BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    MockReserveCl8y reserve;
    MockLaunchToken lt;
    PodiumPool podiumPool;
    FeeRouter feeRouter;
    LinearCharmPrice charmPrice;
    TimeCurve tc;
    AnvilWETH9 weth;
    AnvilMockUSDM usdm;
    AnvilKumbayaRouter kumbaya;
    TimeCurveBuyRouter buyRouter;
    address cl8yProtocolTreasury = makeAddr("cl8yProtocolTreasury");

    address alice = makeAddr("alice");

    function setUp() public {
        reserve = new MockReserveCl8y();
        lt = new MockLaunchToken();
        lt.mint(address(this), 1_000_000e18);

        podiumPool = UUPSDeployLib.deployPodiumPool(address(this));
        feeRouter = UUPSDeployLib.deployFeeRouter(
            address(this),
            [
                makeAddr("lp"),
                SALE_CL8Y_BURN_SINK,
                address(podiumPool),
                makeAddr("team"),
                makeAddr("rabbit")
            ],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );

        charmPrice = UUPSDeployLib.deployLinearCharmPrice(1e18, 1e17, address(this));
        tc = UUPSDeployLib.deployTimeCurve(
            IERC20(address(reserve)),
            lt,
            feeRouter,
            podiumPool,
            address(0),
            ICharmPrice(address(charmPrice)),
            1e18,
            GROWTH_WAD,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            1,
            address(this)
        );
        lt.transfer(address(tc), 1_000_000e18);
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));
        tc.startSale();

        weth = new AnvilWETH9();
        usdm = new AnvilMockUSDM();
        kumbaya = new AnvilKumbayaRouter();

        weth.deposit{value: 8000 ether}();
        weth.transfer(address(kumbaya), 8000 ether);

        uint256 cl8yBal = reserve.balanceOf(address(this));
        require(cl8yBal >= 50_000_000e18);
        reserve.transfer(address(kumbaya), 50_000_000e18);

        usdm.transfer(address(kumbaya), 100_000_000e18);

        kumbaya.setPair(address(usdm), address(weth), 80_000_000e18, 80_000e18);
        kumbaya.setPair(address(weth), address(reserve), 8000e18, 8_000_000e18);
        kumbaya.setOwner(address(0));

        buyRouter = new TimeCurveBuyRouter(tc, address(kumbaya), address(weth), address(usdm), cl8yProtocolTreasury);
        tc.setTimeCurveBuyRouter(address(buyRouter));
    }

    function _pathUsdmToCl8y() internal view returns (bytes memory) {
        return abi.encodePacked(address(reserve), uint24(3000), address(weth), uint24(3000), address(usdm));
    }

    function test_buyViaKumbaya_stable_creditsAlice() public {
        uint256 charmWad = 1e18;
        bytes memory path = _pathUsdmToCl8y();

        uint256 gross = (charmWad * tc.currentPricePerCharmWad()) / WAD;
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        usdm.mint(alice, maxIn);

        vm.startPrank(alice);
        usdm.approve(address(buyRouter), maxIn);
        buyRouter.buyViaKumbaya(
            charmWad,
            bytes32(0),
            false,
            buyRouter.PAY_STABLE(),
            block.timestamp + 600,
            maxIn,
            path
        );
        vm.stopPrank();

        assertEq(tc.charmWeight(alice), charmWad);
        assertGe(tc.totalRaised(), tc.currentPricePerCharmWad());
    }

    /// @dev GitLab #70 — any CL8Y dust on the router after `buyFor` credits `cl8yProtocolTreasury`, not the buyer.
    function test_buyViaKumbaya_preseed_cl8y_surplus_routes_to_protocol_treasury() public {
        uint256 charmWad = 1e18;
        bytes memory path = abi.encodePacked(address(reserve), uint24(3000), address(weth));

        uint256 gross = (charmWad * tc.currentPricePerCharmWad()) / WAD;
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        reserve.transfer(address(buyRouter), 1e15);
        uint256 treBefore = reserve.balanceOf(cl8yProtocolTreasury);

        vm.deal(alice, maxIn);
        vm.startPrank(alice);
        buyRouter.buyViaKumbaya{value: maxIn}(
            charmWad, bytes32(0), false, buyRouter.PAY_ETH(), block.timestamp + 600, maxIn, path
        );
        vm.stopPrank();

        assertEq(tc.charmWeight(alice), charmWad);
        assertGe(reserve.balanceOf(cl8yProtocolTreasury), treBefore + 1e15);
        assertEq(reserve.balanceOf(address(buyRouter)), 0);
    }

    function test_buyViaKumbaya_eth_creditsAlice() public {
        uint256 charmWad = 1e18;
        bytes memory path = abi.encodePacked(address(reserve), uint24(3000), address(weth));

        uint256 gross = (charmWad * tc.currentPricePerCharmWad()) / WAD;
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        vm.deal(alice, maxIn);
        vm.startPrank(alice);
        buyRouter.buyViaKumbaya{value: maxIn}(
            charmWad, bytes32(0), false, buyRouter.PAY_ETH(), block.timestamp + 600, maxIn, path
        );
        vm.stopPrank();

        assertEq(tc.charmWeight(alice), charmWad);
    }

    function test_buyFor_revertsWhenRouterUnset() public {
        TimeCurve tc2 = UUPSDeployLib.deployTimeCurve(
            IERC20(address(reserve)),
            lt,
            feeRouter,
            podiumPool,
            address(0),
            ICharmPrice(address(charmPrice)),
            1e18,
            GROWTH_WAD,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            1,
            address(this)
        );
        vm.expectRevert(bytes("TimeCurve: not buy router"));
        tc2.buyFor(alice, 1e18, false);
    }
}
