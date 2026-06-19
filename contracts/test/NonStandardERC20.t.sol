// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TimeArena} from "../src/arena/TimeArena.sol";
import {PodiumVaults} from "../src/arena/PodiumVaults.sol";
import {PlayCred} from "../src/PlayCred.sol";
import {ArenaPodiumTimerConfig} from "../src/arena/libraries/ArenaPodiumTimerConfig.sol";
import {MockERC20FeeOnTransfer} from "./mocks/MockERC20FeeOnTransfer.sol";

/// @dev Fee-on-transfer / non-standard ERC-20 ingress parity for TimeArena DOUB paths (#316 · #123).
contract NonStandardERC20Test is Test {
    MockERC20FeeOnTransfer internal feeDoub;
    PlayCred internal cred;
    PodiumVaults internal vaults;
    TimeArena internal arena;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal admin = address(this);

    uint256[4] internal _ext;
    uint256[4] internal _init;
    uint256[4] internal _cap;
    uint256[4] internal _below;
    uint256[4] internal _to;

    function setUp() public {
        (_ext, _init, _cap, _below, _to) = ArenaPodiumTimerConfig.getProductionDefaults();
        feeDoub = new MockERC20FeeOnTransfer(100);
        cred = new PlayCred(admin);
        vaults = new PodiumVaults(feeDoub, admin);
        arena = _deployArena(feeDoub, vaults);
        cred.grantRole(cred.MINTER_ROLE(), address(arena));
        cred.grantRole(cred.MINTER_ROLE(), admin);
        feeDoub.mint(alice, 1_000_000e18);
        feeDoub.mint(bob, 1_000_000e18);
        vm.prank(alice);
        feeDoub.approve(address(arena), type(uint256).max);
        vm.prank(bob);
        feeDoub.approve(address(arena), type(uint256).max);
    }

    function _deployArena(MockERC20FeeOnTransfer doub, PodiumVaults v)
        internal
        returns (TimeArena a)
    {
        TimeArena impl = new TimeArena();
        bytes memory data = abi.encodeCall(
            TimeArena.initialize,
            (doub, v, address(0), address(cred), 1000e18, _ext, _init, _cap, _below, _to, 300, 5, 15, admin)
        );
        a = TimeArena(payable(address(new ERC1967Proxy(address(impl), data))));
        v.setArena(address(a));
        a.startArena();
    }

    function _grandfatherLevel4(address user) internal {
        cred.mint(user, 10_000e18);
        vm.prank(user);
        arena.buyWithCred(1e18);
        address[] memory wallets = new address[](1);
        wallets[0] = user;
        arena.grandfatherProgression(wallets);
        assertGe(arena.level(user), 4);
    }

    /// INV-ERC20-123: buy ingress rejects fee-on-transfer DOUB.
    function test_feeOnTransfer_buy_reverts_erc20Parity() public {
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        arena.buy(1e18);
    }

    /// WarBow steal pulls DOUB before band checks — parity must still revert.
    function test_feeOnTransfer_warbow_steal_reverts_erc20Parity() public {
        _grandfatherLevel4(alice);
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        arena.warbowSteal(bob, false);
    }

    /// Guard activation uses `_pullDoubExact`.
    function test_feeOnTransfer_warbow_guard_reverts_erc20Parity() public {
        _grandfatherLevel4(alice);
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        arena.warbowActivateGuard();
    }

    /// Manual podium top-up uses `_pullDoubExact`.
    function test_feeOnTransfer_topUp_reverts_erc20Parity() public {
        vm.prank(alice);
        vm.expectRevert("TimeArena: ERC20 parity");
        arena.topUpPodiumPools(700e18);
    }
}
