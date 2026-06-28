// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {UUPSDeployLib} from "./UUPSDeployLib.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {ArenaCharmPriceTwap} from "../src/oracle/ArenaCharmPriceTwap.sol";

/// @notice Production deploy for Arena v2 (MegaETH). Set env vars before broadcast.
/// @dev No retired v1 NFT/treasury/presale/TimeCurve/FeeRouter — GitLab #259.
///      Per-podium timers: product table in `ArenaPodiumTimerConfig`; optional env overrides per category (#271).
///      Initial `charmPriceWad` on chain 4326: Kumbaya TWAP (~$1/CHARM) unless `ARENA_CHARM_PRICE_WAD` set (#303).
contract DeployProduction is Script {
    uint256 internal constant CHAIN_MEGAETH_MAINNET = 4326;
    /// @dev Canonical MegaETH mainnet DOUB — existing token with Kumbaya liquidity (not redeployed).
    address internal constant MEGAETH_DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
    uint256 internal constant DEFAULT_BUY_CHARGE_INTERVAL_SEC = 300;
    uint8 internal constant DEFAULT_MAX_BUY_CHARGES = 5;
    uint256 internal constant DEFAULT_BURST_BUY_COOLDOWN_SEC = 15;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("DEPLOY_ADMIN_ADDRESS", deployer);
        /// @dev Owner for deploy + wiring txs (`setArena`, `grantRole`, …). When `admin != deployer`,
        ///      hand off to `admin` after wiring (ReferralRegistry / TimeArena use Ownable2Step — admin must `acceptOwnership`).
        address setupOwner = deployer;

        uint256 charmPriceWad = _resolveCharmPriceWad();
        uint256 buyChargeIntervalSec =
            vm.envOr("ARENA_BUY_CHARGE_INTERVAL_SEC", DEFAULT_BUY_CHARGE_INTERVAL_SEC);
        uint8 maxBuyCharges = uint8(vm.envOr("ARENA_MAX_BUY_CHARGES", uint256(DEFAULT_MAX_BUY_CHARGES)));
        uint256 burstBuyCooldownSec =
            vm.envOr("ARENA_BURST_BUY_COOLDOWN_SEC", DEFAULT_BURST_BUY_COOLDOWN_SEC);
        bool startArenaNow = vm.envOr("START_ARENA", uint256(0)) == 1;

        (
            uint256[4] memory ext,
            uint256[4] memory init,
            uint256[4] memory cap,
            uint256[4] memory below,
            uint256[4] memory to
        ) = ArenaPodiumTimerConfig.getProductionDefaults();

        ext[0] = vm.envOr("ARENA_PODIUM_0_TIMER_EXTENSION_SEC", ext[0]);
        ext[1] = vm.envOr("ARENA_PODIUM_1_TIMER_EXTENSION_SEC", ext[1]);
        ext[2] = vm.envOr("ARENA_PODIUM_2_TIMER_EXTENSION_SEC", ext[2]);
        ext[3] = vm.envOr("ARENA_PODIUM_3_TIMER_EXTENSION_SEC", ext[3]);
        init[0] = vm.envOr("ARENA_PODIUM_0_INITIAL_TIMER_SEC", init[0]);
        init[1] = vm.envOr("ARENA_PODIUM_1_INITIAL_TIMER_SEC", init[1]);
        init[2] = vm.envOr("ARENA_PODIUM_2_INITIAL_TIMER_SEC", init[2]);
        init[3] = vm.envOr("ARENA_PODIUM_3_INITIAL_TIMER_SEC", init[3]);
        cap[0] = vm.envOr("ARENA_PODIUM_0_TIMER_CAP_SEC", cap[0]);
        cap[1] = vm.envOr("ARENA_PODIUM_1_TIMER_CAP_SEC", cap[1]);
        cap[2] = vm.envOr("ARENA_PODIUM_2_TIMER_CAP_SEC", cap[2]);
        cap[3] = vm.envOr("ARENA_PODIUM_3_TIMER_CAP_SEC", cap[3]);

        (address doubAddr, bool deployFreshDoub) = _resolveDoubAddress();

        vm.startBroadcast(deployerKey);

        IERC20 doub;
        if (deployFreshDoub) {
            doub = IERC20(address(new Doubloon(admin)));
        } else {
            doub = IERC20(doubAddr);
        }

        PodiumVaults podiumVaults = new PodiumVaults(doub, setupOwner);

        ReferralRegistry referralRegistry = UUPSDeployLib.deployReferralRegistry(setupOwner);

        PlayCred playCred = UUPSDeployLib.deployPlayCred(setupOwner);

        TimeArena arena = UUPSDeployLib.deployTimeArena(
            doub,
            podiumVaults,
            address(referralRegistry),
            address(playCred),
            charmPriceWad,
            ext,
            init,
            cap,
            below,
            to,
            buyChargeIntervalSec,
            maxBuyCharges,
            burstBuyCooldownSec,
            setupOwner
        );
        podiumVaults.setArena(address(arena));
        referralRegistry.setTimeArena(address(arena));
        playCred.grantRole(playCred.MINTER_ROLE(), address(arena));

        if (startArenaNow) {
            arena.startArena();
        }

        if (admin != setupOwner) {
            _handoffAdminTo(setupOwner, admin, podiumVaults, referralRegistry, playCred, arena);
        }

        console.log("Doubloon:", address(doub));
        console.log("Doubloon source:", deployFreshDoub ? "deployed" : "existing");
        console.log("PlayCred:", address(playCred));
        console.log("PodiumVaults:", address(podiumVaults));
        console.log("ReferralRegistry:", address(referralRegistry));
        console.log("TimeArena:", address(arena));
        console.log("Deploy admin:", admin);
        if (admin != setupOwner) {
            console.log("Ownership handoff: ReferralRegistry + TimeArena pending acceptOwnership by admin");
        }
        console.log("Arena started:", startArenaNow);
        console.log("buyChargeIntervalSec:", buyChargeIntervalSec);
        console.log("maxBuyCharges:", maxBuyCharges);
        console.log("burstBuyCooldownSec:", burstBuyCooldownSec);

        vm.stopBroadcast();
    }

    /// @dev MegaETH mainnet reuses canonical DOUB (`MEGAETH_DOUB`). Other chains may deploy fresh DOUB for rehearsal.
    function _resolveDoubAddress() internal view returns (address doubAddr, bool deployFresh) {
        string memory configured = vm.envOr("DOUB_ADDRESS", string(""));
        if (bytes(configured).length > 0) {
            doubAddr = vm.parseAddress(configured);
            require(doubAddr.code.length > 0, "DeployProduction: no code at DOUB_ADDRESS");
            return (doubAddr, false);
        }
        if (block.chainid == CHAIN_MEGAETH_MAINNET) {
            return (MEGAETH_DOUB, false);
        }
        return (address(0), true);
    }

    function _resolveCharmPriceWad() internal returns (uint256 charmPriceWad) {
        uint256 charmOverride = vm.envOr("ARENA_CHARM_PRICE_WAD", uint256(0));
        if (charmOverride > 0) {
            charmPriceWad = charmOverride;
            console.log("charmPriceWad source: ARENA_CHARM_PRICE_WAD override");
            console.log("charmPriceWad", charmPriceWad);
            return charmPriceWad;
        }

        require(block.chainid == CHAIN_MEGAETH_MAINNET, "DeployProduction: set ARENA_CHARM_PRICE_WAD");
        ArenaCharmPriceTwap.Result memory twap = ArenaCharmPriceTwap.computeMegaethMainnet();
        charmPriceWad = twap.charmPriceWad;
        console.log("charmPriceWad source: Kumbaya TWAP (Sir 15m)");
        console.log("twapSeconds", twap.twapSeconds);
        console.log("doubCl8yPool", twap.doubCl8yPool);
        console.log("cl8yWethPool", twap.cl8yWethPool);
        console.log("wethUsdmPool", twap.wethUsdmPool);
        console.log("doubUsdWad", twap.doubUsdWad);
        console.log("charmPriceWad", charmPriceWad);
        console.log("minDoubSpendWad", twap.minDoubSpendWad);
        console.log("maxDoubSpendWad", twap.maxDoubSpendWad);
        console.log("twapBlockNumber", twap.blockNumber);
    }

    /// @dev Transfer Ownable / AccessControl admin from deployer to final `DEPLOY_ADMIN_ADDRESS`.
    function _handoffAdminTo(
        address setupOwner,
        address admin,
        PodiumVaults podiumVaults,
        ReferralRegistry referralRegistry,
        PlayCred playCred,
        TimeArena arena
    ) internal {
        podiumVaults.transferOwnership(admin);
        referralRegistry.transferOwnership(admin);
        arena.transferOwnership(admin);
        bytes32 adminRole = playCred.DEFAULT_ADMIN_ROLE();
        playCred.grantRole(adminRole, admin);
        playCred.renounceRole(adminRole, setupOwner);
    }
}
