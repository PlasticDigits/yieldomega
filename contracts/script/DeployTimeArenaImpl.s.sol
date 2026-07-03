// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";

/// @notice Deploy a fresh TimeArena UUPS implementation (logic only — no proxy).
/// @dev `forge script` auto-links `ArenaCharmPriceTwap`. Owner upgrades the live proxy via
///      `upgradeToAndCall(newImpl, 0x)` then optional `setPodiumTimerConfig`.
contract DeployTimeArenaImpl is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        new TimeArena();
        vm.stopBroadcast();
    }
}
