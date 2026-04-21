// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LinearCharmPrice} from "../src/pricing/LinearCharmPrice.sol";
import {ICharmPrice} from "../src/interfaces/ICharmPrice.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReferralRegistry} from "../src/ReferralRegistry.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";

/// @notice Deploy all core contracts to a dev/local environment.
///         Usage: forge script script/DeployDev.s.sol --broadcast --rpc-url <RPC>
///         Outputs addresses to console; copy into deployments/dev-addresses.example.json.
///         See docs/operations/deployment-stages.md and docs/operations/deployment-checklist.md.
contract DeployDev is Script {
    uint256 internal constant WAD = 1e18;
    /// @dev Canonical burn sink for routed sale CL8Y (matches `TimeCurve` WarBow burns pattern).
    address internal constant SALE_CL8Y_BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── Reserve asset: CL8Y (dev mock, or set RESERVE_ASSET_ADDRESS / legacy USDM_ADDRESS) ──
        address reserveAsset = vm.envOr("RESERVE_ASSET_ADDRESS", address(0));
        if (reserveAsset == address(0)) {
            reserveAsset = vm.envOr("USDM_ADDRESS", address(0));
        }
        if (reserveAsset == address(0)) {
            MockReserveCl8y mock = new MockReserveCl8y();
            reserveAsset = address(mock);
            console.log("MockReserveCl8y deployed (dev only):", reserveAsset);
        }

        // ── Doubloon (DOUB) ────────────────────────────────────────────
        Doubloon doub = new Doubloon(deployer);
        console.log("Doubloon:", address(doub));

        // ── Fee sinks ──────────────────────────────────────────────────
        PodiumPool podiumPool = new PodiumPool(deployer);
        DoubLPIncentives doubLP = new DoubLPIncentives(deployer);
        EcosystemTreasury ecoTreasury = new EcosystemTreasury(deployer);
        console.log("PodiumPool:", address(podiumPool));
        console.log("Sale CL8Y burn sink:", SALE_CL8Y_BURN_SINK);
        console.log("DoubLPIncentives:", address(doubLP));
        console.log("EcosystemTreasury:", address(ecoTreasury));

        // ── Rabbit Treasury ────────────────────────────────────────────
        RabbitTreasury rt = new RabbitTreasury(
            ERC20(reserveAsset),
            doub,
            86_400,                             // epochDuration
            2e18,                               // cMaxWad
            1_050_000_000_000_000_000,          // cStarWad (1.05)
            2e16,                               // alphaWad (0.02)
            2e18,                               // betaWad
            98e16,                              // mMinWad (0.98)
            102e16,                             // mMaxWad (1.02)
            5e17,                               // lamWad (0.5)
            2e16,                               // deltaMaxFracWad (0.02)
            1,                                  // eps
            25e16,                              // protocolRevenueBurnShareWad (25% of fee gross burned)
            1e16,                               // withdrawFeeWad (1%)
            5e17,                               // minRedemptionEfficiencyWad (50% floor when health is 0)
            0,                                  // redemptionCooldownEpochs (0 = off)
            address(0),                         // burnSink (0 → DEFAULT_BURN_SINK)
            deployer
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));
        console.log("RabbitTreasury:", address(rt));

        // ── Fee Router ─────────────────────────────────────────────────
        FeeRouter router = new FeeRouter(
            deployer,
            [
                address(doubLP),
                SALE_CL8Y_BURN_SINK,
                address(podiumPool),
                address(ecoTreasury),
                address(rt)
            ],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        rt.grantRole(rt.FEE_ROUTER_ROLE(), address(router));
        console.log("FeeRouter:", address(router));

        // ── Referral registry (CL8Y burns for codes — same token as reserve when using dev mock) ──
        ReferralRegistry referralRegistry = new ReferralRegistry(IERC20(reserveAsset), 1e18);
        console.log("ReferralRegistry:", address(referralRegistry));

        // ── TimeCurve (dev placeholder — needs launched token) ─────────
        // For dev, deploy a mock launched token and fund the TimeCurve.
        MockLaunchToken lt = new MockLaunchToken();
        lt.mint(deployer, 1_000_000e18);
        console.log("MockLaunchToken (dev):", address(lt));

        LinearCharmPrice charmPrice = new LinearCharmPrice(
            1e18, // base: 1.0 asset per 1e18 CHARM at sale start (18-dec asset)
            1e17 // +0.10 per day (linear)
        );
        console.log("LinearCharmPrice:", address(charmPrice));
        TimeCurve tc = new TimeCurve(
            ERC20(reserveAsset),
            lt,
            router,
            podiumPool,
            address(referralRegistry),
            ICharmPrice(address(charmPrice)),
            1e18, // charm envelope reference WAD (20%/day scaling of 0.99–10 CHARM band)
            182_321_556_793_954_592, // growthRateWad (ln(1.2))
            120, // timerExtensionSec (2 min per buy)
            86_400, // initialTimerSec (24h first deadline)
            4 * 86_400, // timerCapSec (max 96h remaining from any buy)
            1_000_000e18, // totalTokensForSale
            300 // buyCooldownSec (5 minutes; per-wallet pacing)
        );
        lt.transfer(address(tc), 1_000_000e18);
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), address(tc));
        console.log("TimeCurve:", address(tc));

        // Burrow deposits require an open epoch; TimeCurve buys require a started sale.
        rt.openFirstEpoch();
        tc.startSale();

        // ── Leprechaun NFT ─────────────────────────────────────────────
        LeprechaunNFT nft = new LeprechaunNFT("Leprechaun", "LEPR", "", deployer);
        console.log("LeprechaunNFT:", address(nft));

        vm.stopBroadcast();

        console.log("\n--- Copy addresses into deployments/dev-addresses.example.json ---");
    }
}

/// @dev Mintable CL8Y stand-in for TimeCurve accepted asset + Rabbit Treasury reserve + referral burns. NOT for production.
contract MockReserveCl8y is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Mock Launch Token", "MLT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
