// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @dev Factory mock returning pre-registered pools for TWAP tests.
contract MockUniswapV3Factory {
    mapping(bytes32 => address) internal pools;

    function setPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pools[keccak256(abi.encode(token0, token1, fee))] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return pools[keccak256(abi.encode(token0, token1, fee))];
    }
}
