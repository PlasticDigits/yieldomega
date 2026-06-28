// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {PodiumTranchePool} from "../src/arena/PodiumTranchePool.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {ArenaPodiumSettlement} from "../src/arena/libraries/ArenaPodiumSettlement.sol";
import {ArenaBuyRouting} from "../src/arena/libraries/ArenaBuyRouting.sol";

/// @notice Integration coverage for non-commingled PodiumVaults pool wiring (GitLab #348).
/// @dev Pool setup: category 0 (Last Buy) uses three `PodiumTranchePool` contracts (active/seed/future);
/// categories 1–3 stay on default commingled `address(vaults)` wiring. Production default remains commingled.
contract PodiumVaultsNonCommingledTest is Test {
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    TimeArena arena;

    PodiumTranchePool lbActive;
    PodiumTranchePool lbSeed;
    PodiumTranchePool lbFuture;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA401);
    address admin = address(this);

    uint8 internal constant CAT = 0;
    uint256 internal constant BUY_DOUB = 1000e18;

    function setUp() public {
        (uint256[4] memory ext, uint256[4] memory init, uint256[4] memory cap, uint256[4] memory below, uint256[4] memory to) =
            ArenaPodiumTimerConfig.getProductionDefaults();

        doub = new Doubloon(admin);
        cred = new PlayCred(admin);
        vaults = new PodiumVaults(doub, admin);

        lbActive = new PodiumTranchePool(doub, address(vaults));
        lbSeed = new PodiumTranchePool(doub, address(vaults));
        lbFuture = new PodiumTranchePool(doub, address(vaults));

        vaults.setActivePool(CAT, address(lbActive));
        vaults.setSeedPool(CAT, address(lbSeed));
        vaults.setFuturePool(CAT, address(lbFuture));

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, address(0), address(cred), 1000e18, ext, init, cap, below, to, 300, 5, 15, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(alice, 1_000_000e18);
        doub.mint(bob, 1_000_000e18);
        doub.mint(carol, 1_000_000e18);
        vm.prank(alice);
        doub.approve(address(arena), type(uint256).max);
        vm.prank(bob);
        doub.approve(address(arena), type(uint256).max);
        vm.prank(carol);
        doub.approve(address(arena), type(uint256).max);
    }

    function test_nonCommingled_lastBuy_buy_roll_payout_promotion() public {
        arena.setEpochCharmAnchorWad(1000e18);

        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(carol);
        arena.buy(1e18);

        uint256 activeBal = vaults.activePoolBalance(CAT);
        uint256 seedBal = vaults.seedPoolBalance(CAT);
        uint256 futureBal = vaults.futurePoolBalance(CAT);
        assertGt(activeBal, 0, "active tranche funded");
        assertGt(seedBal, 0, "seed tranche funded");
        assertGt(futureBal, 0, "future tranche funded");
        assertEq(doub.balanceOf(address(lbActive)), activeBal);
        assertEq(doub.balanceOf(address(lbSeed)), seedBal);
        assertEq(doub.balanceOf(address(lbFuture)), futureBal);
        assertGt(doub.balanceOf(address(vaults)), 0, "other categories commingled");

        (address[3] memory winners,) = arena.podium(CAT);
        uint256 poolBal = vaults.activePoolBalance(CAT);
        (uint256 payFirst, uint256 paySecond, uint256 payThird) = ArenaPodiumSettlement.payoutShares(poolBal);
        uint256 winner0Before = doub.balanceOf(winners[0]);
        uint256 winner1Before = doub.balanceOf(winners[1]);
        uint256 winner2Before = doub.balanceOf(winners[2]);

        vm.warp(arena.podiumDeadline(CAT) + 1);
        arena.rollPodiumEpoch(CAT);

        assertEq(arena.podiumEpoch(CAT), 1);
        assertEq(doub.balanceOf(winners[0]), winner0Before + payFirst, "4:2:1 first");
        assertEq(doub.balanceOf(winners[1]), winner1Before + paySecond, "4:2:1 second");
        assertEq(doub.balanceOf(winners[2]), winner2Before + payThird, "4:2:1 third");

        assertEq(vaults.activePoolBalance(CAT), seedBal + futureBal, "seed+future promoted to active");
        assertEq(vaults.seedPoolBalance(CAT), 0, "no stranded DOUB on seed pool");
        assertEq(vaults.futurePoolBalance(CAT), 0, "no stranded DOUB on future pool");
        assertEq(doub.balanceOf(address(lbSeed)), 0, "seed contract empty after promotion");
        assertEq(doub.balanceOf(address(lbFuture)), 0, "future contract empty after promotion");
        assertGt(vaults.activePoolBalance(CAT), 0, "promoted active balance remains");
    }

    function test_nonCommingled_buy_routes_to_external_pools_not_vault_ledger() public {
        arena.setEpochCharmAnchorWad(1000e18);
        (uint256 activeTranche, uint256 seedTranche, uint256 futureTranche) = _lastBuyTranches(BUY_DOUB);

        vm.prank(alice);
        arena.buy(1e18);

        assertEq(doub.balanceOf(address(lbActive)), activeTranche);
        assertEq(doub.balanceOf(address(lbSeed)), seedTranche);
        assertEq(doub.balanceOf(address(lbFuture)), futureTranche);
        assertEq(doub.balanceOf(address(vaults)), _commingledBuyTotal(BUY_DOUB));
    }

    function test_nonCommingled_misconfigured_eoa_pool_reverts_on_roll() public {
        address eoaActive = makeAddr("eoa-active");
        vaults.setActivePool(CAT, eoaActive);

        vm.prank(alice);
        arena.buy(1e18);
        _warpPastBuyCooldown();
        vm.prank(bob);
        arena.buy(1e18);

        vm.warp(arena.podiumDeadline(CAT) + 1);
        vm.expectRevert("PodiumVaults: external pool not contract");
        arena.rollPodiumEpoch(CAT);
    }

    function test_nonCommingled_pushTo_reverts_not_operator() public {
        vm.expectRevert("PodiumTranchePool: not operator");
        lbActive.pushTo(alice, 1);
    }

    function test_nonCommingled_creditTranche_noop_for_external_pool() public {
        vm.prank(address(arena));
        vaults.creditTranche(CAT, 0, 100e18);
        assertEq(vaults.activePoolBalance(CAT), 0);
    }

    function _lastBuyTranches(uint256 buyAmount)
        internal
        pure
        returns (uint256 activeTranche, uint256 seedTranche, uint256 futureTranche)
    {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) = ArenaBuyRouting.splitBuyAmount(buyAmount);
        activeTranche = cur[CAT];
        seedTranche = nxt[CAT];
        futureTranche = nxt2[CAT];
    }

    function _commingledBuyTotal(uint256 buyAmount) internal pure returns (uint256) {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) = ArenaBuyRouting.splitBuyAmount(buyAmount);
        uint256 total;
        for (uint8 i = 1; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            total += cur[i] + nxt[i] + nxt2[i];
        }
        return total;
    }

    function _warpPastBuyCooldown() internal {
        vm.warp(block.timestamp + arena.buyChargeIntervalSec() + 1);
    }
}
