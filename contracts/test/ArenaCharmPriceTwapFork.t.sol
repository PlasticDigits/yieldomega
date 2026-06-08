// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ArenaCharmPriceTwap} from "../src/oracle/ArenaCharmPriceTwap.sol";
import {IUniswapV3Factory} from "../src/oracle/v3/IUniswapV3Factory.sol";

/// @dev Optional MegaETH fork TWAP smoke (GitLab #303). Skips when `FORK_URL` unset or DOUB/WETH pool missing.
contract ArenaCharmPriceTwapForkTest is Test {
    function test_fork_megaeth_twap_charm_price() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) {
            url = vm.envOr("MEGAETH_RPC", string(""));
        }
        if (bytes(url).length == 0) {
            return;
        }
        vm.createSelectFork(url);
        if (block.chainid != 4326) {
            return;
        }

        address factory = 0x68b34591f662508076927803c567Cc8006988a09;
        address doub = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
        address weth = 0x4200000000000000000000000000000000000006;
        address doubWethPool = IUniswapV3Factory(factory).getPool(doub, weth, 100);
        if (doubWethPool == address(0)) {
            console.log("SKIP: DOUB/WETH pool not deployed on fork head");
            return;
        }

        ArenaCharmPriceTwap.Result memory r = ArenaCharmPriceTwap.computeMegaethMainnet();
        console.log("doubUsdWad", r.doubUsdWad);
        console.log("charmPriceWad", r.charmPriceWad);
        console.log("minDoubSpendWad", r.minDoubSpendWad);
        console.log("maxDoubSpendWad", r.maxDoubSpendWad);
        assertGt(r.charmPriceWad, 0);
        assertEq(r.minDoubSpendWad, (99e16 * r.charmPriceWad) / 1e18);
        assertEq(r.maxDoubSpendWad, (10e18 * r.charmPriceWad) / 1e18);
    }
}
