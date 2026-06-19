// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @title DeployDev buy-energy pacing (Anvil / QA)
/// @notice Resolves `TimeArena.initialize` buy-energy parameters for [`DeployDev.s.sol`](./DeployDev.s.sol) from process environment ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88), #332).
/// @dev Production-like dev defaults remain 300s refill, 5 charges, 15s burst gap unless overridden.
library DeployDevBuyCooldown {
    uint256 internal constant DEFAULT_CHARGE_INTERVAL_SEC = 300;
    uint8 internal constant DEFAULT_MAX_BUY_CHARGES = 5;
    uint256 internal constant DEFAULT_BURST_COOLDOWN_SEC = 15;
    /// @notice When `YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`, local pacing defaults to dense QA values.
    uint256 internal constant NO_COOLDOWN_DEFAULT_SEC = 1;

    /// @param vm_ Foundry cheatcodes (`Script.vm` or `Test.vm`).
    function readBuyEnergyParams(Vm vm_)
        internal
        view
        returns (uint256 chargeIntervalSec, uint8 maxCharges, uint256 burstCooldownSec)
    {
        bool noCd = vm_.envOr("YIELDOMEGA_DEPLOY_NO_COOLDOWN", uint256(0)) == 1;
        if (noCd) {
            chargeIntervalSec = vm_.envOr("YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC", NO_COOLDOWN_DEFAULT_SEC);
            burstCooldownSec = vm_.envOr("YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC", NO_COOLDOWN_DEFAULT_SEC);
        } else {
            chargeIntervalSec =
                vm_.envOr("YIELDOMEGA_ANVIL_BUY_CHARGE_INTERVAL_SEC", DEFAULT_CHARGE_INTERVAL_SEC);
            burstCooldownSec =
                vm_.envOr("YIELDOMEGA_ANVIL_BURST_BUY_COOLDOWN_SEC", DEFAULT_BURST_COOLDOWN_SEC);
        }
        chargeIntervalSec = vm_.envOr("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", chargeIntervalSec);
        maxCharges = uint8(vm_.envOr("YIELDOMEGA_ANVIL_MAX_BUY_CHARGES", uint256(DEFAULT_MAX_BUY_CHARGES)));
        require(chargeIntervalSec > 0, "DeployDev: charge interval must be > 0");
        require(maxCharges > 0, "DeployDev: max charges must be > 0");
        require(burstCooldownSec > 0, "DeployDev: burst cooldown must be > 0");
    }
}
