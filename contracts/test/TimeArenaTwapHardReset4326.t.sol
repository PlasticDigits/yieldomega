// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {ArenaCharmPriceTwap} from "../src/oracle/ArenaCharmPriceTwap.sol";
import {MockUniswapV3Factory} from "./mocks/MockUniswapV3Factory.sol";
import {MockUniswapV3PoolTwap} from "./mocks/MockUniswapV3PoolTwap.sol";

/// @dev GitLab #352 - Last Buy hard reset on MegaETH (4326) samples Kumbaya V3 TWAP, not Anvil spot.
contract TimeArenaTwapHardReset4326Test is Test {
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    TimeArena arena;

    address alice = address(0xA11CE);
    address admin = address(this);

    uint256 internal constant WAD = 1e18;
    uint256 internal constant CHARM_MIN = 99e16;

    address internal constant MEGAETH_FACTORY = 0x68b34591f662508076927803c567Cc8006988a09;
    address internal constant MEGAETH_DOUB = 0xc3654B4f879937B767aFBB64B7C230FF436d2342;
    address internal constant MEGAETH_CL8Y = 0xfBAa45A537cF07dC768c469FfaC4e88208B0098D;
    address internal constant MEGAETH_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant MEGAETH_USDM = 0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7;

    uint256[4] internal _ext;
    uint256[4] internal _init;
    uint256[4] internal _cap;
    uint256[4] internal _below;
    uint256[4] internal _to;

    function setUp() public {
        (_ext, _init, _cap, _below, _to) = ArenaPodiumTimerConfig.getProductionDefaults();

        doub = new Doubloon(admin);
        cred = new PlayCred(admin);
        vaults = new PodiumVaults(doub, admin);

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, 5, 15, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(alice, 1_000_000_000e18);
        vm.prank(alice);
        doub.approve(address(arena), type(uint256).max);
    }

    /// GitLab #352 - MegaETH chain id uses `ArenaCharmPriceTwap` at Last Buy hard reset (mocked pools).
    function test_chain4326_last_buy_hard_reset_twap_reanchor() public {
        vm.prank(alice);
        arena.buy(CHARM_MIN);
        assertEq(arena.lastBuyEpoch(), 0, "pre-reset epoch");

        _wireMegaethTwapMocks(0, 0, 0);
        vm.warp(arena.deadline() - 600);

        ArenaCharmPriceTwap.Result memory twap = ArenaCharmPriceTwap.computeMegaethMainnet();
        assertGt(twap.charmPriceWad, 0, "TWAP anchor nonzero");
        assertLt(twap.charmPriceWad, arena.effectiveCharmPriceWad(), "TWAP differs from stale epoch price");

        uint256 preview = arena.doubOwedForBuy(CHARM_MIN);
        uint256 expectedOwed = Math.mulDiv(CHARM_MIN, twap.charmPriceWad, WAD);
        assertEq(preview, expectedOwed, "doubOwedForBuy uses TWAP anchor on 4326");

        uint256 staleOwed = Math.mulDiv(CHARM_MIN, arena.effectiveCharmPriceWad(), WAD);
        assertLt(preview, staleOwed, "preview not stale effective price");

        uint256 before = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(CHARM_MIN);
        uint256 paid = before - doub.balanceOf(alice);

        assertEq(paid, preview, "buy DOUB matches doubOwedForBuy");
        assertEq(arena.lastBuyEpoch(), 1, "epoch bumped on hard reset");
        assertEq(arena.epochCharmAnchorWad(), twap.charmPriceWad, "anchor from TWAP");
        assertEq(arena.effectiveCharmPriceWad(), twap.charmPriceWad, "post-reset price at TWAP anchor");
        assertEq(paid, expectedOwed, "buy priced at TWAP anchor");
    }

    function _wireMegaethTwapMocks(int24 doubCl8yTick, int24 cl8yWethTick, int24 wethUsdmTick) internal {
        vm.chainId(4326);

        MockUniswapV3Factory factoryImpl = new MockUniswapV3Factory();
        vm.etch(MEGAETH_FACTORY, address(factoryImpl).code);
        MockUniswapV3Factory factory = MockUniswapV3Factory(MEGAETH_FACTORY);

        uint16 cardinality = 100;
        address doubPool = address(
            new MockUniswapV3PoolTwap(MEGAETH_DOUB, MEGAETH_CL8Y, doubCl8yTick, doubCl8yTick, cardinality)
        );
        address cl8yPool = address(
            new MockUniswapV3PoolTwap(MEGAETH_WETH, MEGAETH_CL8Y, cl8yWethTick, cl8yWethTick, cardinality)
        );
        address usdmPool = address(
            new MockUniswapV3PoolTwap(MEGAETH_WETH, MEGAETH_USDM, wethUsdmTick, wethUsdmTick, cardinality)
        );

        factory.setPool(MEGAETH_DOUB, MEGAETH_CL8Y, 100, doubPool);
        factory.setPool(MEGAETH_CL8Y, MEGAETH_WETH, 100, cl8yPool);
        factory.setPool(MEGAETH_WETH, MEGAETH_USDM, 3000, usdmPool);

        assertEq(arena.charmAnchorKumbayaRouter(), address(0), "no Anvil spot oracle - TWAP path only");
    }
}
