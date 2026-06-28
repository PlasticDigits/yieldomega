// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TimeArenaBuyRouter} from "../src/arena/TimeArenaBuyRouter.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";

/// @notice Deploy `TimeArenaBuyRouter` on MegaETH mainnet and wire via `scripts/deploy-megaeth-buy-router.sh`.
/// @dev `TimeArena.setTimeArenaBuyRouter` uses the admin key in the shell wrapper (separate tx).
contract DeployProductionBuyRouter is Script {
    uint256 internal constant CHAIN_MEGAETH_MAINNET = 4326;

    address internal constant DEFAULT_KUMBAYA_SWAP_ROUTER = 0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e;
    address internal constant DEFAULT_DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
    address internal constant DEFAULT_CL8Y = 0xfBAa45A537cF07dC768c469FfaC4e88208B0098D;
    address internal constant DEFAULT_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_USDM = 0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address timeArenaAddr = vm.envAddress("TIME_ARENA_ADDRESS");
        require(timeArenaAddr != address(0), "DeployProductionBuyRouter: TIME_ARENA_ADDRESS");

        address kumbayaRouter = _envAddressOrDefault("KUMBAYA_SWAP_ROUTER_ADDRESS", DEFAULT_KUMBAYA_SWAP_ROUTER);
        address doub = _envAddressOrDefault("DOUB_ADDRESS", DEFAULT_DOUB);
        address cl8y = _envAddressOrDefault("CL8Y_ADDRESS", DEFAULT_CL8Y);
        address weth = _envAddressOrDefault("KUMBAYA_WETH_ADDRESS", DEFAULT_WETH);
        address stable = _envAddressOrDefault("KUMBAYA_STABLE_TOKEN_ADDRESS", DEFAULT_USDM);
        address surplusRecipient = vm.envOr("DOUB_SURPLUS_RECIPIENT_ADDRESS", deployer);
        address owner = vm.envAddress("DEPLOY_ADMIN_ADDRESS");

        require(block.chainid == CHAIN_MEGAETH_MAINNET, "DeployProductionBuyRouter: mainnet only");

        vm.startBroadcast(deployerKey);

        TimeArenaBuyRouter buyRouter = new TimeArenaBuyRouter(
            TimeArena(timeArenaAddr),
            kumbayaRouter,
            doub,
            cl8y,
            weth,
            stable,
            surplusRecipient,
            owner
        );

        vm.stopBroadcast();

        console.log("TimeArena:", timeArenaAddr);
        console.log("TimeArenaBuyRouter:", address(buyRouter));
        console.log("Kumbaya swap router:", kumbayaRouter);
        console.log("DOUB:", doub);
        console.log("CL8Y:", cl8y);
        console.log("doubSurplusRecipient:", surplusRecipient);
        console.log("router owner:", owner);
    }

    function _envAddressOrDefault(string memory key, address fallbackAddr) internal view returns (address) {
        try vm.envAddress(key) returns (address configured) {
            if (configured != address(0)) {
                return configured;
            }
        } catch {}
        return fallbackAddr;
    }
}
