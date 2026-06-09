// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArenaCharmPriceTwap} from "../src/oracle/ArenaCharmPriceTwap.sol";
import {FullMath} from "../src/oracle/v3/FullMath.sol";
import {MockUniswapV3Factory} from "./mocks/MockUniswapV3Factory.sol";
import {MockUniswapV3PoolTwap} from "./mocks/MockUniswapV3PoolTwap.sol";
import {OracleLibrary} from "../src/oracle/v3/OracleLibrary.sol";

/// @dev INV-TIME-ARENA-CHARM-TWAP-INIT (#303): TWAP math + fail-closed guards.
contract ArenaCharmPriceTwapTest is Test {
    uint256 internal constant WAD = 1e18;

    address internal constant DOUB = address(0x1001);
    address internal constant CL8Y = address(0x1505);
    address internal constant WETH = address(0x2002);
    address internal constant USDM = address(0x3003);

    MockUniswapV3Factory internal factory;

    function setUp() public {
        factory = new MockUniswapV3Factory();
    }

    function test_compute_charmPriceWad_one_dollar_anchor_formula() public {
        int24 doubCl8yTick = 69_000;
        int24 cl8yWethTick = 69_100;
        int24 wethUsdmTick = -195_540;
        _wirePools(doubCl8yTick, cl8yWethTick, wethUsdmTick, wethUsdmTick, 100);

        ArenaCharmPriceTwap.Result memory r = ArenaCharmPriceTwap.compute(_baseConfig());

        assertEq(r.charmPriceWad, FullMath.mulDiv(WAD, WAD, r.doubUsdWad), "floor charmPrice from doubUsd");
        assertEq(r.minDoubSpendWad, FullMath.mulDiv(99e16, r.charmPriceWad, WAD));
        assertEq(r.maxDoubSpendWad, FullMath.mulDiv(10e18, r.charmPriceWad, WAD));
        uint256 charmUsdWad = FullMath.mulDiv(r.charmPriceWad, r.doubUsdWad, WAD);
        assertGe(charmUsdWad, WAD - 1, "~$1 USD/CHARM at deploy (floor rounding)");
        assertLe(charmUsdWad, WAD);
    }

    function test_reverts_when_doub_cl8y_pool_missing() public {
        vm.expectRevert();
        ArenaCharmPriceTwap.compute(_baseConfig());
    }

    function test_reverts_on_low_observation_cardinality() public {
        int24 tick = 0;
        address doubPool = address(new MockUniswapV3PoolTwap(DOUB, CL8Y, tick, tick, 1));
        address cl8yPool = address(new MockUniswapV3PoolTwap(CL8Y, WETH, tick, tick, 100));
        address usdmPool = address(new MockUniswapV3PoolTwap(WETH, USDM, tick, tick, 100));
        factory.setPool(DOUB, CL8Y, 100, doubPool);
        factory.setPool(CL8Y, WETH, 100, cl8yPool);
        factory.setPool(WETH, USDM, 3000, usdmPool);

        vm.expectRevert();
        ArenaCharmPriceTwap.compute(_baseConfig());
    }

    function test_oracleLibrary_consult_mock_linear_cumulative() public {
        int24 tick = 50_000;
        MockUniswapV3PoolTwap pool = new MockUniswapV3PoolTwap(DOUB, CL8Y, tick, tick, 100);
        vm.warp(1_000_000);
        int24 mean = OracleLibrary.consult(address(pool), 900);
        assertEq(mean, tick);
    }

    function _wirePools(
        int24 doubCl8yTick,
        int24 cl8yWethTick,
        int24 wethUsdmTick,
        int24 wethUsdmSpot,
        uint16 cardinality
    ) internal {
        address doubPool =
            address(new MockUniswapV3PoolTwap(DOUB, CL8Y, doubCl8yTick, doubCl8yTick, cardinality));
        address cl8yPool =
            address(new MockUniswapV3PoolTwap(CL8Y, WETH, cl8yWethTick, cl8yWethTick, cardinality));
        address usdmPool =
            address(new MockUniswapV3PoolTwap(WETH, USDM, wethUsdmSpot, wethUsdmTick, cardinality));
        factory.setPool(DOUB, CL8Y, 100, doubPool);
        factory.setPool(CL8Y, WETH, 100, cl8yPool);
        factory.setPool(WETH, USDM, 3000, usdmPool);
    }

    function _baseConfig() internal view returns (ArenaCharmPriceTwap.Config memory cfg) {
        cfg = ArenaCharmPriceTwap.Config({
            factory: address(factory),
            doub: DOUB,
            cl8y: CL8Y,
            weth: WETH,
            usdm: USDM,
            doubCl8yFee: 100,
            cl8yWethFee: 100,
            wethUsdmFee: 3000,
            twapSeconds: 900,
            minObservationCardinality: 2,
            maxSpotTwapDeviationBps: 500,
            minDoubUsdWad: 1e10,
            maxDoubUsdWad: 1e18
        });
    }
}
