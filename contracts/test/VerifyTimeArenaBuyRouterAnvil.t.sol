// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {TimeArenaBuyRouter} from "../src/arena/TimeArenaBuyRouter.sol";
import {AnvilKumbayaRouter} from "../src/fixtures/AnvilKumbayaFixture.sol";
import {AnvilKumbayaPools} from "../src/fixtures/AnvilKumbayaPools.sol";

/// @dev Fork-local Anvil matrix for issue #251 — run via `scripts/verify-time-arena-buy-router-anvil.sh`.
contract VerifyTimeArenaBuyRouterAnvil is Test {
    uint256 internal constant WAD = 1e18;

    function setUp() public {
        if (vm.envOr("YIELDOMEGA_FORK_VERIFY", uint256(0)) != 1) {
            return;
        }
        string memory forkUrl = vm.envOr("FORK_URL", string("http://127.0.0.1:8545"));
        vm.createSelectFork(forkUrl);
    }

    function _requireFork() internal view {
        if (vm.envOr("YIELDOMEGA_FORK_VERIFY", uint256(0)) != 1) {
            revert("Set YIELDOMEGA_FORK_VERIFY=1");
        }
    }


    function _arena() internal view returns (TimeArena) {
        address ta = vm.envAddress("YIELDOMEGA_TIME_ARENA");
        require(ta != address(0), "YIELDOMEGA_TIME_ARENA");
        return TimeArena(payable(ta));
    }

    function _router(TimeArena arena) internal view returns (TimeArenaBuyRouter) {
        address br = arena.timeArenaBuyRouter();
        require(br != address(0), "timeArenaBuyRouter zero");
        return TimeArenaBuyRouter(payable(br));
    }

    function _grossDoub(TimeArena arena, uint256 charmWad) internal view returns (uint256) {
        return (charmWad * arena.effectiveCharmPriceWad()) / WAD;
    }

    function test_Forked_issue251_eth_usdm_cl8y_paths() public {
        if (vm.envOr("YIELDOMEGA_FORK_VERIFY", uint256(0)) != 1) {
            return;
        }
        _forkMatrix();
    }

    function _forkMatrix() internal {

        TimeArena arena = _arena();
        TimeArenaBuyRouter buyRouter = _router(arena);
        AnvilKumbayaRouter kumbaya = AnvilKumbayaRouter(address(buyRouter.kumbayaRouter()));
        IERC20 doub = buyRouter.doub();
        IERC20 cl8y = buyRouter.cl8y();
        IERC20 weth = IERC20(address(buyRouter.weth()));
        IERC20 usdm = buyRouter.stableToken();

        require(arena.arenaStart() != 0 && !arena.paused(), "arena not live");
        require(block.timestamp <= arena.deadline(), "arena ended");

        uint256 charmWad = 1e18;
        uint256 gross = _grossDoub(arena, charmWad);
        address ethBuyer = makeAddr("forkEthBuyer");
        address usdmBuyer = makeAddr("forkUsdmBuyer");
        address cl8yBuyer = makeAddr("forkCl8yBuyer");
        uint256 weightBefore = arena.totalCharmWeight();

        // ETH
        bytes memory pathEth = abi.encodePacked(
            address(doub),
            AnvilKumbayaPools.DOUB_CL8Y_FEE,
            address(cl8y),
            AnvilKumbayaPools.CL8Y_WETH_FEE,
            address(weth)
        );
        (uint256 ethIn,,,) = kumbaya.quoteExactOutput(pathEth, gross);
        uint256 ethMax = (ethIn * 110) / 100 + 1;
        vm.deal(ethBuyer, ethMax);
        vm.startPrank(ethBuyer);
        buyRouter.buyViaKumbaya{value: ethMax}(
            charmWad, bytes32(0), false, buyRouter.PAY_ETH(), block.timestamp + 600, ethMax, pathEth
        );
        vm.stopPrank();
        assertEq(arena.totalCharmWeight(), weightBefore + charmWad);
        weightBefore = arena.totalCharmWeight();

        // USDM
        bytes memory pathUsdm = abi.encodePacked(
            address(doub),
            AnvilKumbayaPools.DOUB_CL8Y_FEE,
            address(cl8y),
            AnvilKumbayaPools.CL8Y_WETH_FEE,
            address(weth),
            AnvilKumbayaPools.WETH_USDM_FEE,
            address(usdm)
        );
        (uint256 usdmIn,,,) = kumbaya.quoteExactOutput(pathUsdm, gross);
        uint256 usdmMax = (usdmIn * 110) / 100 + 1;
        deal(address(usdm), usdmBuyer, usdmMax);
        vm.startPrank(usdmBuyer);
        usdm.approve(address(buyRouter), usdmMax);
        buyRouter.buyViaKumbaya(
            charmWad, bytes32(0), false, buyRouter.PAY_STABLE(), block.timestamp + 600, usdmMax, pathUsdm
        );
        vm.stopPrank();
        assertEq(arena.totalCharmWeight(), weightBefore + charmWad);
        weightBefore = arena.totalCharmWeight();

        // CL8Y
        bytes memory pathCl8y = abi.encodePacked(address(doub), AnvilKumbayaPools.DOUB_CL8Y_FEE, address(cl8y));
        (uint256 cl8yIn,,,) = kumbaya.quoteExactOutput(pathCl8y, gross);
        uint256 cl8yMax = (cl8yIn * 110) / 100 + 1;
        deal(address(cl8y), cl8yBuyer, cl8yMax);
        vm.startPrank(cl8yBuyer);
        cl8y.approve(address(buyRouter), cl8yMax);
        buyRouter.buyViaKumbaya(
            charmWad, bytes32(0), false, buyRouter.PAY_CL8Y(), block.timestamp + 600, cl8yMax, pathCl8y
        );
        vm.stopPrank();
        assertEq(arena.totalCharmWeight(), weightBefore + charmWad);
    }
}
