// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeployProduction} from "../script/DeployProduction.s.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";

contract DeployProductionHarness is DeployProduction {
    function exposedResolveDoubAddress() external view returns (address, bool) {
        return _resolveDoubAddress();
    }
}

/// @dev GitLab #259 — production deploy reuses canonical MegaETH DOUB on 4326.
contract DeployProductionDoubTest is Test {
    address internal constant MEGAETH_DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;

    function test_resolveDoubAddress_paths() public {
        DeployProductionHarness deploy = new DeployProductionHarness();

        vm.chainId(4326);
        vm.etch(MEGAETH_DOUB, type(Doubloon).runtimeCode);
        (address doubAddr, bool deployFresh) = deploy.exposedResolveDoubAddress();
        assertEq(doubAddr, MEGAETH_DOUB);
        assertFalse(deployFresh);

        Doubloon custom = new Doubloon(address(this));
        vm.setEnv("DOUB_ADDRESS", vm.toString(address(custom)));
        (doubAddr, deployFresh) = deploy.exposedResolveDoubAddress();
        assertEq(doubAddr, address(custom));
        assertFalse(deployFresh);
    }
}
