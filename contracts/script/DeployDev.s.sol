// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";
import {CL8YProtocolTreasury} from "../src/sinks/CL8YProtocolTreasury.sol";
import {DoubLPIncentives} from "../src/sinks/DoubLPIncentives.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";

/// @notice Deploy all core contracts to a dev/local environment.
///         Usage: forge script script/DeployDev.s.sol --broadcast --rpc-url <RPC>
///         Outputs addresses to console; copy into deployments/dev-addresses.example.json.
///         See docs/operations/deployment-stages.md and docs/operations/deployment-checklist.md.
contract DeployDev is Script {
    uint256 internal constant WAD = 1e18;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── USDm placeholder (dev only — replace with real testnet USDm) ──
        address usdm = vm.envOr("USDM_ADDRESS", address(0));
        if (usdm == address(0)) {
            MockUSDm mock = new MockUSDm();
            usdm = address(mock);
            console.log("MockUSDm deployed (dev only):", usdm);
        }

        // ── Doubloon (DOUB) ────────────────────────────────────────────
        Doubloon doub = new Doubloon(deployer);
        console.log("Doubloon:", address(doub));

        // ── Fee sinks ──────────────────────────────────────────────────
        PrizeVault prizeVault = new PrizeVault(deployer);
        CL8YProtocolTreasury cl8yTreasury = new CL8YProtocolTreasury(deployer);
        DoubLPIncentives doubLP = new DoubLPIncentives(deployer);
        EcosystemTreasury ecoTreasury = new EcosystemTreasury(deployer);
        console.log("PrizeVault:", address(prizeVault));
        console.log("CL8YProtocolTreasury:", address(cl8yTreasury));
        console.log("DoubLPIncentives:", address(doubLP));
        console.log("EcosystemTreasury:", address(ecoTreasury));

        // ── Rabbit Treasury ────────────────────────────────────────────
        RabbitTreasury rt = new RabbitTreasury(
            ERC20(usdm),
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
            deployer
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));
        console.log("RabbitTreasury:", address(rt));

        // ── Fee Router ─────────────────────────────────────────────────
        FeeRouter router = new FeeRouter(
            deployer,
            [address(doubLP), address(rt), address(prizeVault), address(cl8yTreasury)],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
        rt.grantRole(rt.FEE_ROUTER_ROLE(), address(router));
        console.log("FeeRouter:", address(router));

        // ── TimeCurve (dev placeholder — needs launched token) ─────────
        // For dev, deploy a mock launched token and fund the TimeCurve.
        MockLaunchToken lt = new MockLaunchToken();
        lt.mint(deployer, 1_000_000e18);
        console.log("MockLaunchToken (dev):", address(lt));

        TimeCurve tc = new TimeCurve(
            ERC20(usdm),
            lt,
            router,
            prizeVault,
            1e18,                               // initialMinBuy
            223_143_551_314_209_700,             // growthRateWad (ln(1.25))
            10,                                 // purchaseCapMultiple
            60,                                 // timerExtensionSec
            86_400,                             // timerCapSec
            1_000_000e18,                       // totalTokensForSale
            3600,                               // openingWindowSec
            3600                                // closingWindowSec
        );
        lt.transfer(address(tc), 1_000_000e18);
        prizeVault.grantRole(prizeVault.DISTRIBUTOR_ROLE(), address(tc));
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

/// @dev Dev-only mock tokens. NOT for production.
contract MockUSDm is ERC20 {
    constructor() ERC20("Mock USDm", "USDM") {
        _mint(msg.sender, 100_000_000e18);
    }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Mock Launch Token", "MLT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
