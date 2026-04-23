// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {DoubPresaleVesting} from "../src/vesting/DoubPresaleVesting.sol";

/// @notice Shared **implementation → ERC1967Proxy + initialize** helpers for core UUPS contracts (GitLab #54).
library UUPSDeployLib {
    function deployPodiumPool(address admin) internal returns (PodiumPool) {
        PodiumPool impl = new PodiumPool();
        bytes memory data = abi.encodeCall(PodiumPool.initialize, (admin));
        return PodiumPool(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployDoubLPIncentives(address admin) internal returns (DoubLPIncentives) {
        DoubLPIncentives impl = new DoubLPIncentives();
        bytes memory data = abi.encodeCall(DoubLPIncentives.initialize, (admin));
        return DoubLPIncentives(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployEcosystemTreasury(address admin) internal returns (EcosystemTreasury) {
        EcosystemTreasury impl = new EcosystemTreasury();
        bytes memory data = abi.encodeCall(EcosystemTreasury.initialize, (admin));
        return EcosystemTreasury(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployFeeRouter(address admin, address[5] memory destinations, uint16[5] memory weights)
        internal
        returns (FeeRouter)
    {
        FeeRouter impl = new FeeRouter();
        bytes memory data = abi.encodeCall(FeeRouter.initialize, (admin, destinations, weights));
        return FeeRouter(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployReferralRegistry(IERC20 cl8y, uint256 burnAmt, address initialOwner)
        internal
        returns (ReferralRegistry)
    {
        ReferralRegistry impl = new ReferralRegistry();
        bytes memory data = abi.encodeCall(ReferralRegistry.initialize, (cl8y, burnAmt, initialOwner));
        return ReferralRegistry(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployLinearCharmPrice(uint256 baseWad, uint256 dailyWad, address initialOwner)
        internal
        returns (LinearCharmPrice)
    {
        LinearCharmPrice impl = new LinearCharmPrice();
        bytes memory data = abi.encodeCall(LinearCharmPrice.initialize, (baseWad, dailyWad, initialOwner));
        return LinearCharmPrice(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployRabbitTreasury(
        IERC20 _reserveAsset,
        Doubloon _doub,
        uint256 _epochDuration,
        uint256 _cMaxWad,
        uint256 _cStarWad,
        uint256 _alphaWad,
        uint256 _betaWad,
        uint256 _mMinWad,
        uint256 _mMaxWad,
        uint256 _lamWad,
        uint256 _deltaMaxFracWad,
        uint256 _eps,
        uint256 _protocolRevenueBurnShareWad,
        uint256 _withdrawFeeWad,
        uint256 _minRedemptionEfficiencyWad,
        uint256 _redemptionCooldownEpochs,
        address _burnSink,
        address admin
    ) internal returns (RabbitTreasury) {
        RabbitTreasury impl = new RabbitTreasury();
        bytes memory data = abi.encodeCall(
            RabbitTreasury.initialize,
            (
                _reserveAsset,
                _doub,
                _epochDuration,
                _cMaxWad,
                _cStarWad,
                _alphaWad,
                _betaWad,
                _mMinWad,
                _mMaxWad,
                _lamWad,
                _deltaMaxFracWad,
                _eps,
                _protocolRevenueBurnShareWad,
                _withdrawFeeWad,
                _minRedemptionEfficiencyWad,
                _redemptionCooldownEpochs,
                _burnSink,
                admin
            )
        );
        return RabbitTreasury(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployTimeCurve(
        IERC20 _acceptedAsset,
        IERC20 _launchedToken,
        FeeRouter _feeRouter,
        PodiumPool _podiumPool,
        address _referralRegistry,
        ICharmPrice _charmPrice,
        uint256 _charmEnvelopeRefWad,
        uint256 _growthRateWad,
        uint256 _timerExtensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _totalTokensForSale,
        uint256 _buyCooldownSec,
        address upgradeAdmin
    ) internal returns (TimeCurve) {
        TimeCurve impl = new TimeCurve();
        bytes memory data = abi.encodeCall(
            TimeCurve.initialize,
            (
                _acceptedAsset,
                _launchedToken,
                _feeRouter,
                _podiumPool,
                _referralRegistry,
                _charmPrice,
                _charmEnvelopeRefWad,
                _growthRateWad,
                _timerExtensionSec,
                _initialTimerSec,
                _timerCapSec,
                _totalTokensForSale,
                _buyCooldownSec,
                upgradeAdmin
            )
        );
        return TimeCurve(payable(address(new ERC1967Proxy(address(impl), data))));
    }

    function deployDoubPresaleVesting(
        IERC20 doubToken,
        address initialOwner,
        address[] memory beneficiaries,
        uint256[] memory amounts,
        uint256 requiredTotalAllocation,
        uint256 vestingDurationSec
    ) internal returns (DoubPresaleVesting) {
        DoubPresaleVesting impl = new DoubPresaleVesting();
        bytes memory data = abi.encodeCall(
            DoubPresaleVesting.initialize,
            (doubToken, initialOwner, beneficiaries, amounts, requiredTotalAllocation, vestingDurationSec)
        );
        return DoubPresaleVesting(payable(address(new ERC1967Proxy(address(impl), data))));
    }
}
