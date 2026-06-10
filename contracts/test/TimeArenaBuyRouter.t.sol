// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {TimeArenaBuyRouter} from "../src/arena/TimeArenaBuyRouter.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {AdminSellVault} from "../src/arena/AdminSellVault.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {AnvilWETH9, AnvilMockUSDM, AnvilKumbayaRouter} from "../src/fixtures/AnvilKumbayaFixture.sol";
import {AnvilKumbayaPools} from "../src/fixtures/AnvilKumbayaPools.sol";
import {MockERC20FeeOnTransfer} from "./mocks/MockERC20FeeOnTransfer.sol";

contract MockReserveCl8y is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Arena v2 stack + Anvil Kumbaya fixture for `TimeArenaBuyRouter` ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251), [#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)).
abstract contract TimeArenaBuyRouterFixture is Test {
    uint256 internal constant WAD = 1e18;

    MockReserveCl8y cl8y;
    Doubloon doub;
    PlayCred cred;
    PodiumVaults vaults;
    AdminSellVault adminVault;
    TimeArena arena;
    AnvilWETH9 weth;
    AnvilMockUSDM usdm;
    AnvilKumbayaRouter kumbaya;
    TimeArenaBuyRouter buyRouter;
    MockERC20FeeOnTransfer internal feeStable;

    address alice = makeAddr("alice");

    function _productionTimerInit()
        internal
        pure
        returns (
            uint256[4] memory ext,
            uint256[4] memory init,
            uint256[4] memory cap,
            uint256[4] memory below,
            uint256[4] memory to
        )
    {
        return ArenaPodiumTimerConfig.getProductionDefaults();
    }

    function deployBuyRouterFixture() internal {
        cl8y = new MockReserveCl8y();
        doub = new Doubloon(address(this));
        cred = new PlayCred(address(this));
        vaults = new PodiumVaults(doub, address(this));
        adminVault = new AdminSellVault(doub, address(this));

        TimeArena impl = new TimeArena();
        (uint256[4] memory ext, uint256[4] memory init, uint256[4] memory cap, uint256[4] memory below, uint256[4] memory to) =
            _productionTimerInit();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), address(cred), 1000e18, ext, init, cap, below, to, 1, address(this))
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        weth = new AnvilWETH9();
        usdm = new AnvilMockUSDM();
        kumbaya = new AnvilKumbayaRouter();

        weth.deposit{value: 8000 ether}();
        weth.transfer(address(kumbaya), 8000 ether);

        doub.grantRole(doub.MINTER_ROLE(), address(this));
        doub.mint(address(this), 100_000_000e18);
        doub.transfer(address(kumbaya), 50_000_000e18);
        usdm.transfer(address(kumbaya), 100_000_000e18);
        cl8y.transfer(address(kumbaya), 50_000_000e18);

        AnvilKumbayaPools.wireLiquidity(kumbaya, address(doub), address(cl8y), address(weth), address(usdm));
        kumbaya.setOwner(address(0));
        (uint256 charmPriceWad,) =
            AnvilKumbayaPools.charmPriceWadFromSpot(kumbaya, address(doub), address(cl8y), address(weth), address(usdm));
        arena.setCharmAnchorOracle(address(kumbaya), address(cl8y), address(weth), address(usdm));
        arena.setEpochCharmAnchorWad(charmPriceWad);

        buyRouter = new TimeArenaBuyRouter(
            arena, address(kumbaya), address(doub), address(cl8y), address(weth), address(usdm), address(adminVault), address(this)
        );
        arena.setTimeArenaBuyRouter(address(buyRouter));
    }

    function deployBuyRouterFixtureFeeStable() internal {
        cl8y = new MockReserveCl8y();
        doub = new Doubloon(address(this));
        cred = new PlayCred(address(this));
        vaults = new PodiumVaults(doub, address(this));
        adminVault = new AdminSellVault(doub, address(this));

        TimeArena impl = new TimeArena();
        (uint256[4] memory ext, uint256[4] memory init, uint256[4] memory cap, uint256[4] memory below, uint256[4] memory to) =
            _productionTimerInit();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, vaults, adminVault, address(0), address(cred), 1000e18, ext, init, cap, below, to, 1, address(this))
        );
        arena = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));

        vaults.setArena(address(arena));
        adminVault.setArena(address(arena));
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        arena.startArena();

        weth = new AnvilWETH9();
        feeStable = new MockERC20FeeOnTransfer(100);
        kumbaya = new AnvilKumbayaRouter();

        weth.deposit{value: 8000 ether}();
        weth.transfer(address(kumbaya), 8000 ether);

        doub.grantRole(doub.MINTER_ROLE(), address(this));
        doub.mint(address(this), 100_000_000e18);
        doub.transfer(address(kumbaya), 50_000_000e18);
        feeStable.mint(address(this), 500_000_000e18);
        feeStable.transfer(address(kumbaya), 100_000_000e18);
        cl8y.transfer(address(kumbaya), 50_000_000e18);

        kumbaya.setPair(address(feeStable), address(weth), 1_600_000e18, 1_000e18);
        kumbaya.setPair(address(weth), address(cl8y), 1_000e18, 1_600_000e18);
        kumbaya.setPair(address(cl8y), address(doub), 100_000e18, 3_100_000_000e18);
        kumbaya.setOwner(address(0));
        (uint256 charmPriceWad,) =
            AnvilKumbayaPools.charmPriceWadFromSpot(kumbaya, address(doub), address(cl8y), address(weth), address(feeStable));
        arena.setCharmAnchorOracle(address(kumbaya), address(cl8y), address(weth), address(usdm));
        arena.setEpochCharmAnchorWad(charmPriceWad);

        buyRouter = new TimeArenaBuyRouter(
            arena,
            address(kumbaya),
            address(doub),
            address(cl8y),
            address(weth),
            address(feeStable),
            address(adminVault),
            address(this)
        );
        arena.setTimeArenaBuyRouter(address(buyRouter));
    }

    function _grossDoub(uint256 charmWad) internal view returns (uint256) {
        return (charmWad * arena.effectiveCharmPriceWad()) / WAD;
    }

    function _pathUsdmToDoub() internal view returns (bytes memory) {
        return abi.encodePacked(
            address(doub),
            AnvilKumbayaPools.DOUB_CL8Y_FEE,
            address(cl8y),
            AnvilKumbayaPools.CL8Y_WETH_FEE,
            address(weth),
            AnvilKumbayaPools.WETH_USDM_FEE,
            address(usdm)
        );
    }

    function _pathEthToDoub() internal view returns (bytes memory) {
        return abi.encodePacked(
            address(doub),
            AnvilKumbayaPools.DOUB_CL8Y_FEE,
            address(cl8y),
            AnvilKumbayaPools.CL8Y_WETH_FEE,
            address(weth)
        );
    }

    function _pathCl8yToDoub() internal view returns (bytes memory) {
        return abi.encodePacked(address(doub), AnvilKumbayaPools.DOUB_CL8Y_FEE, address(cl8y));
    }
}

contract TimeArenaBuyRouterTest is TimeArenaBuyRouterFixture {
    function setUp() public {
        deployBuyRouterFixture();
    }

    function test_buyViaKumbaya_eth_creditsAlice() public {
        uint256 charmWad = 1e18;
        bytes memory path = _pathEthToDoub();
        uint256 gross = _grossDoub(charmWad);
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        vm.deal(alice, maxIn);
        vm.startPrank(alice);
        buyRouter.buyViaKumbaya{value: maxIn}(
            charmWad, bytes32(0), false, buyRouter.PAY_ETH(), block.timestamp + 600, maxIn, path
        );
        vm.stopPrank();

        assertEq(arena.totalCharmWeight(), charmWad);
    }

    function test_buyViaKumbaya_cl8y_creditsAlice() public {
        uint256 charmWad = 1e18;
        bytes memory path = _pathCl8yToDoub();
        uint256 gross = _grossDoub(charmWad);
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        cl8y.mint(alice, maxIn);
        vm.startPrank(alice);
        cl8y.approve(address(buyRouter), maxIn);
        buyRouter.buyViaKumbaya(
            charmWad, bytes32(0), false, buyRouter.PAY_CL8Y(), block.timestamp + 600, maxIn, path
        );
        vm.stopPrank();

        assertEq(arena.totalCharmWeight(), charmWad);
    }

    function test_buy_doub_direct_pullsFromWallet() public {
        uint256 charmWad = 1e18;
        uint256 gross = _grossDoub(charmWad);
        doub.mint(alice, gross);
        vm.startPrank(alice);
        doub.approve(address(arena), gross);
        arena.buy(charmWad);
        vm.stopPrank();
        assertEq(arena.totalCharmWeight(), charmWad);
    }

    function test_buyViaKumbaya_stable_creditsAlice() public {
        uint256 charmWad = 1e18;
        bytes memory path = _pathUsdmToDoub();
        uint256 gross = _grossDoub(charmWad);
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        usdm.mint(alice, maxIn);
        vm.startPrank(alice);
        usdm.approve(address(buyRouter), maxIn);
        buyRouter.buyViaKumbaya(charmWad, bytes32(0), false, buyRouter.PAY_STABLE(), block.timestamp + 600, maxIn, path);
        vm.stopPrank();

        assertEq(arena.totalCharmWeight(), charmWad);
    }

    function test_buyViaKumbaya_doub_surplus_to_admin_vault() public {
        uint256 charmWad = 1e18;
        bytes memory path = _pathEthToDoub();
        uint256 gross = _grossDoub(charmWad);
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        doub.transfer(address(buyRouter), 1e15);
        uint256 adminBefore = doub.balanceOf(address(adminVault));

        vm.deal(alice, maxIn);
        vm.startPrank(alice);
        buyRouter.buyViaKumbaya{value: maxIn}(
            charmWad, bytes32(0), false, buyRouter.PAY_ETH(), block.timestamp + 600, maxIn, path
        );
        vm.stopPrank();

        assertGe(doub.balanceOf(address(adminVault)), adminBefore + 1e15);
        assertEq(doub.balanceOf(address(buyRouter)), 0);
    }

    function test_stableIngressParity_revertsOnFeeOnTransfer() public {
        deployBuyRouterFixtureFeeStable();
        uint256 charmWad = 1e18;
        bytes memory path = abi.encodePacked(
            address(doub),
            AnvilKumbayaPools.DOUB_CL8Y_FEE,
            address(cl8y),
            AnvilKumbayaPools.CL8Y_WETH_FEE,
            address(weth),
            AnvilKumbayaPools.WETH_USDM_FEE,
            address(feeStable)
        );
        uint256 gross = _grossDoub(charmWad);
        (uint256 quotedIn,,,) = kumbaya.quoteExactOutput(path, gross);
        uint256 maxIn = (quotedIn * 110) / 100 + 1;

        feeStable.mint(alice, maxIn);
        vm.startPrank(alice);
        feeStable.approve(address(buyRouter), maxIn);
        vm.expectRevert(TimeArenaBuyRouter.TimeArenaBuyRouter__StableIngressParity.selector);
        buyRouter.buyViaKumbaya(charmWad, bytes32(0), false, 1, block.timestamp + 600, maxIn, path);
        vm.stopPrank();
    }

    function test_buyViaKumbaya_revertsWhenPaused() public {
        arena.setPaused(true);
        bytes memory path = _pathEthToDoub();
        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        vm.expectRevert(TimeArenaBuyRouter.TimeArenaBuyRouter__BadPhase.selector);
        buyRouter.buyViaKumbaya{value: 1 ether}(
            1e18, bytes32(0), false, 0, block.timestamp + 600, 1 ether, path
        );
        vm.stopPrank();
    }

    function test_buyViaKumbaya_revertsCharmBounds() public {
        bytes memory path = _pathEthToDoub();
        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        vm.expectRevert(TimeArenaBuyRouter.TimeArenaBuyRouter__CharmBounds.selector);
        buyRouter.buyViaKumbaya{value: 1 ether}(
            1e15, bytes32(0), false, 0, block.timestamp + 600, 1 ether, path
        );
        vm.stopPrank();
    }

    function test_buyViaKumbaya_revertsExpiredDeadline() public {
        bytes memory path = _pathEthToDoub();
        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        vm.expectRevert(TimeArenaBuyRouter.TimeArenaBuyRouter__SwapExpired.selector);
        buyRouter.buyViaKumbaya{value: 1 ether}(
            1e18, bytes32(0), false, 0, block.timestamp - 1, 1 ether, path
        );
        vm.stopPrank();
    }

    function test_buyFor_revertsWhenRouterUnset() public {
        arena.setTimeArenaBuyRouter(address(0));
        vm.prank(address(buyRouter));
        vm.expectRevert("TimeArena: not router");
        arena.buyFor(alice, 1e18, bytes32(0), false);
    }

    function test_setTimeArenaBuyRouter_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        arena.setTimeArenaBuyRouter(makeAddr("evil"));
    }
}
