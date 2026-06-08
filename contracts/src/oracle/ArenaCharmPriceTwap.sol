// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {FullMath} from "./v3/FullMath.sol";
import {TickMath} from "./v3/TickMath.sol";
import {IUniswapV3Factory} from "./v3/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "./v3/IUniswapV3Pool.sol";
import {OracleLibrary} from "./v3/OracleLibrary.sol";

/// @notice TWAP-derived initial `charmPriceWad` for Arena production deploy (GitLab #303).
/// @dev Matches Sir Trading Kumbaya V3 oracle recipe: 15-minute TWAP on DOUB/WETH (fee 100)
///      and WETH/USDm (fee 3000). USDm ≈ $1. Floor rounding on `charmPriceWad` (protocol-favorable).
library ArenaCharmPriceTwap {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant CHARM_MIN_WAD = 99e16;
    uint256 internal constant CHARM_MAX_WAD = 10e18;

    /// @dev Sir Trading default TWAP horizon on MegaETH (docs.sir.trading — trustless oracle).
    uint32 internal constant SIR_TWAP_SECONDS = 900;

    /// @dev Minimum observation buffer — cardinality 1 makes TWAP ≈ spot (unsafe).
    uint16 internal constant MIN_OBSERVATION_CARDINALITY = 2;

    /// @dev Reject when spot tick deviates from TWAP tick by more than this (basis points of price).
    uint16 internal constant MAX_SPOT_TWAP_DEVIATION_BPS = 500;

    /// @dev Plausible DOUB/USD TWAP band (WAD). Anchoring still targets ~$1/CHARM at deploy.
    uint256 internal constant MIN_DOUB_USD_WAD = 1e14; // $0.0001
    uint256 internal constant MAX_DOUB_USD_WAD = 1e17; // $0.10

    // MegaETH mainnet (4326) — Kumbaya integrator-kit + default-token-list.
    address internal constant MEGAETH_KUMBAYA_FACTORY = 0x68b34591f662508076927803c567Cc8006988a09;
    address internal constant MEGAETH_DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
    address internal constant MEGAETH_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant MEGAETH_USDM = 0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7;
    uint24 internal constant MEGAETH_DOUB_WETH_FEE = 100;
    uint24 internal constant MEGAETH_WETH_USDM_FEE = 3000;

    struct Config {
        address factory;
        address doub;
        address weth;
        address usdm;
        uint24 doubWethFee;
        uint24 wethUsdmFee;
        uint32 twapSeconds;
        uint16 minObservationCardinality;
        uint16 maxSpotTwapDeviationBps;
        uint256 minDoubUsdWad;
        uint256 maxDoubUsdWad;
    }

    struct Result {
        uint256 doubUsdWad;
        uint256 charmPriceWad;
        uint256 minDoubSpendWad;
        uint256 maxDoubSpendWad;
        address doubWethPool;
        address wethUsdmPool;
        int24 doubWethTwapTick;
        int24 wethUsdmTwapTick;
        uint32 twapSeconds;
        uint256 blockNumber;
        uint256 chainId;
    }

    function megaethMainnetConfig() internal pure returns (Config memory cfg) {
        cfg = Config({
            factory: MEGAETH_KUMBAYA_FACTORY,
            doub: MEGAETH_DOUB,
            weth: MEGAETH_WETH,
            usdm: MEGAETH_USDM,
            doubWethFee: MEGAETH_DOUB_WETH_FEE,
            wethUsdmFee: MEGAETH_WETH_USDM_FEE,
            twapSeconds: SIR_TWAP_SECONDS,
            minObservationCardinality: MIN_OBSERVATION_CARDINALITY,
            maxSpotTwapDeviationBps: MAX_SPOT_TWAP_DEVIATION_BPS,
            minDoubUsdWad: MIN_DOUB_USD_WAD,
            maxDoubUsdWad: MAX_DOUB_USD_WAD
        });
    }

    function computeMegaethMainnet() public view returns (Result memory result) {
        return compute(megaethMainnetConfig());
    }

    function compute(Config memory cfg) public view returns (Result memory result) {
        result.chainId = block.chainid;
        result.blockNumber = block.number;
        result.twapSeconds = cfg.twapSeconds;

        address doubWethPool = IUniswapV3Factory(cfg.factory).getPool(cfg.doub, cfg.weth, cfg.doubWethFee);
        address wethUsdmPool = IUniswapV3Factory(cfg.factory).getPool(cfg.weth, cfg.usdm, cfg.wethUsdmFee);
        require(doubWethPool != address(0), "ArenaCharmPriceTwap: missing DOUB/WETH pool");
        require(wethUsdmPool != address(0), "ArenaCharmPriceTwap: missing WETH/USDm pool");
        result.doubWethPool = doubWethPool;
        result.wethUsdmPool = wethUsdmPool;

        _assertObservationCardinality(doubWethPool, cfg.minObservationCardinality);
        _assertObservationCardinality(wethUsdmPool, cfg.minObservationCardinality);

        result.doubWethTwapTick = OracleLibrary.consult(doubWethPool, cfg.twapSeconds);
        result.wethUsdmTwapTick = OracleLibrary.consult(wethUsdmPool, cfg.twapSeconds);

        _assertSpotTwapDeviation(doubWethPool, result.doubWethTwapTick, cfg.maxSpotTwapDeviationBps);
        _assertSpotTwapDeviation(wethUsdmPool, result.wethUsdmTwapTick, cfg.maxSpotTwapDeviationBps);

        uint256 wethPerDoub =
            OracleLibrary.getQuoteAtTick(result.doubWethTwapTick, uint128(WAD), cfg.doub, cfg.weth);
        require(wethPerDoub > 0, "ArenaCharmPriceTwap: zero DOUB/WETH");

        uint256 usdmPerDoub =
            OracleLibrary.getQuoteAtTick(result.wethUsdmTwapTick, uint128(wethPerDoub), cfg.weth, cfg.usdm);
        require(usdmPerDoub > 0, "ArenaCharmPriceTwap: zero DOUB/USD");

        require(usdmPerDoub >= cfg.minDoubUsdWad && usdmPerDoub <= cfg.maxDoubUsdWad, "ArenaCharmPriceTwap: doub USD band");

        result.doubUsdWad = usdmPerDoub;
        result.charmPriceWad = FullMath.mulDiv(WAD, WAD, usdmPerDoub);
        require(result.charmPriceWad > 0, "ArenaCharmPriceTwap: zero charm price");

        result.minDoubSpendWad = FullMath.mulDiv(CHARM_MIN_WAD, result.charmPriceWad, WAD);
        result.maxDoubSpendWad = FullMath.mulDiv(CHARM_MAX_WAD, result.charmPriceWad, WAD);
    }

    function _assertObservationCardinality(address pool, uint16 minCardinality) private view {
        (,,, uint16 observationCardinality,,,) = IUniswapV3Pool(pool).slot0();
        require(observationCardinality >= minCardinality, "ArenaCharmPriceTwap: low cardinality");
    }

    function _assertSpotTwapDeviation(address pool, int24 twapTick, uint16 maxDeviationBps) private view {
        (, int24 spotTick,,,,,) = IUniswapV3Pool(pool).slot0();
        uint256 twapPrice = _priceWadFromTick(twapTick);
        uint256 spotPrice = _priceWadFromTick(spotTick);
        uint256 deviationBps;
        if (twapPrice >= spotPrice) {
            deviationBps = FullMath.mulDiv(twapPrice - spotPrice, 10_000, twapPrice);
        } else {
            deviationBps = FullMath.mulDiv(spotPrice - twapPrice, 10_000, twapPrice);
        }
        require(deviationBps <= maxDeviationBps, "ArenaCharmPriceTwap: spot/TWAP deviation");
    }

    function _priceWadFromTick(int24 tick) private pure returns (uint256) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        return FullMath.mulDiv(uint256(sqrtRatioX96) * uint256(sqrtRatioX96), WAD, 1 << 192);
    }
}
