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
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";

/// @notice Production deploy for Arena v2 (MegaETH). Set env vars before broadcast.
/// @dev No retired v1 NFT/treasury/presale/TimeCurve/FeeRouter — GitLab #259.
///      Per-podium timers: product table in `ArenaPodiumTimerConfig`; optional env overrides per category (#271).
contract DeployProduction is Script {
    uint256 internal constant DEFAULT_CHARM_PRICE_WAD = 1000e18;
    uint256 internal constant DEFAULT_BUY_COOLDOWN_SEC = 300;
    uint256 internal constant DEFAULT_REFERRAL_BURN_WAD = 1e18;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("DEPLOY_ADMIN_ADDRESS", deployer);
        address reserveAsset = vm.envAddress("RESERVE_ASSET_ADDRESS");

        uint256 charmPriceWad = vm.envOr("ARENA_CHARM_PRICE_WAD", DEFAULT_CHARM_PRICE_WAD);
        uint256 buyCooldownSec = vm.envOr("ARENA_BUY_COOLDOWN_SEC", DEFAULT_BUY_COOLDOWN_SEC);
        uint256 referralBurnWad = vm.envOr("REFERRAL_REGISTRATION_BURN_WAD", DEFAULT_REFERRAL_BURN_WAD);
        bool startArenaNow = vm.envOr("START_ARENA", uint256(0)) == 1;

        (
            uint256[4] memory ext,
            uint256[4] memory init,
            uint256[4] memory cap,
            uint256[4] memory below,
            uint256[4] memory to
        ) = ArenaPodiumTimerConfig.getProductionDefaults();

        ext[0] = vm.envOr("ARENA_PODIUM_0_TIMER_EXTENSION_SEC", ext[0]);
        ext[1] = vm.envOr("ARENA_PODIUM_1_TIMER_EXTENSION_SEC", ext[1]);
        ext[2] = vm.envOr("ARENA_PODIUM_2_TIMER_EXTENSION_SEC", ext[2]);
        ext[3] = vm.envOr("ARENA_PODIUM_3_TIMER_EXTENSION_SEC", ext[3]);
        init[0] = vm.envOr("ARENA_PODIUM_0_INITIAL_TIMER_SEC", init[0]);
        init[1] = vm.envOr("ARENA_PODIUM_1_INITIAL_TIMER_SEC", init[1]);
        init[2] = vm.envOr("ARENA_PODIUM_2_INITIAL_TIMER_SEC", init[2]);
        init[3] = vm.envOr("ARENA_PODIUM_3_INITIAL_TIMER_SEC", init[3]);
        cap[0] = vm.envOr("ARENA_PODIUM_0_TIMER_CAP_SEC", cap[0]);
        cap[1] = vm.envOr("ARENA_PODIUM_1_TIMER_CAP_SEC", cap[1]);
        cap[2] = vm.envOr("ARENA_PODIUM_2_TIMER_CAP_SEC", cap[2]);
        cap[3] = vm.envOr("ARENA_PODIUM_3_TIMER_CAP_SEC", cap[3]);

        vm.startBroadcast(deployerKey);

        Doubloon doub = new Doubloon(admin);
        PodiumVaults podiumVaults = new PodiumVaults(doub, admin);
        AdminSellVault adminVault = new AdminSellVault(doub, admin);

        ReferralRegistry referralRegistry =
            UUPSDeployLib.deployReferralRegistry(IERC20(reserveAsset), referralBurnWad, admin);

        PlayCred playCred = UUPSDeployLib.deployPlayCred(admin);

        TimeArena arena = UUPSDeployLib.deployTimeArena(
            doub,
            podiumVaults,
            adminVault,
            address(referralRegistry),
            address(playCred),
            charmPriceWad,
            ext,
            init,
            cap,
            below,
            to,
            buyCooldownSec,
            admin
        );
        podiumVaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));

        if (startArenaNow) {
            arena.startArena();
        }

        console.log("Doubloon:", address(doub));
        console.log("PlayCred:", address(playCred));
        console.log("PodiumVaults:", address(podiumVaults));
        console.log("AdminSellVault:", address(adminVault));
        console.log("ReferralRegistry:", address(referralRegistry));
        console.log("TimeArena:", address(arena));
        console.log("Deploy admin:", admin);
        console.log("Arena started:", startArenaNow);

        vm.stopBroadcast();
    }
}
