// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockReserveCl8y, MockLaunchToken} from "../script/DeployDev.s.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

/// @notice Mirrors `DeployDev` wiring: after deploy, epoch + sale are live; deposit + buy succeed.
contract DevStackIntegrationTest is Test {
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant FOUR_DAYS = 4 * ONE_DAY;
    uint256 internal constant GROWTH_WAD = 182_321_556_793_954_592;
    address internal constant SALE_CL8Y_BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    MockReserveCl8y reserveAsset;
    Doubloon doub;
    PodiumPool podiumPool;
    DoubLPIncentives doubLP;
    EcosystemTreasury ecoTreasury;
    RabbitTreasury rt;
    FeeRouter router;
    MockLaunchToken lt;
    LinearCharmPrice charmPrice;
    TimeCurve tc;

    address alice = makeAddr("alice");

    function setUp() public {
        reserveAsset = new MockReserveCl8y();
        doub = new Doubloon(address(this));

        podiumPool = UUPSDeployLib.deployPodiumPool(address(this));
        doubLP = UUPSDeployLib.deployDoubLPIncentives(address(this));
        ecoTreasury = UUPSDeployLib.deployEcosystemTreasury(address(this));

        rt = UUPSDeployLib.deployRabbitTreasury(
            ERC20(address(reserveAsset)),
            doub,
            ONE_DAY,
            2e18,
            1_050_000_000_000_000_000,
            2e16,
            2e18,
            98e16,
            102e16,
            5e17,
            2e16,
            1,
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            address(this)
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));

        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            [
                address(doubLP),
                SALE_CL8Y_BURN_SINK,
                address(podiumPool),
                address(ecoTreasury),
                address(rt)
            ],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        rt.grantRole(rt.FEE_ROUTER_ROLE(), address(router));
        router.setDistributableToken(IERC20(address(reserveAsset)), true);

        lt = new MockLaunchToken();
        lt.mint(address(this), 1_000_000e18);

        charmPrice = UUPSDeployLib.deployLinearCharmPrice(1e18, 1e17, address(this)); // $1 + $0.10/day (18-dec asset)
        tc = UUPSDeployLib.deployTimeCurve(
            ERC20(address(reserveAsset)),
            lt,
            router,
            podiumPool,
            address(0),
            ICharmPrice(address(charmPrice)),
            1e18,
            GROWTH_WAD,
            120,
            ONE_DAY,
            FOUR_DAYS,
            1_000_000e18,
            300,
            address(this)
        );
        lt.transfer(address(tc), 1_000_000e18);
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));

        rt.openFirstEpoch();
        tc.startSaleAt(block.timestamp);
        tc.setCharmRedemptionEnabled(true);
        tc.setReservePodiumPayoutsEnabled(true);
    }

    function test_devStack_epochAndSaleActive() public view {
        assertEq(rt.currentEpochId(), 1);
        assertGt(rt.epochEnd(), rt.epochStart());
        assertGt(tc.saleStart(), 0);
        assertGt(tc.deadline(), tc.saleStart());
        assertFalse(tc.ended());
    }

    function test_devStack_depositAndBuy() public {
        reserveAsset.mint(alice, 10_000e18);

        vm.startPrank(alice);
        reserveAsset.approve(address(rt), 100e18);
        rt.deposit(100e18, 0);
        // TimeCurve pulls accepted asset from buyer then forwards to FeeRouter.
        reserveAsset.approve(address(tc), 1e18);
        tc.buy(1e18);
        vm.stopPrank();

        assertEq(doub.balanceOf(alice), 100e18);
        assertGe(tc.totalRaised(), 1e18);
    }
}
