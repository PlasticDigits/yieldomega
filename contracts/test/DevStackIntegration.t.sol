// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";
import {DeployDevBuyCooldown} from "../script/DeployDevBuyCooldown.sol";

/// @dev Minimal CL8Y stand-in for DeployDev wiring tests.
contract MockReserveCl8yTest is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 1_000_000e18);
    }
}

/// @notice Verifies Arena v2 DeployDev wiring invariants (GitLab #259).
contract DevStackIntegrationTest is Test {
    address internal deployer = address(this);
    address internal player = address(0xBEEF);

    Doubloon doub;
    PodiumVaults podiumVaults;
    AdminSellVault adminVault;
    ReferralRegistry referralRegistry;
    PlayCred playCred;
    TimeArena arena;
    MockReserveCl8yTest reserve;

    function setUp() public {
        reserve = new MockReserveCl8yTest();

        doub = new Doubloon(deployer);
        podiumVaults = new PodiumVaults(doub, deployer);
        adminVault = new AdminSellVault(doub, deployer);
        referralRegistry = UUPSDeployLib.deployReferralRegistry(IERC20(address(reserve)), 1e18, deployer);
        playCred = UUPSDeployLib.deployPlayCred(deployer);

        uint256 buyCooldownSec = DeployDevBuyCooldown.readBuyCooldownSec(vm);
        arena = UUPSDeployLib.deployTimeArenaProductionDefaults(
            doub,
            podiumVaults,
            adminVault,
            address(referralRegistry),
            address(playCred),
            1000e18,
            buyCooldownSec,
            deployer
        );

        podiumVaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), deployer);
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), deployer);
        doub.mint(player, 100_000e18);
        playCred.mint(player, 500e18);
    }

    function test_deployDev_wiring_podiumVaults_point_at_arena() public view {
        assertEq(podiumVaults.arena(), address(arena));
    }

    function test_deployDev_wiring_adminVault_points_at_arena() public view {
        assertEq(adminVault.arena(), address(arena));
    }

    function test_deployDev_wiring_playCred_minter_granted_to_arena() public view {
        assertTrue(playCred.hasRole(playCred.MINTER_ROLE(), address(arena)));
    }

    function test_deployDev_wiring_arena_is_live() public view {
        assertGt(arena.arenaStart(), 0);
        assertFalse(arena.paused());
    }

    function test_deployDev_wiring_referral_registry_reserve() public view {
        assertEq(address(referralRegistry.cl8yToken()), address(reserve));
    }

    function test_deployDev_wiring_buyCooldown_default_300() public view {
        assertEq(arena.buyCooldownSec(), 300);
    }
}
