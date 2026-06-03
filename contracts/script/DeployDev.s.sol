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
/// @dev TimeArenaBuyRouter is deployed separately via `DeployKumbayaAnvilFixtures` when
///      `YIELDOMEGA_DEPLOY_KUMBAYA=1` (GitLab #270). See `scripts/lib/anvil_deploy_dev.sh`.
///      Per-podium timer params use production table via `ArenaPodiumTimerConfig` (#271).
contract DeployDev is Script {
    /// @dev Playwright mock wallet (Anvil account #0) — E2E #269.
    address internal constant E2E_MOCK_WALLET = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

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
        MockReserveCl8y mock;
        if (reserveAsset == address(0)) {
            mock = new MockReserveCl8y();
            reserveAsset = address(mock);
            console.log("MockReserveCl8y:", reserveAsset);
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
        TimeArena arena = UUPSDeployLib.deployTimeArenaProductionDefaults(
            doub,
            podiumVaults,
            adminVault,
            address(referralRegistry),
            address(playCred),
            1000e18,
            buyCooldownSecDev,
            deployer
        );
        podiumVaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), deployer);
        playCred.mint(E2E_MOCK_WALLET, 1000e18);
        arena.startArena();
        console.log("TimeArena:", address(arena));
        console.log("TimeArena buyCooldownSec (dev deploy):", buyCooldownSecDev);

        doub.grantRole(doub.MINTER_ROLE(), deployer);
        address seedMinter = vm.envOr("YIELDOMEGA_SEED_MINTER_ADDRESS", address(0));
        if (seedMinter != address(0) && seedMinter != deployer) {
            doub.grantRole(doub.MINTER_ROLE(), seedMinter);
            playCred.grantRole(playCred.MINTER_ROLE(), seedMinter);
            console.log("Extra dev seed minter (GitLab #281):", seedMinter);
        }
        doub.mint(deployer, 10_000_000e18);
        doub.mint(E2E_MOCK_WALLET, 1_000_000e18);
        console.log("Doubloon MINTER_ROLE granted to deployer for local QA");

        if (address(mock) != address(0)) {
            mock.mint(E2E_MOCK_WALLET, 100_000e18);
            mock.mint(deployer, 100_000e18);
            console.log("E2E mock wallet seeded with MockReserveCl8y");
        }

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
