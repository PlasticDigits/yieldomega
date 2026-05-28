// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UUPSDeployLib} from "./UUPSDeployLib.sol";

/// @notice Production deploy for Arena v2 (MegaETH). Set env vars before broadcast.
contract DeployProduction is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address reserveAsset = vm.envAddress("RESERVE_ASSET_ADDRESS");

        vm.startBroadcast(deployerKey);

        Doubloon doub = new Doubloon(deployer);
        PodiumVaults podiumVaults = new PodiumVaults(doub, deployer);
        AdminSellVault adminVault = new AdminSellVault(doub, deployer);

        ReferralRegistry referralRegistry =
            UUPSDeployLib.deployReferralRegistry(IERC20(reserveAsset), vm.envUint("REFERRAL_REGISTRATION_BURN"), deployer);

        PlayCred playCred = UUPSDeployLib.deployPlayCred(deployer);

        TimeArena arena = UUPSDeployLib.deployTimeArena(
            doub,
            podiumVaults,
            adminVault,
            address(referralRegistry),
            address(playCred),
            vm.envUint("ARENA_CHARM_PRICE_WAD"),
            vm.envUint("ARENA_TIMER_EXTENSION_SEC"),
            vm.envUint("ARENA_INITIAL_TIMER_SEC"),
            vm.envUint("ARENA_TIMER_CAP_SEC"),
            vm.envUint("ARENA_BUY_COOLDOWN_SEC"),
            deployer
        );
        podiumVaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));

        console.log("Doubloon:", address(doub));
        console.log("PlayCred:", address(playCred));
        console.log("PodiumVaults:", address(podiumVaults));
        console.log("AdminSellVault:", address(adminVault));
        console.log("ReferralRegistry:", address(referralRegistry));
        console.log("TimeArena:", address(arena));

        vm.stopBroadcast();
    }
}
