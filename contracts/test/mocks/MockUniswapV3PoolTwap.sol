// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @dev Minimal V3 pool mock for TWAP unit tests (GitLab #303).
contract MockUniswapV3PoolTwap {
    address public immutable token0;
    address public immutable token1;
    int24 public spotTick;
    int24 public twapTick;
    uint16 public observationCardinality;

    constructor(address token0_, address token1_, int24 spotTick_, int24 twapTick_, uint16 cardinality_) {
        require(token0_ < token1_, "MockUniswapV3PoolTwap: token order");
        token0 = token0_;
        token1 = token1_;
        spotTick = spotTick_;
        twapTick = twapTick_;
        observationCardinality = cardinality_;
    }

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality_,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        tick = spotTick;
        observationCardinality_ = observationCardinality;
        observationCardinalityNext = observationCardinality;
        sqrtPriceX96 = 0;
        observationIndex = 0;
        feeProtocol = 0;
        unlocked = true;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
        int56 cumulative = int56(twapTick) * int56(uint56(block.timestamp));
        for (uint256 i; i < secondsAgos.length; ++i) {
            tickCumulatives[i] = cumulative - int56(twapTick) * int56(uint56(secondsAgos[i]));
        }
    }
}
