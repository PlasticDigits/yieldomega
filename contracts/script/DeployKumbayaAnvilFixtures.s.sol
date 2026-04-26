// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    AnvilWETH9,
    AnvilMockUSDM,
    AnvilKumbayaRouter
} from "../src/fixtures/AnvilKumbayaFixture.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";

interface ITimeCurveAsset {
    function acceptedAsset() external view returns (address);
}

/// @notice Deploy WETH, USDM, and AnvilKumbayaRouter with seeded reserves for issue #41 E2E.
///         MegaETH / integrator alignment and runbooks: `docs/integrations/kumbaya.md` (issue #46).
/// @dev Run after DeployDev. Usage:
///      forge script script/DeployKumbayaAnvilFixtures.s.sol:DeployKumbayaAnvilFixtures
///        --broadcast --rpc-url <RPC> --sig run(address) <TimeCurve>
contract DeployKumbayaAnvilFixtures is Script {
    function run(address timeCurve) external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);
        address cl8y = ITimeCurveAsset(timeCurve).acceptedAsset();

        vm.startBroadcast(deployerKey);

        AnvilWETH9 weth = new AnvilWETH9();
        AnvilMockUSDM usdm = new AnvilMockUSDM();
        AnvilKumbayaRouter router = new AnvilKumbayaRouter();

        // Seed router ERC20 balances to match reserve accounting.
        weth.deposit{value: 8000 ether}();
        weth.transfer(address(router), 8000 ether);

        IERC20 cl8yTok = IERC20(cl8y);
        uint256 cl8yBal = cl8yTok.balanceOf(deployer);
        require(cl8yBal >= 50_000_000e18, "Deployer needs CL8Y");
        cl8yTok.transfer(address(router), 50_000_000e18);

        uint256 usdmBal = IERC20(address(usdm)).balanceOf(deployer);
        require(usdmBal >= 100_000_000e18, "Deployer needs USDM");
        IERC20(address(usdm)).transfer(address(router), 100_000_000e18);

        // USDM -> WETH: ~1000 USDM per 1 WETH (deep pool for test buys).
        router.setPair(address(usdm), address(weth), 80_000_000e18, 80_000e18);
        // WETH -> CL8Y: ~1000 CL8Y per 1 WETH.
        router.setPair(address(weth), cl8y, 8000e18, 8_000_000e18);

        router.setOwner(address(0));

        TimeCurveBuyRouter buyRouter = new TimeCurveBuyRouter(TimeCurve(timeCurve), address(router), address(weth), address(usdm));
        TimeCurve(timeCurve).setTimeCurveBuyRouter(address(buyRouter));

        vm.stopBroadcast();

        console.log("AnvilWETH9:", address(weth));
        console.log("AnvilMockUSDM:", address(usdm));
        console.log("AnvilKumbayaRouter (swap + quoter):", address(router));
        console.log("TimeCurveBuyRouter (single-tx ETH/USDM buy):", address(buyRouter));
        console.log("Accepted CL8Y:", cl8y);
    }
}
