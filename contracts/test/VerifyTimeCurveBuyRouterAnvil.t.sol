// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";

/// @dev AnvilKumbayaRouter: exactOutput + quoteExactOutput (see `AnvilKumbayaFixture.sol`).
interface IAnvilKumbaya {
    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        view
        returns (uint256 amountIn, uint160[] memory, uint32[] memory, uint256);

    function exactOutput(ExactOutputParams calldata params) external returns (uint256 amountIn);
}

/// @dev Anvil USDM: fixture exposes `mint` for test liquidity.
interface IAnvilUSDM is IERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title Live fork verification (GitLab #65 scope checklist, GitLab #78)
 * @notice Run only via `bash scripts/verify-timecurve-buy-router-anvil.sh` (sets `YIELDOMEGA_FORK_VERIFY=1`).
 *         Exercises quote vs exactOutput, `buyViaKumbaya` + WarBow opt-in, and `setTimeCurveBuyRouter(0)` gate.
 *         When `YIELDOMEGA_FORK_VERIFY` is unset, the test no-ops so `forge test` in CI is unchanged.
 * @dev Requires a local Anvil fork, TimeCurve with **active sale** (not post-`anvil_rich_state` ended sale),
 *      and `DeployKumbayaAnvilFixtures` (non-zero `timeCurveBuyRouter()`).
 */
contract VerifyTimeCurveBuyRouterAnvilTest is Test {
    uint256 internal constant WAD = 1e18;
    // Anvil default #1 (private key from Foundry/Anvil docs)
    address internal constant ALICE = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function _skipUnlessForkVerify() internal view returns (bool) {
        if (vm.envOr("YIELDOMEGA_FORK_VERIFY", uint256(0)) == 0) {
            return true;
        }
        return false;
    }

    function test_Forked_issue78_TimeCurveBuyRouter_checklist() public {
        if (_skipUnlessForkVerify()) {
            assertTrue(true, "default forge test: set YIELDOMEGA_FORK_VERIFY=1 via verify script to run this fork check");
            return;
        }

        string memory forkUrl = vm.envString("FORK_URL");
        vm.createSelectFork(forkUrl);

        address tcAddr = vm.envAddress("YIELDOMEGA_TIMECURVE");
        TimeCurve tc = TimeCurve(payable(tcAddr));

        require(
            !tc.ended() && block.timestamp < tc.deadline(),
            "issue78: sale not live - use SKIP_ANVIL_RICH_STATE=1"
        );
        require(tc.saleStart() > 0, "issue78: sale not started");

        address brAddr = tc.timeCurveBuyRouter();
        require(brAddr != address(0), "issue78: timeCurveBuyRouter=0: run DeployKumbayaAnvilFixtures");

        TimeCurveBuyRouter br = TimeCurveBuyRouter(payable(brAddr));
        IAnvilKumbaya kumbaya = IAnvilKumbaya(address(br.kumbayaRouter()));
        IAnvilUSDM usdm = IAnvilUSDM(address(br.stableToken()));
        require(address(usdm) != address(0), "issue78: stable not configured on buy router");

        address weth = address(br.weth());
        address cl8y = address(tc.acceptedAsset());
        // Path: CL8Y (out) -- WETH -- USDM (in), matching `TimeCurveBuyRouter` + tests.
        bytes memory path = abi.encodePacked(cl8y, uint24(3000), weth, uint24(3000), address(usdm));

        (uint256 minC, uint256 maxC) = tc.currentCharmBoundsWad();
        // Default dev stack matches unit tests (1e18); clamp to onchain bounds.
        uint256 charmWad = 1e18;
        if (charmWad < minC) charmWad = minC;
        if (charmWad > maxC) charmWad = maxC;
        require(charmWad >= minC && charmWad <= maxC, "issue78: charm not in bounds");
        uint256 gross = (charmWad * tc.currentPricePerCharmWad()) / WAD;
        require(gross > 0, "issue78: zero gross (bad phase)");

        // Row: quoteExactOutput - exactOutput (USDM two-hop)
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;
        IAnvilUSDM(usdm).mint(ALICE, maxIn);
        uint256 b0 = usdm.balanceOf(ALICE);
        vm.startPrank(ALICE);
        usdm.approve(address(kumbaya), type(uint256).max);
        kumbaya.exactOutput(
            IAnvilKumbaya.ExactOutputParams({
                path: path, recipient: ALICE, deadline: block.timestamp + 600, amountOut: gross, amountInMaximum: maxIn
            })
        );
        vm.stopPrank();
        uint256 b1 = usdm.balanceOf(ALICE);
        uint256 usedIn = b0 - b1;
        assertLe(usedIn >= quotedIn ? usedIn - quotedIn : quotedIn - usedIn, 1, "quote vs exactOutput USDM in");

        // buyViaKumbaya, plantWarBowFlag = false
        (uint256 q2,,,) = kumbaya.quoteExactOutput(path, (charmWad * tc.currentPricePerCharmWad()) / WAD);
        uint256 max2 = (q2 * 110) / 100 + 1;
        IAnvilUSDM(usdm).mint(ALICE, max2);
        vm.startPrank(ALICE);
        usdm.approve(address(br), max2);
        br.buyViaKumbaya(charmWad, bytes32(0), false, br.PAY_STABLE(), block.timestamp + 600, max2, path);
        vm.stopPrank();
        assertEq(tc.charmWeight(ALICE), charmWad, "buyViaKumbaya (stable) should credit CHARM to buyer");
        assertTrue(tc.warbowPendingFlagOwner() != ALICE, "opt-out buy should not set warbow flag owner");

        // Cooldown: DeployDev default 300s (see DeployDev.s.sol)
        uint256 cool = tc.buyCooldownSec();
        vm.warp(block.timestamp + cool + 1);

        // buyViaKumbaya, plantWarBowFlag = true (mirrors buyFor -> _buy)
        (uint256 q3,,,) = kumbaya.quoteExactOutput(path, (charmWad * tc.currentPricePerCharmWad()) / WAD);
        uint256 max3 = (q3 * 110) / 100 + 1;
        IAnvilUSDM(usdm).mint(ALICE, max3);
        vm.startPrank(ALICE);
        usdm.approve(address(br), max3);
        br.buyViaKumbaya(charmWad, bytes32(0), true, br.PAY_STABLE(), block.timestamp + 600, max3, path);
        vm.stopPrank();
        assertEq(tc.warbowPendingFlagOwner(), ALICE, "opt-in should set warbowPendingFlagOwner = buyer (flag path)");

        // setTimeCurveBuyRouter(0); buyFor reverts for former router
        address own = tc.owner();
        vm.prank(own);
        tc.setTimeCurveBuyRouter(address(0));
        assertEq(tc.timeCurveBuyRouter(), address(0), "re-disable: router cleared");

        vm.prank(address(br));
        vm.expectRevert(bytes("TimeCurve: not buy router"));
        tc.buyFor(ALICE, charmWad, false);
    }
}
