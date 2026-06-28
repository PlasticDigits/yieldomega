// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeployProduction} from "../script/DeployProduction.s.sol";

/// @dev GitLab #303 — fail-closed when TWAP/override unavailable off MegaETH mainnet.
contract DeployProductionCharmPriceTest is Test {
    function test_run_reverts_without_override_off_megaeth() public {
        vm.setEnv("PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        vm.setEnv("ARENA_CHARM_PRICE_WAD", "0");

        DeployProduction deploy = new DeployProduction();
        vm.expectRevert("DeployProduction: set ARENA_CHARM_PRICE_WAD");
        deploy.run();
    }
}
