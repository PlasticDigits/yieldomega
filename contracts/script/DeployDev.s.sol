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
import {DoubPresaleVesting} from "../src/vesting/DoubPresaleVesting.sol";
import {LeprechaunNFT} from "../src/LeprechaunNFT.sol";
import {UUPSDeployLib} from "./UUPSDeployLib.sol";
import {DeployDevBuyCooldown} from "./DeployDevBuyCooldown.sol";

/// @notice Deploy all core contracts to a dev/local environment.
///         Core game + routing contracts deploy as **UUPS ERC1967 proxies**; logged addresses are **proxy** addresses.
///         Tokens (`Doubloon`), NFTs (`LeprechaunNFT`), and dev mocks stay direct deployments (GitLab #54).
///         Usage: forge script script/DeployDev.s.sol --broadcast --rpc-url <RPC> --code-size-limit 524288 (recommended on Anvil; Forge pre-broadcast sim enforces EIP-170 unless raised — see docs/contracts/foundry-and-megaeth.md).
///         Outputs addresses to console; copy into deployments/dev-addresses.example.json.
///         Per-wallet TimeCurve buy cooldown: default **300** s; QA throughput on Anvil via **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`**
///         (defaults to **1** s) and/or **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** — see [`DeployDevBuyCooldown.sol`](./DeployDevBuyCooldown.sol) ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
///         See docs/operations/deployment-stages.md and docs/operations/deployment-checklist.md.
///         **`DoubPresaleVesting`** — local QA deploy with a **two-address** dev schedule (GitLab #92): Anvil
///         default **#0** (deployer) and **#1**, **180-day** linear tranche, **`claimsEnabled`** turned on after
///         `startVesting` so `/vesting` can exercise **`claim`** without extra owner txs.
contract DeployDev is Script {
    uint256 internal constant WAD = 1e18;
    /// @dev Anvil default account #1 — stable address for beneficiary exercises on local RPCs.
    address internal constant DEV_VESTING_BENEFICIARY_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
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

        // ── Fee sinks (UUPS proxies) ────────────────────────────────────
        PodiumPool podiumPool = UUPSDeployLib.deployPodiumPool(deployer);
        DoubLPIncentives doubLP = UUPSDeployLib.deployDoubLPIncentives(deployer);
        EcosystemTreasury ecoTreasury = UUPSDeployLib.deployEcosystemTreasury(deployer);
        console.log("PodiumPool:", address(podiumPool));
        console.log("Sale CL8Y burn sink:", SALE_CL8Y_BURN_SINK);
        console.log("DoubLPIncentives:", address(doubLP));
        console.log("EcosystemTreasury:", address(ecoTreasury));

        // ── Rabbit Treasury (UUPS proxy) ───────────────────────────────
        RabbitTreasury rt = UUPSDeployLib.deployRabbitTreasury(
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

        // ── Fee Router (UUPS proxy) ────────────────────────────────────
        FeeRouter router = UUPSDeployLib.deployFeeRouter(
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

        // ── Referral registry (UUPS proxy) ────────────────────────────
        ReferralRegistry referralRegistry =
            UUPSDeployLib.deployReferralRegistry(IERC20(reserveAsset), 1e18, deployer);
        console.log("ReferralRegistry:", address(referralRegistry));

        // ── TimeCurve (dev placeholder — needs launched token) ─────────
        // For dev, deploy a mock launched token and fund the TimeCurve.
        MockLaunchToken lt = new MockLaunchToken();
        lt.mint(deployer, 1_000_000e18);
        console.log("MockLaunchToken (dev):", address(lt));

        LinearCharmPrice charmPrice = UUPSDeployLib.deployLinearCharmPrice(
            1e18, // base: 1.0 asset per 1e18 CHARM at sale start (18-dec asset)
            1e17, // +0.10 per day (linear)
            deployer
        );
        console.log("LinearCharmPrice:", address(charmPrice));
        uint256 buyCooldownSecDev = DeployDevBuyCooldown.readBuyCooldownSec(vm);
        console.log("TimeCurve buyCooldownSec (dev deploy):", buyCooldownSecDev);
        TimeCurve tc = UUPSDeployLib.deployTimeCurve(
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
            buyCooldownSecDev,
            deployer
        );
        lt.transfer(address(tc), 1_000_000e18);
        podiumPool.setPrizePusher(address(tc));
        console.log("TimeCurve:", address(tc));

        // Burrow deposits require an open epoch; TimeCurve buys require a started sale.
        rt.openFirstEpoch();
        tc.startSale();
        // Dev convenience: allow post-end flows in local Anvil drills (issue #55 gates default off in `initialize`).
        tc.setCharmRedemptionEnabled(true);
        tc.setReservePodiumPayoutsEnabled(true);

        // ── DoubPresaleVesting (dev presale bucket stand-in — GitLab #92) ──
        address[] memory vBen = new address[](2);
        vBen[0] = deployer;
        vBen[1] = DEV_VESTING_BENEFICIARY_1;
        uint256[] memory vAmt = new uint256[](2);
        vAmt[0] = 6_000e18;
        vAmt[1] = 4_000e18;
        uint256 vTotal = 10_000e18;
        uint256 vDurationSec = 180 days;
        DoubPresaleVesting presaleVesting = UUPSDeployLib.deployDoubPresaleVesting(
            IERC20(address(doub)), deployer, vBen, vAmt, vTotal, vDurationSec
        );
        doub.grantRole(doub.MINTER_ROLE(), deployer);
        doub.mint(address(presaleVesting), vTotal);
        doub.revokeRole(doub.MINTER_ROLE(), deployer);
        presaleVesting.setClaimsEnabled(true);
        presaleVesting.startVesting();
        console.log("DoubPresaleVesting:", address(presaleVesting));

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
