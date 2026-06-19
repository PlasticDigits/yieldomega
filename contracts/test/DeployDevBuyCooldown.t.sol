// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {DeployDevBuyCooldown} from "../script/DeployDevBuyCooldown.sol";

/// @dev External entry so `vm.expectRevert` sees a clear external revert boundary.
contract DeployDevBuyCooldownHarness {
    function readBuyEnergyParams(Vm vm_) external view returns (uint256, uint8, uint256) {
        return DeployDevBuyCooldown.readBuyEnergyParams(vm_);
    }
}

/// @notice Unit tests for [`DeployDevBuyCooldown`](../script/DeployDevBuyCooldown.sol) env resolution ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
/// @dev All `vm.setEnv` cases run in **one** test so Foundry’s parallel test scheduling cannot interleave env mutations for this contract.
contract DeployDevBuyCooldownTest is Test {
    DeployDevBuyCooldownHarness internal harness = new DeployDevBuyCooldownHarness();

    function test_constants_match_documented_defaults() public {
        assertEq(DeployDevBuyCooldown.DEFAULT_CHARGE_INTERVAL_SEC, 300);
        assertEq(DeployDevBuyCooldown.DEFAULT_MAX_BUY_CHARGES, 5);
        assertEq(DeployDevBuyCooldown.DEFAULT_BURST_COOLDOWN_SEC, 15);
        assertEq(DeployDevBuyCooldown.NO_COOLDOWN_DEFAULT_SEC, 1);
    }

    function test_readBuyEnergyParams_env_resolution_matrix() public {
        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "0");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "300");
        (uint256 interval, uint8 cap, uint256 burst) = DeployDevBuyCooldown.readBuyEnergyParams(vm);
        assertEq(interval, 300, "compat interval");
        assertEq(cap, 5, "default cap");
        assertEq(burst, 15, "default burst");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "0");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC", "60");
        vm.setEnv("YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC", "12");
        vm.setEnv("YIELDOMEGA_ANVIL_MAX_BUY_CHARGES", "4");
        (interval, cap, burst) = DeployDevBuyCooldown.readBuyEnergyParams(vm);
        assertEq(interval, 300, "legacy alias wins when set");
        assertEq(cap, 4, "custom cap");
        assertEq(burst, 12, "custom burst");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "1");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "1");
        (interval, cap, burst) = DeployDevBuyCooldown.readBuyEnergyParams(vm);
        assertEq(interval, 1, "no-cd interval");
        assertEq(cap, 4, "cap remains explicit");
        assertEq(burst, 12, "burst remains explicit");

        vm.setEnv("YIELDOMEGA_DEPLOY_NO_COOLDOWN", "1");
        vm.setEnv("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", "5");
        (interval,,) = DeployDevBuyCooldown.readBuyEnergyParams(vm);
        assertEq(interval, 5, "no-cd + legacy custom interval");

        (interval, cap, burst) = harness.readBuyEnergyParams(vm);
        assertEq(interval, 5, "external harness reads tuple");
        assertEq(cap, 4, "external harness cap");
        assertEq(burst, 12, "external harness burst");
    }
}
