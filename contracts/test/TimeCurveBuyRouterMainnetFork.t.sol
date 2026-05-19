// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TimeCurve} from "../src/TimeCurve.sol";
import {TimeCurveBuyRouter} from "../src/TimeCurveBuyRouter.sol";

/// @dev MegaETH mainnet fork: `buyViaKumbaya` must call Kumbaya IV3SwapRouter (no `deadline` in swap params).
/// Run: `forge test --match-contract TimeCurveBuyRouterMainnetForkTest -vv` (requires live sale on fork).
contract TimeCurveBuyRouterMainnetForkTest is Test {
    address payable constant LEGACY_BUY_ROUTER = payable(0xB09542acae355C5Ea42345522D403c1742C75B61);
    /// Fresh buyer — avoids mainnet `lastBuyTime` cooldown on `USER` from prior txs.
    address constant BUYER = address(uint160(uint256(keccak256("yieldomega.iv3.fork.buyer"))));

    uint256 constant CHARM_WAD = 1_212_364_910_930_786_770;
    uint256 constant MAX_IN = 616_874_127_008_744;
    bytes constant WETH_PATH =
        hex"fbaa45a537cf07dc768c469ffac4e88208b0098d0000644200000000000000000000000000000000000006";

    function test_legacy_buyViaKumbaya_eth_reverts_on_mainnet() public {
        vm.createSelectFork("megaeth");
        vm.deal(BUYER, 10 ether);
        vm.prank(BUYER);
        vm.expectRevert();
        TimeCurveBuyRouter(LEGACY_BUY_ROUTER).buyViaKumbaya{value: MAX_IN}(
            CHARM_WAD,
            bytes32(0),
            false,
            0,
            block.timestamp + 600,
            MAX_IN,
            WETH_PATH
        );
    }

    function test_buyViaKumbaya_eth_succeeds_with_iv3_router() public {
        vm.createSelectFork("megaeth");

        TimeCurveBuyRouter legacy = TimeCurveBuyRouter(LEGACY_BUY_ROUTER);
        TimeCurve tc = legacy.timeCurve();

        if (tc.ended() || tc.saleStart() == 0 || block.timestamp < tc.saleStart() || block.timestamp > tc.deadline()) {
            emit log("skip: sale not live on fork head");
            return;
        }

        (uint256 minCharm, uint256 maxCharm) = tc.currentCharmBoundsWad();
        if (CHARM_WAD < minCharm || CHARM_WAD > maxCharm) {
            emit log("skip: charm out of bounds on fork head");
            return;
        }

        TimeCurveBuyRouter patched = new TimeCurveBuyRouter(
            tc,
            address(legacy.kumbayaRouter()),
            address(legacy.weth()),
            address(legacy.stableToken()),
            legacy.cl8yProtocolTreasury(),
            legacy.owner()
        );

        address tcOwner = Ownable(address(tc)).owner();
        vm.prank(tcOwner);
        tc.setTimeCurveBuyRouter(address(patched));

        uint256 charmBefore = tc.charmWeight(BUYER);
        vm.deal(BUYER, 10 ether);
        vm.prank(BUYER);
        patched.buyViaKumbaya{value: MAX_IN}(
            CHARM_WAD,
            bytes32(0),
            false,
            0,
            block.timestamp + 600,
            MAX_IN,
            WETH_PATH
        );

        assertEq(tc.charmWeight(BUYER), charmBefore + CHARM_WAD, "CHARM credited after patched router buy");
    }
}
