// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {TimeMath} from "../src/libraries/TimeMath.sol";
import {
    AnvilWETH9,
    AnvilMockUSDM,
    AnvilKumbayaRouter
} from "../src/fixtures/AnvilKumbayaFixture.sol";
import {AnvilKumbayaPools} from "../src/fixtures/AnvilKumbayaPools.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCl8yReserve is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }
}

/// @dev GitLab #305 — epoch-anchored DOUB/CHARM + 10%/day growth; re-anchor on Last Buy hard reset.
contract TimeArenaEpochCharmPriceTest is Test {
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    AdminSellVault adminVault;
    TimeArena arena;
    AnvilKumbayaRouter kumbaya;
    MockCl8yReserve cl8y;
    AnvilWETH9 weth;
    AnvilMockUSDM usdm;

    address alice = address(0xA11CE);
    address admin = address(this);

    uint256 internal constant WAD = 1e18;
    uint256 internal constant ONE_DAY = 86_400;
    uint256 internal constant CHARM_MIN = 99e16;

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
        adminVault = new AdminSellVault(doub, admin);

        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, admin)
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        doub.grantRole(doub.MINTER_ROLE(), admin);
        doub.mint(alice, 1_000_000_000e18);
        vm.prank(alice);
        doub.approve(address(arena), type(uint256).max);
    }

    function test_effectiveCharmPriceWad_grows_10pct_per_day() public {
        uint256 anchorTs = arena.epochAnchorTimestamp();
        assertEq(arena.effectiveCharmPriceWad(), 1000e18);

        vm.warp(anchorTs + ONE_DAY);
        assertApproxEqRel(arena.effectiveCharmPriceWad(), 1100e18, 1e14);

        vm.warp(anchorTs + 2 * ONE_DAY);
        assertApproxEqRel(arena.effectiveCharmPriceWad(), 1210e18, 1e14);
    }

    function test_effectiveCharmPriceWad_monotonic_within_epoch() public {
        uint256 t0 = arena.effectiveCharmPriceWad();
        vm.warp(block.timestamp + 3600);
        uint256 t1 = arena.effectiveCharmPriceWad();
        vm.warp(block.timestamp + 7200);
        uint256 t2 = arena.effectiveCharmPriceWad();
        assertGt(t1, t0);
        assertGt(t2, t1);
    }

    function test_buy_uses_effective_price_after_warp() public {
        vm.warp(arena.epochAnchorTimestamp() + ONE_DAY / 2);
        uint256 expected = Math.mulDiv(1e18, arena.effectiveCharmPriceWad(), WAD);
        uint256 before = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(1e18);
        assertApproxEqRel(before - doub.balanceOf(alice), expected, 1e12);
    }

    /// GitLab #315 — `doubOwedForBuy` is `view` and matches immediate `buy` DOUB pull within epoch.
    function test_doubOwedForBuy_matches_buy_within_epoch() public {
        vm.warp(arena.epochAnchorTimestamp() + ONE_DAY / 2);
        uint256 charm = 1e18;
        uint256 preview = arena.doubOwedForBuy(charm);
        uint256 before = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(charm);
        assertEq(before - doub.balanceOf(alice), preview, "preview matches buy within epoch");
    }

    /// GitLab #315 — at hard-reset boundary, preview samples re-anchor before state write.
    function test_doubOwedForBuy_matches_buy_at_hard_reset_boundary() public {
        _wireKumbayaSpot();

        vm.warp(arena.deadline() - 600);

        kumbaya.setPair(address(cl8y), address(doub), 200_000e18, 100_000_000e18);

        uint256 preview = arena.doubOwedForBuy(CHARM_MIN);
        uint256 stalePriceOwed = Math.mulDiv(CHARM_MIN, arena.effectiveCharmPriceWad(), WAD);
        assertLt(preview, stalePriceOwed, "preview uses sampled anchor, not stale effective price");

        uint256 before = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(CHARM_MIN);
        uint256 paid = before - doub.balanceOf(alice);

        assertEq(preview, paid, "doubOwedForBuy equals buy DOUB at hard-reset boundary");
        assertEq(paid, Math.mulDiv(CHARM_MIN, arena.effectiveCharmPriceWad(), WAD), "buy uses post-reset anchor");
    }

    function test_buyWithCred_ignores_epoch_growth() public {
        cred.grantRole(cred.MINTER_ROLE(), admin);
        cred.mint(alice, 100_000e18);
        vm.warp(block.timestamp + ONE_DAY);
        uint256 before = cred.balanceOf(alice);
        vm.prank(alice);
        arena.buyWithCred(1e18);
        assertEq(cred.balanceOf(alice), before - 100e18);
    }

    function test_hard_reset_reanchors_and_prices_at_new_anchor() public {
        _wireKumbayaSpot();

        vm.warp(arena.deadline() - 600);

        // Change spot to 500 DOUB/CHARM before hard-reset buy.
        kumbaya.setPair(address(cl8y), address(doub), 200_000e18, 100_000_000e18);

        (uint256 spotAnchor,) =
            AnvilKumbayaPools.charmPriceWadFromSpot(kumbaya, address(doub), address(cl8y), address(weth), address(usdm));

        uint256 before = doub.balanceOf(alice);
        vm.prank(alice);
        arena.buy(CHARM_MIN);

        uint256 paid = before - doub.balanceOf(alice);
        uint256 expectedAtNewAnchor = Math.mulDiv(CHARM_MIN, spotAnchor, WAD);
        assertEq(paid, expectedAtNewAnchor, "reset buy priced at post-reset anchor");
        assertEq(arena.epochCharmAnchorWad(), spotAnchor);
        assertEq(arena.lastBuyEpoch(), 1);
        assertEq(arena.effectiveCharmPriceWad(), spotAnchor);
    }

    function test_setEpochCharmAnchorWad_resets_growth_clock() public {
        vm.warp(block.timestamp + ONE_DAY);
        assertGt(arena.effectiveCharmPriceWad(), 1000e18);

        arena.setEpochCharmAnchorWad(2000e18);
        assertEq(arena.effectiveCharmPriceWad(), 2000e18);
    }

    function testFuzz_growWad_matches_timeMath(uint128 rawAnchor, uint32 rawElapsed) public pure {
        uint256 anchor = bound(uint256(rawAnchor), 1, 1e24);
        uint256 elapsed = uint256(rawElapsed) % (365 * ONE_DAY);
        assertEq(
            TimeMath.growWad(anchor, TimeMath.CHARM_GROWTH_RATE_10PCT_WAD, elapsed),
            TimeMath.currentMinBuy(anchor, TimeMath.CHARM_GROWTH_RATE_10PCT_WAD, elapsed)
        );
    }

    function _wireKumbayaSpot() internal {
        weth = new AnvilWETH9();
        usdm = new AnvilMockUSDM();
        kumbaya = new AnvilKumbayaRouter();
        cl8y = new MockCl8yReserve();

        weth.deposit{value: 100 ether}();
        weth.transfer(address(kumbaya), 100 ether);
        doub.mint(address(kumbaya), 50_000_000e18);
        usdm.mint(address(this), 100_000_000e18);
        IERC20(address(usdm)).transfer(address(kumbaya), 100_000_000e18);
        cl8y.transfer(address(kumbaya), 50_000_000e18);

        AnvilKumbayaPools.wireLiquidity(kumbaya, address(doub), address(cl8y), address(weth), address(usdm));
        arena.setCharmAnchorOracle(address(kumbaya), address(cl8y), address(weth), address(usdm));
    }
}
