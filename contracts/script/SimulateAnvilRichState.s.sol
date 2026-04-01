// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Two-part Anvil simulation (see `script/anvil_rich_state.sh` for time warps).
/// @dev Part 1: fund actors, TimeCurve buys, Rabbit deposits + optional withdraw.
///      Part 2: end sale, charm redemptions, prize distribution, NFT series/mints, ParamsUpdated.
///      Epoch finalizations run from the shell (vm.warp is not replayed on Anvil during `forge script --broadcast`).

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITimeCurve {
    function buy(uint256 charmWad) external;
    function endSale() external;
    function redeemCharms() external;
    function distributePrizes() external;
    function deadline() external view returns (uint256);
    function currentCharmBoundsWad() external view returns (uint256 minCharmWad, uint256 maxCharmWad);
}

interface IRabbitTreasury {
    function deposit(uint256 amount, uint256 factionId) external;
    function withdraw(uint256 doubAmount, uint256 factionId) external;
    function doub() external view returns (address);
    function alphaWad() external view returns (uint256);
    function setAlphaWad(uint256 val) external;
}

interface ILeprechaunNFT {
    struct Traits {
        uint256 seriesId;
        uint8 rarityTier;
        uint8 role;
        uint8 passiveEffectType;
        uint256 setId;
        uint8 setPosition;
        uint8 bonusCategory;
        uint256 bonusValue;
        uint256 synergyTag;
        bool agentTradable;
        bool agentLendable;
        bool factionLocked;
    }

    function createSeries(uint256 maxSupply) external returns (uint256 seriesId);
    function mint(address to, Traits calldata traits) external returns (uint256 tokenId);
}

/// @dev Default Anvil account keys (mnemonic "test test ... junk", indices 0–3).
uint256 constant PK_DEPLOYER = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
uint256 constant PK_A = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
uint256 constant PK_B = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
uint256 constant PK_C = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

contract SimulateAnvilRichStatePart1 is Script {
    function run() external {
        address usdm = vm.envAddress("USDM_ADDRESS");
        address tc = vm.envAddress("TIMECURVE_ADDRESS");
        address rt = vm.envAddress("RABBIT_TREASURY_ADDRESS");

        address alice = vm.addr(PK_A);
        address bob = vm.addr(PK_B);
        address carol = vm.addr(PK_C);
        address deployer = vm.addr(PK_DEPLOYER);

        console2.log("SimulateAnvilRichStatePart1");
        console2.log("  USDM", usdm);
        console2.log("  TimeCurve", tc);
        console2.log("  RabbitTreasury", rt);

        // Fund from deployer balance (DeployDev mints 100M USDM to deployer when MockUSDm is used).
        uint256 fund = 500_000e18;
        require(IERC20(usdm).balanceOf(deployer) >= fund * 4, "deployer USDM balance too low");
        vm.startBroadcast(PK_DEPLOYER);
        IERC20(usdm).transfer(alice, fund);
        IERC20(usdm).transfer(bob, fund);
        IERC20(usdm).transfer(carol, fund);
        vm.stopBroadcast();

        _buy(PK_A, usdm, tc);
        _buy(PK_B, usdm, tc);
        _buy(PK_C, usdm, tc);
        _buy(PK_DEPLOYER, usdm, tc);

        vm.startBroadcast(PK_DEPLOYER);
        IERC20(usdm).approve(rt, type(uint256).max);
        IRabbitTreasury(rt).deposit(10_000e18, 1);
        vm.stopBroadcast();

        vm.startBroadcast(PK_A);
        IERC20(usdm).approve(rt, type(uint256).max);
        IRabbitTreasury(rt).deposit(5_000e18, 2);
        vm.stopBroadcast();

        vm.startBroadcast(PK_B);
        IERC20(usdm).approve(rt, type(uint256).max);
        IRabbitTreasury(rt).deposit(3_000e18, 3);
        vm.stopBroadcast();

        address doubAddr = IRabbitTreasury(rt).doub();
        uint256 bobDoub = IERC20(doubAddr).balanceOf(bob);
        if (bobDoub > 1e15) {
            vm.startBroadcast(PK_B);
            IRabbitTreasury(rt).withdraw(bobDoub / 2, 3);
            vm.stopBroadcast();
        }

        console2.log("SimulateAnvilRichStatePart1: done.");
    }

    function _buy(uint256 pk, address usdm, address tc) internal {
        ITimeCurve t = ITimeCurve(tc);
        (, uint256 maxCharm) = t.currentCharmBoundsWad();
        vm.startBroadcast(pk);
        IERC20(usdm).approve(tc, type(uint256).max);
        t.buy(maxCharm);
        vm.stopBroadcast();
    }
}

contract SimulateAnvilRichStatePart2 is Script {
    function run() external {
        address tc = vm.envAddress("TIMECURVE_ADDRESS");
        address rt = vm.envAddress("RABBIT_TREASURY_ADDRESS");
        address nft = vm.envAddress("LEPRECHAUN_NFT_ADDRESS");

        address alice = vm.addr(PK_A);
        address bob = vm.addr(PK_B);

        console2.log("SimulateAnvilRichStatePart2");
        console2.log("  TimeCurve", tc);
        console2.log("  RabbitTreasury", rt);
        console2.log("  LeprechaunNFT", nft);

        vm.startBroadcast(PK_DEPLOYER);
        ITimeCurve(tc).endSale();
        vm.stopBroadcast();

        _claim(PK_A, tc);
        _claim(PK_B, tc);
        _claim(PK_C, tc);
        _claim(PK_DEPLOYER, tc);

        vm.startBroadcast(PK_DEPLOYER);
        ITimeCurve(tc).distributePrizes();
        vm.stopBroadcast();

        vm.startBroadcast(PK_DEPLOYER);
        uint256 s0 = ILeprechaunNFT(nft).createSeries(100);
        uint256 s1 = ILeprechaunNFT(nft).createSeries(50);
        ILeprechaunNFT(nft).mint(
            alice,
            ILeprechaunNFT.Traits({
                seriesId: s0,
                rarityTier: 2,
                role: 1,
                passiveEffectType: 0,
                setId: 1,
                setPosition: 0,
                bonusCategory: 0,
                bonusValue: 1e17,
                synergyTag: 42,
                agentTradable: true,
                agentLendable: false,
                factionLocked: false
            })
        );
        ILeprechaunNFT(nft).mint(
            bob,
            ILeprechaunNFT.Traits({
                seriesId: s1,
                rarityTier: 3,
                role: 2,
                passiveEffectType: 1,
                setId: 2,
                setPosition: 1,
                bonusCategory: 1,
                bonusValue: 2e17,
                synergyTag: 43,
                agentTradable: true,
                agentLendable: true,
                factionLocked: true
            })
        );
        uint256 aOld = IRabbitTreasury(rt).alphaWad();
        IRabbitTreasury(rt).setAlphaWad(aOld + 1);
        vm.stopBroadcast();

        console2.log("SimulateAnvilRichStatePart2: done.");
    }

    function _claim(uint256 pk, address tc) internal {
        vm.startBroadcast(pk);
        ITimeCurve(tc).redeemCharms();
        vm.stopBroadcast();
    }
}
