// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";

/// @notice Shared **implementation → ERC1967Proxy + initialize** helpers for Arena v2 UUPS contracts.
library UUPSDeployLib {
    function deployReferralRegistry(address initialOwner) internal returns (ReferralRegistry) {
        ReferralRegistry impl = new ReferralRegistry();
        bytes memory data = abi.encodeCall(ReferralRegistry.initialize, (initialOwner));
        return ReferralRegistry(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployPlayCred(address admin) internal returns (PlayCred) {
        return new PlayCred(admin);
    }

    function deployTimeArena(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        address _referralRegistry,
        address _playCred,
        uint256 _charmPriceWad,
        uint256[4] memory _podiumTimerExtensionSec,
        uint256[4] memory _podiumInitialTimerSec,
        uint256[4] memory _podiumTimerCapSec,
        uint256[4] memory _podiumResetBelowRemainingSec,
        uint256[4] memory _podiumResetToRemainingSec,
        uint256 _buyChargeIntervalSec,
        uint8 _maxBuyCharges,
        uint256 _burstBuyCooldownSec,
        address upgradeAdmin
    ) internal returns (TimeArena) {
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (
                _doub,
                _podiumVaults,
                _referralRegistry,
                _playCred,
                _charmPriceWad,
                _podiumTimerExtensionSec,
                _podiumInitialTimerSec,
                _podiumTimerCapSec,
                _podiumResetBelowRemainingSec,
                _podiumResetToRemainingSec,
                _buyChargeIntervalSec,
                _maxBuyCharges,
                _burstBuyCooldownSec,
                upgradeAdmin
            )
        );
        return TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    /// @dev Product defaults from `ArenaPodiumTimerConfig` (GitLab #271).
    function deployTimeArenaProductionDefaults(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        address _referralRegistry,
        address _playCred,
        uint256 _charmPriceWad,
        uint256 _buyChargeIntervalSec,
        uint8 _maxBuyCharges,
        uint256 _burstBuyCooldownSec,
        address upgradeAdmin
    ) internal returns (TimeArena) {
        (
            uint256[4] memory ext,
            uint256[4] memory init,
            uint256[4] memory cap,
            uint256[4] memory below,
            uint256[4] memory to
        ) = ArenaPodiumTimerConfig.getProductionDefaults();
        return deployTimeArena(
            _doub,
            _podiumVaults,
            _referralRegistry,
            _playCred,
            _charmPriceWad,
            ext,
            init,
            cap,
            below,
            to,
            _buyChargeIntervalSec,
            _maxBuyCharges,
            _burstBuyCooldownSec,
            upgradeAdmin
        );
    }
}
