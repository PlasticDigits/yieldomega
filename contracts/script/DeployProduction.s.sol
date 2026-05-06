// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {RabbitTreasuryVault} from "../src/sinks/RabbitTreasuryVault.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {DoubPresaleVesting} from "../src/vesting/DoubPresaleVesting.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";
import {UUPSDeployLib} from "./UUPSDeployLib.sol";

/// @notice Production-oriented deployment for core YieldOmega contracts.
/// @dev The companion shell wrapper supplies PRIVATE_KEY, SALE_START_EPOCH, and MegaETH defaults.
///      This script deliberately does not deploy mock tokens and is not guarded to dev chains.
contract DeployProduction is Script {
    address internal constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;
    address internal constant CL8Y_MANAGER = 0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c;

    struct Deployment {
        address deployer;
        address admin;
        address reserveAsset;
        Doubloon doub;
        PodiumPool podiumPool;
        DoubLPIncentives doubLP;
        EcosystemTreasury ecosystemTreasury;
        address rabbitFeeSink;
        RabbitTreasuryVault rabbitTreasuryVault;
        RabbitTreasury rabbitTreasury;
        FeeRouter feeRouter;
        ReferralRegistry referralRegistry;
        LinearCharmPrice charmPrice;
        TimeCurve timeCurve;
        DoubPresaleVesting presaleVesting;
        LeprechaunNFT leprechaunNFT;
        TimeCurveBuyRouter timeCurveBuyRouter;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("DEPLOY_ADMIN_ADDRESS", CL8Y_MANAGER);
        require(admin != address(0), "DeployProduction: zero admin");

        Deployment memory d;
        d.deployer = deployer;
        d.admin = admin;
        d.reserveAsset = vm.envAddress("RESERVE_ASSET_ADDRESS");
        require(d.reserveAsset != address(0), "DeployProduction: zero reserve");

        uint256 saleStartEpoch = vm.envUint("SALE_START_EPOCH");
        uint256 totalTokensForSale = vm.envOr("TOTAL_TOKENS_FOR_SALE_WAD", uint256(200_000_000e18));
        uint256 buyCooldownSec = vm.envOr("TIMECURVE_BUY_COOLDOWN_SEC", uint256(300));
        string memory nftBaseUri = vm.envOr("LEPRECHAUN_BASE_URI", string(""));

        vm.startBroadcast(deployerKey);

        d.doub = new Doubloon(deployer);

        d.podiumPool = UUPSDeployLib.deployPodiumPool(deployer);
        d.doubLP = UUPSDeployLib.deployDoubLPIncentives(deployer);
        d.ecosystemTreasury = UUPSDeployLib.deployEcosystemTreasury(deployer);

        d.rabbitTreasury = UUPSDeployLib.deployRabbitTreasury(
            IERC20(d.reserveAsset),
            d.doub,
            86_400,
            2e18,
            1_050_000_000_000_000_000,
            2e16,
            2e18,
            98e16,
            102e16,
            5e17,
            2e16,
            1,
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            deployer
        );
        d.doub.grantRole(d.doub.MINTER_ROLE(), address(d.rabbitTreasury));
        d.rabbitTreasury.grantRole(d.rabbitTreasury.FEE_ROUTER_ROLE(), deployer);

        address configuredRabbitFeeSink = vm.envOr("RABBIT_FEE_SINK_ADDRESS", address(0));
        if (configuredRabbitFeeSink == address(0)) {
            d.rabbitTreasuryVault = new RabbitTreasuryVault(admin);
            d.rabbitFeeSink = address(d.rabbitTreasuryVault);
        } else {
            d.rabbitFeeSink = configuredRabbitFeeSink;
        }
        require(d.rabbitFeeSink != address(0), "DeployProduction: zero rabbit sink");

        d.feeRouter = UUPSDeployLib.deployFeeRouter(
            deployer,
            [address(d.doubLP), BURN_SINK, address(d.podiumPool), address(d.ecosystemTreasury), d.rabbitFeeSink],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        d.rabbitTreasury.grantRole(d.rabbitTreasury.FEE_ROUTER_ROLE(), address(d.feeRouter));
        d.rabbitTreasury.renounceRole(d.rabbitTreasury.FEE_ROUTER_ROLE(), deployer);
        d.feeRouter.setDistributableToken(IERC20(d.reserveAsset), true);

        d.referralRegistry = UUPSDeployLib.deployReferralRegistry(
            IERC20(d.reserveAsset), vm.envOr("REFERRAL_REGISTRATION_BURN_WAD", uint256(1e18)), deployer
        );

        d.charmPrice = UUPSDeployLib.deployLinearCharmPrice(
            vm.envOr("CHARM_PRICE_BASE_WAD", uint256(1e18)),
            vm.envOr("CHARM_PRICE_DAILY_INCREMENT_WAD", uint256(1e17)),
            deployer
        );

        d.timeCurve = UUPSDeployLib.deployTimeCurve(
            IERC20(d.reserveAsset),
            IERC20(address(d.doub)),
            d.feeRouter,
            d.podiumPool,
            address(d.referralRegistry),
            ICharmPrice(address(d.charmPrice)),
            vm.envOr("CHARM_ENVELOPE_REF_WAD", uint256(1e18)),
            vm.envOr("CHARM_GROWTH_RATE_WAD", uint256(182_321_556_793_954_592)),
            vm.envOr("TIMECURVE_TIMER_EXTENSION_SEC", uint256(120)),
            vm.envOr("TIMECURVE_INITIAL_TIMER_SEC", uint256(86_400)),
            vm.envOr("TIMECURVE_TIMER_CAP_SEC", uint256(4 * 86_400)),
            totalTokensForSale,
            buyCooldownSec,
            deployer
        );

        d.doub.grantRole(d.doub.MINTER_ROLE(), deployer);
        d.doub.mint(address(d.timeCurve), totalTokensForSale);
        d.podiumPool.setPrizePusher(address(d.timeCurve));
        d.timeCurve.setPodiumResidualRecipient(address(d.ecosystemTreasury));
        d.timeCurve.setUnredeemedLaunchedTokenRecipient(address(d.ecosystemTreasury));

        d.presaleVesting = _maybeDeployPresaleVesting(d);
        if (address(d.presaleVesting) != address(0)) {
            d.timeCurve.setDoubPresaleVesting(address(d.presaleVesting));
        }

        d.timeCurveBuyRouter = _maybeDeployTimeCurveBuyRouter(d);
        if (address(d.timeCurveBuyRouter) != address(0)) {
            d.timeCurve.setTimeCurveBuyRouter(address(d.timeCurveBuyRouter));
        }

        d.rabbitTreasury.openFirstEpoch();
        d.timeCurve.startSaleAt(saleStartEpoch);

        d.doub.revokeRole(d.doub.MINTER_ROLE(), deployer);
        d.leprechaunNFT = new LeprechaunNFT("Leprechaun", "LEPR", nftBaseUri, deployer);

        _handoff(d);

        vm.stopBroadcast();

        _log(d, saleStartEpoch, totalTokensForSale);
    }

    function _maybeDeployPresaleVesting(Deployment memory d) internal returns (DoubPresaleVesting) {
        string memory rawBeneficiaries = vm.envOr("PRESALE_BENEFICIARIES", string(""));
        if (bytes(rawBeneficiaries).length == 0) {
            return DoubPresaleVesting(address(0));
        }

        address[] memory beneficiaries = vm.envAddress("PRESALE_BENEFICIARIES", ",");
        uint256[] memory amounts = vm.envUint("PRESALE_AMOUNTS_WAD", ",");
        uint256 total = vm.envOr("PRESALE_TOTAL_ALLOCATION_WAD", uint256(21_500_000e18));
        DoubPresaleVesting vesting = UUPSDeployLib.deployDoubPresaleVesting(
            IERC20(address(d.doub)),
            d.deployer,
            beneficiaries,
            amounts,
            total,
            vm.envOr("PRESALE_VESTING_DURATION_SEC", uint256(180 days))
        );
        d.doub.mint(address(vesting), total);

        if (vm.envOr("START_PRESALE_VESTING", false)) {
            vesting.startVesting();
        }
        if (vm.envOr("ENABLE_PRESALE_CLAIMS", false)) {
            vesting.setClaimsEnabled(true);
        }
        return vesting;
    }

    function _maybeDeployTimeCurveBuyRouter(Deployment memory d) internal returns (TimeCurveBuyRouter) {
        address kumbayaRouter = vm.envOr("KUMBAYA_SWAP_ROUTER_ADDRESS", address(0));
        if (kumbayaRouter == address(0)) {
            return TimeCurveBuyRouter(payable(address(0)));
        }

        address weth = vm.envAddress("KUMBAYA_WETH_ADDRESS");
        address stable = vm.envOr("KUMBAYA_STABLE_TOKEN_ADDRESS", address(0));
        address dustTreasury = vm.envOr("CL8Y_PROTOCOL_TREASURY_ADDRESS", address(d.ecosystemTreasury));
        return new TimeCurveBuyRouter(d.timeCurve, kumbayaRouter, weth, stable, dustTreasury, d.admin);
    }

    function _handoff(Deployment memory d) internal {
        if (d.admin == d.deployer) return;

        _handoffAccessControl(address(d.doub), d.deployer, d.admin);
        _handoffAccessControl(address(d.podiumPool), d.deployer, d.admin);
        d.doubLP.grantRole(d.doubLP.DEFAULT_ADMIN_ROLE(), d.admin);
        d.doubLP.grantRole(d.doubLP.WITHDRAWER_ROLE(), d.admin);
        d.doubLP.revokeRole(d.doubLP.WITHDRAWER_ROLE(), d.deployer);
        d.doubLP.revokeRole(d.doubLP.DEFAULT_ADMIN_ROLE(), d.deployer);
        d.ecosystemTreasury.grantRole(d.ecosystemTreasury.DEFAULT_ADMIN_ROLE(), d.admin);
        d.ecosystemTreasury.grantRole(d.ecosystemTreasury.WITHDRAWER_ROLE(), d.admin);
        d.ecosystemTreasury.revokeRole(d.ecosystemTreasury.WITHDRAWER_ROLE(), d.deployer);
        d.ecosystemTreasury.revokeRole(d.ecosystemTreasury.DEFAULT_ADMIN_ROLE(), d.deployer);

        d.rabbitTreasury.grantRole(d.rabbitTreasury.DEFAULT_ADMIN_ROLE(), d.admin);
        d.rabbitTreasury.grantRole(d.rabbitTreasury.PARAMS_ROLE(), d.admin);
        d.rabbitTreasury.grantRole(d.rabbitTreasury.PAUSER_ROLE(), d.admin);
        d.rabbitTreasury.revokeRole(d.rabbitTreasury.PARAMS_ROLE(), d.deployer);
        d.rabbitTreasury.revokeRole(d.rabbitTreasury.PAUSER_ROLE(), d.deployer);
        d.rabbitTreasury.revokeRole(d.rabbitTreasury.DEFAULT_ADMIN_ROLE(), d.deployer);

        d.feeRouter.grantRole(d.feeRouter.DEFAULT_ADMIN_ROLE(), d.admin);
        d.feeRouter.grantRole(d.feeRouter.GOVERNOR_ROLE(), d.admin);
        d.feeRouter.revokeRole(d.feeRouter.GOVERNOR_ROLE(), d.deployer);
        d.feeRouter.revokeRole(d.feeRouter.DEFAULT_ADMIN_ROLE(), d.deployer);

        d.leprechaunNFT.grantRole(d.leprechaunNFT.DEFAULT_ADMIN_ROLE(), d.admin);
        d.leprechaunNFT.grantRole(d.leprechaunNFT.MINTER_ROLE(), d.admin);
        d.leprechaunNFT.revokeRole(d.leprechaunNFT.MINTER_ROLE(), d.deployer);
        d.leprechaunNFT.revokeRole(d.leprechaunNFT.DEFAULT_ADMIN_ROLE(), d.deployer);

        OwnableUpgradeable(address(d.referralRegistry)).transferOwnership(d.admin);
        OwnableUpgradeable(address(d.charmPrice)).transferOwnership(d.admin);
        OwnableUpgradeable(address(d.timeCurve)).transferOwnership(d.admin);
        if (address(d.presaleVesting) != address(0)) {
            OwnableUpgradeable(address(d.presaleVesting)).transferOwnership(d.admin);
        }
    }

    function _handoffAccessControl(address target, address deployer, address admin) internal {
        AccessControl ac = AccessControl(target);
        ac.grantRole(ac.DEFAULT_ADMIN_ROLE(), admin);
        ac.revokeRole(ac.DEFAULT_ADMIN_ROLE(), deployer);
    }

    function _log(Deployment memory d, uint256 saleStartEpoch, uint256 totalTokensForSale) internal pure {
        console.log("=== YieldOmega Production Deployment ===");
        console.log("Deployer:", d.deployer);
        console.log("Admin:", d.admin);
        console.log("ReserveAsset:", d.reserveAsset);
        console.log("Doubloon:", address(d.doub));
        console.log("PodiumPool:", address(d.podiumPool));
        console.log("SaleCl8yBurnSink:", BURN_SINK);
        console.log("DoubLPIncentives:", address(d.doubLP));
        console.log("EcosystemTreasury:", address(d.ecosystemTreasury));
        console.log("RabbitTreasuryVault:", address(d.rabbitTreasuryVault));
        console.log("RabbitFeeSink:", d.rabbitFeeSink);
        console.log("RabbitTreasury:", address(d.rabbitTreasury));
        console.log("FeeRouter:", address(d.feeRouter));
        console.log("ReferralRegistry:", address(d.referralRegistry));
        console.log("LinearCharmPrice:", address(d.charmPrice));
        console.log("TimeCurve:", address(d.timeCurve));
        console.log("DoubPresaleVesting:", address(d.presaleVesting));
        console.log("TimeCurveBuyRouter:", address(d.timeCurveBuyRouter));
        console.log("LeprechaunNFT:", address(d.leprechaunNFT));
        console.log("LaunchedToken:", address(d.doub));
        console.log("SaleStartEpoch:", saleStartEpoch);
        console.log("TotalTokensForSaleWad:", totalTokensForSale);
    }
}
