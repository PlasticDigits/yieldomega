// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

/// @dev Deployer broadcasts owner-only wiring; final admin may differ (GitLab #259).
contract DeployProductionOwnershipTest is Test {
    function test_wiring_and_handoff_when_admin_differs_from_deployer() public {
        address deployer = address(this);
        address admin = makeAddr("finalAdmin");

        Doubloon doub = new Doubloon(deployer);
        PodiumVaults podiumVaults = new PodiumVaults(doub, deployer);
        ReferralRegistry referralRegistry = UUPSDeployLib.deployReferralRegistry(deployer);
        PlayCred playCred = UUPSDeployLib.deployPlayCred(deployer);
        TimeArena arena = UUPSDeployLib.deployTimeArenaProductionDefaults(
            doub,
            podiumVaults,
            address(referralRegistry),
            address(playCred),
            1000e18,
            300,
            5,
            15,
            deployer
        );

        podiumVaults.setArena(address(arena));
        referralRegistry.setTimeArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));

        vm.startPrank(deployer);
        podiumVaults.transferOwnership(admin);
        referralRegistry.transferOwnership(admin);
        arena.transferOwnership(admin);
        bytes32 adminRole = playCred.DEFAULT_ADMIN_ROLE();
        playCred.grantRole(adminRole, admin);
        playCred.renounceRole(adminRole, deployer);
        vm.stopPrank();

        assertEq(podiumVaults.owner(), admin);
        assertEq(referralRegistry.owner(), deployer);
        assertEq(referralRegistry.pendingOwner(), admin);
        assertEq(arena.owner(), deployer);
        assertEq(arena.pendingOwner(), admin);
        assertTrue(playCred.hasRole(playCred.DEFAULT_ADMIN_ROLE(), admin));
        assertFalse(playCred.hasRole(playCred.DEFAULT_ADMIN_ROLE(), deployer));
        assertTrue(playCred.hasRole(playCred.MINTER_ROLE(), address(arena)));
    }
}
