// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArenaCharmPriceTwap} from "../src/oracle/ArenaCharmPriceTwap.sol";

/// @notice Dry-run TWAP charm price for MegaETH production deploy (GitLab #303).
contract ComputeArenaCharmPriceTwap is Script {
    function run() external view {
        require(block.chainid == 4326, "ComputeArenaCharmPriceTwap: MegaETH mainnet only");
        ArenaCharmPriceTwap.Result memory r = ArenaCharmPriceTwap.computeMegaethMainnet();
        console.log("chainId", r.chainId);
        console.log("blockNumber", r.blockNumber);
        console.log("twapSeconds", r.twapSeconds);
        console.log("doubCl8yPool", r.doubCl8yPool);
        console.log("cl8yWethPool", r.cl8yWethPool);
        console.log("wethUsdmPool", r.wethUsdmPool);
        console.log("doubUsdWad", r.doubUsdWad);
        console.log("charmPriceWad", r.charmPriceWad);
        console.log("minDoubSpendWad", r.minDoubSpendWad);
        console.log("maxDoubSpendWad", r.maxDoubSpendWad);
    }
}
