// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UUPSDeployLib} from "./UUPSDeployLib.sol";
import {DeployDevBuyCooldown} from "./DeployDevBuyCooldown.sol";
import {DevOnlyChainGuard} from "./DevOnlyChainGuard.sol";

/// @notice Deploy Arena v2 core contracts to dev/local Anvil.
contract DeployDev is Script {
    function run() external {
        DevOnlyChainGuard.assertDevScriptChain();
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        address reserveAsset = vm.envOr("RESERVE_ASSET_ADDRESS", address(0));
        if (reserveAsset == address(0)) {
            reserveAsset = vm.envOr("USDM_ADDRESS", address(0));
        }
        if (reserveAsset == address(0)) {
            MockReserveCl8y mock = new MockReserveCl8y();
            reserveAsset = address(mock);
            console.log("MockReserveCl8y deployed (dev only):", reserveAsset);
        }

        Doubloon doub = new Doubloon(deployer);
        console.log("Doubloon:", address(doub));

        PodiumVaults podiumVaults = new PodiumVaults(doub, deployer);
        AdminSellVault adminVault = new AdminSellVault(doub, deployer);
        console.log("PodiumVaults:", address(podiumVaults));
        console.log("AdminSellVault:", address(adminVault));

        ReferralRegistry referralRegistry = UUPSDeployLib.deployReferralRegistry(IERC20(reserveAsset), 1e18, deployer);
        console.log("ReferralRegistry:", address(referralRegistry));

        PlayCred playCred = UUPSDeployLib.deployPlayCred(deployer);
        console.log("PlayCred:", address(playCred));

        uint256 buyCooldownSecDev = DeployDevBuyCooldown.readBuyCooldownSec(vm);
        TimeArena arena = UUPSDeployLib.deployTimeArena(
            doub,
            podiumVaults,
            adminVault,
            address(referralRegistry),
            address(playCred),
            1000e18,
            120,
            86_400,
            4 * 86_400,
            buyCooldownSecDev,
            deployer
        );
        podiumVaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));
        // Anvil default account #0 — Playwright mock wallet (E2E #269).
        playCred.grantRole(playCred.MINTER_ROLE(), deployer);
        playCred.mint(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 1000e18);
        arena.startArena();
        console.log("TimeArena:", address(arena));
        console.log("TimeArena buyCooldownSec (dev deploy):", buyCooldownSecDev);

        doub.grantRole(doub.MINTER_ROLE(), deployer);
        doub.mint(deployer, 10_000_000e18);
        console.log("Doubloon MINTER_ROLE granted to deployer for local QA");

        vm.stopBroadcast();

        console.log("\n--- Copy addresses into deployments/dev-addresses.example.json ---");
    }
}

contract MockReserveCl8y is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
