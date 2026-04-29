// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @title DeployDev buy cooldown (Anvil / QA)
/// @notice Resolves `TimeCurve.initialize` **`_buyCooldownSec`** for [`DeployDev.s.sol`](./DeployDev.s.sol) from process environment ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
/// @dev `TimeCurve` requires **`buyCooldownSec > 0`** at init; production-like dev default remains **300** seconds unless overridden.
library DeployDevBuyCooldown {
    /// @notice Default per-wallet buy spacing for local **`DeployDev`** when no QA flags are set (matches historical `DeployDev.s.sol` literal).
    uint256 internal constant DEFAULT_COOLDOWN_SEC = 300;
    /// @notice When `YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`, default override before optional numeric tuning (must stay **> 0** onchain).
    uint256 internal constant NO_COOLDOWN_DEFAULT_SEC = 1;

    /// @param vm_ Foundry cheatcodes (`Script.vm` or `Test.vm`).
    /// @return cdSec Value passed into `UUPSDeployLib.deployTimeCurve` as `_buyCooldownSec`.
    function readBuyCooldownSec(Vm vm_) internal view returns (uint256 cdSec) {
        bool noCd = vm_.envOr("YIELDOMEGA_DEPLOY_NO_COOLDOWN", uint256(0)) == 1;
        if (noCd) {
            cdSec = vm_.envOr("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", NO_COOLDOWN_DEFAULT_SEC);
        } else {
            cdSec = vm_.envOr("YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC", DEFAULT_COOLDOWN_SEC);
        }
        require(cdSec > 0, "DeployDev: buy cooldown sec must be > 0");
    }
}
