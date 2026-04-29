// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {DeployDevBuyCooldown} from "../script/DeployDevBuyCooldown.sol";

/// @dev External entry so `vm.expectRevert` sees a clear external revert boundary.
contract DeployDevBuyCooldownHarness {
    function readBuyCooldownSec(Vm vm_) external view returns (uint256) {
        return DeployDevBuyCooldown.readBuyCooldownSec(vm_);
    }
}

/// @notice Unit tests for [`DeployDevBuyCooldown`](../script/DeployDevBuyCooldown.sol) env resolution ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
/// @dev All `vm.setEnv` cases run in **one** test so Foundry’s parallel test scheduling cannot interleave env mutations for this contract.
contract DeployDevBuyCooldownTest is Test {
    DeployDevBuyCooldownHarness internal harness = new DeployDevBuyCooldownHarness();

    function test_constants_match_documented_defaults() public {
        assertEq(DeployDevBuyCooldown.DEFAULT_COOLDOWN_SEC, 300);
        assertEq(DeployDevBuyCooldown.NO_COOLDOWN_DEFAULT_SEC, 1);
    }

    function test_readBuyCooldownSec_env_resolution_matrix() public {
        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "0");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "300");
        assertEq(DeployDevBuyCooldown.readBuyCooldownSec(vm), 300, "flag off + explicit 300");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "0");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "60");
        assertEq(DeployDevBuyCooldown.readBuyCooldownSec(vm), 60, "flag off + explicit 60");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "1");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "1");
        assertEq(DeployDevBuyCooldown.readBuyCooldownSec(vm), 1, "no-cd branch explicit 1 (matches unset default in clean shell)");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "1");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "5");
        assertEq(DeployDevBuyCooldown.readBuyCooldownSec(vm), 5, "no-cd + custom");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "0");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "0");
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "DeployDev: buy cooldown sec must be > 0"));
        harness.readBuyCooldownSec(vm);
    }
}
