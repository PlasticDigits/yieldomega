// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    AnvilWETH9,
    AnvilMockUSDM,
    AnvilKumbayaRouter
} from "../src/fixtures/AnvilKumbayaFixture.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {TimeArenaBuyRouter} from "../src/arena/TimeArenaBuyRouter.sol";
import {DevOnlyChainGuard} from "./DevOnlyChainGuard.sol";

/// @dev Reserve CL8Y stand-in for `TimeArenaBuyRouter` PAY_CL8Y path validation on Anvil.
contract MockReserveCl8yFixture is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }
}

/// @notice Deploy WETH, USDM, AnvilKumbayaRouter (DOUB pools), and `TimeArenaBuyRouter` for Arena v2 E2E ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)).
/// @dev Run after `DeployDev`. Usage:
///      forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures
///        --broadcast --rpc-url <RPC> --sig run(address) <TimeArena>
contract DeployKumbayaAnvilFixtures is Script {
    function run(address timeArena) external {
        DevOnlyChainGuard.assertDevScriptChain();
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        TimeArena arena = TimeArena(timeArena);
        IERC20 doub = arena.doub();
        address surplusRecipient = address(arena.adminSellVault());

        vm.startBroadcast(deployerKey);

        AnvilWETH9 weth = new AnvilWETH9();
        AnvilMockUSDM usdm = new AnvilMockUSDM();
        AnvilKumbayaRouter router = new AnvilKumbayaRouter();
        MockReserveCl8yFixture cl8y = new MockReserveCl8yFixture();

        weth.deposit{value: 8000 ether}();
        weth.transfer(address(router), 8000 ether);

        uint256 seedDoub = 50_000_000e18;
        uint256 doubBal = doub.balanceOf(deployer);
        if (doubBal < seedDoub) {
            Doubloon(address(doub)).mint(deployer, seedDoub - doubBal);
            doubBal = doub.balanceOf(deployer);
        }
        require(doubBal >= seedDoub, "Deployer needs DOUB (run DeployDev first)");
        doub.transfer(address(router), seedDoub);

        uint256 usdmBal = IERC20(address(usdm)).balanceOf(deployer);
        require(usdmBal >= 100_000_000e18, "Deployer needs USDM");
        IERC20(address(usdm)).transfer(address(router), 100_000_000e18);

        cl8y.transfer(address(router), 50_000_000e18);

        // USDM -> WETH (~1:1 deep pool); WETH -> DOUB (~1000 DOUB per 1 WETH).
        router.setPair(address(usdm), address(weth), 80_000_000e18, 80_000_000e18);
        router.setPair(address(weth), address(doub), 8000e18, 8_000_000e18);
        // CL8Y -> DOUB for PAY_CL8Y single-hop tests.
        router.setPair(address(cl8y), address(doub), 8_000_000e18, 8_000_000e18);

        router.setOwner(address(0));

        TimeArenaBuyRouter buyRouter = new TimeArenaBuyRouter(
            arena,
            address(router),
            address(doub),
            address(cl8y),
            address(weth),
            address(usdm),
            surplusRecipient,
            deployer
        );
        arena.setTimeArenaBuyRouter(address(buyRouter));

        vm.stopBroadcast();

        console.log("AnvilWETH9:", address(weth));
        console.log("AnvilMockUSDM:", address(usdm));
        console.log("AnvilKumbayaRouter (swap + quoter):", address(router));
        console.log("TimeArenaBuyRouter (single-tx ETH/USDM buy):", address(buyRouter));
        console.log("MockReserveCl8y (router CL8Y leg):", address(cl8y));
        console.log("TimeArena doubSurplusRecipient (AdminSellVault):", surplusRecipient);
    }
}
