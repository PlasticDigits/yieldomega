// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";

/// @notice Deploy a replacement `TimeCurveBuyRouter` (Kumbaya IV3SwapRouter ABI).
/// @dev `scripts/upgrade-timecurve-buy-router.sh` broadcasts this, then the admin key calls
///      `TimeCurve.setTimeCurveBuyRouter` via `cast send`.
contract DeployUpgradeTimeCurveBuyRouter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address timeCurveAddr = vm.envAddress("TIMECURVE_ADDRESS");
        address legacyRouter = vm.envOr("LEGACY_BUY_ROUTER_ADDRESS", address(0));

        address kumbayaRouter = _resolveAddress("KUMBAYA_SWAP_ROUTER_ADDRESS", legacyRouter, _Sel.KumbayaRouter);
        address weth = _resolveAddress("KUMBAYA_WETH_ADDRESS", legacyRouter, _Sel.Weth);
        address stable = _resolveAddress("KUMBAYA_STABLE_TOKEN_ADDRESS", legacyRouter, _Sel.Stable);
        address dustTreasury = _resolveAddress("CL8Y_PROTOCOL_TREASURY_ADDRESS", legacyRouter, _Sel.Treasury);
        address admin = vm.envAddress("DEPLOY_ADMIN_ADDRESS");

        require(timeCurveAddr != address(0), "zero TIMECURVE_ADDRESS");
        require(kumbayaRouter != address(0), "zero kumbaya router");
        require(weth != address(0), "zero weth");
        require(dustTreasury != address(0), "zero CL8Y_PROTOCOL_TREASURY");
        require(admin != address(0), "zero DEPLOY_ADMIN_ADDRESS");

        TimeCurve tc = TimeCurve(payable(timeCurveAddr));

        console.log("=== TimeCurveBuyRouter upgrade (deploy) ===");
        console.log("Chain id:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Router owner (ops):", admin);
        console.log("TimeCurve:", timeCurveAddr);
        console.log("Onchain buy router (before):", tc.timeCurveBuyRouter());
        console.log("Kumbaya SwapRouter:", kumbayaRouter);
        console.log("WETH:", weth);
        console.log("Stable:", stable);
        console.log("CL8Y dust treasury:", dustTreasury);

        vm.startBroadcast(deployerKey);

        TimeCurveBuyRouter newRouter = new TimeCurveBuyRouter(
            tc, kumbayaRouter, weth, stable, dustTreasury, admin
        );

        vm.stopBroadcast();

        console.log("New TimeCurveBuyRouter:", address(newRouter));
    }

    enum _Sel {
        KumbayaRouter,
        Weth,
        Stable,
        Treasury
    }

    function _resolveAddress(string memory envKey, address legacyRouter, _Sel sel)
        internal
        view
        returns (address resolved)
    {
        string memory raw = vm.envOr(envKey, string(""));
        if (bytes(raw).length > 0) {
            return vm.parseAddress(raw);
        }
        if (legacyRouter == address(0)) {
            return address(0);
        }
        TimeCurveBuyRouter leg = TimeCurveBuyRouter(payable(legacyRouter));
        if (sel == _Sel.KumbayaRouter) return address(leg.kumbayaRouter());
        if (sel == _Sel.Weth) return address(leg.weth());
        if (sel == _Sel.Stable) return address(leg.stableToken());
        return leg.cl8yProtocolTreasury();
    }
}
