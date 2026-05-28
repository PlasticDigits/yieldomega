// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";

/// @notice Shared **implementation → ERC1967Proxy + initialize** helpers for Arena v2 UUPS contracts.
library UUPSDeployLib {
    function deployReferralRegistry(IERC20 cl8y, uint256 burnAmt, address initialOwner)
        internal
        returns (ReferralRegistry)
    {
        ReferralRegistry impl = new ReferralRegistry();
        bytes memory data = abi.encodeCall(ReferralRegistry.initialize, (cl8y, burnAmt, initialOwner));
        return ReferralRegistry(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployTimeArena(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        AdminSellVault _adminSellVault,
        address _referralRegistry,
        uint256 _charmPriceWad,
        uint256 _timerExtensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _buyCooldownSec,
        address upgradeAdmin
    ) internal returns (TimeArena) {
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (
                _doub,
                _podiumVaults,
                _adminSellVault,
                _referralRegistry,
                _charmPriceWad,
                _timerExtensionSec,
                _initialTimerSec,
                _timerCapSec,
                _buyCooldownSec,
                upgradeAdmin
            )
        );
        return TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
    }
}
