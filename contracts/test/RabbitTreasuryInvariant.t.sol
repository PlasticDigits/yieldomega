// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RabbitTreasury} from "../src/RabbitTreasury.sol";
import {Doubloon} from "../src/tokens/Doubloon.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockReserveCl8yInv is ERC20 {
    constructor() ERC20("CL8Y", "CL8Y") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Stateful handler: deposits, withdrawals, fees, epoch finalization (no pause).
contract RabbitTreasuryHandler is Test {
    MockReserveCl8yInv public immutable reserve;
    Doubloon public immutable doub;
    RabbitTreasury public immutable rt;
    address public immutable alice;
    address public immutable bob;

    uint256 public ghost_doubMinted;
    uint256 public ghost_doubBurned;

    constructor(MockReserveCl8yInv _reserve, Doubloon _doub, RabbitTreasury _rt, address _alice, address _bob) {
        reserve = _reserve;
        doub = _doub;
        rt = _rt;
        alice = _alice;
        bob = _bob;
    }

    function depositAlice(uint256 amt) external {
        amt = bound(amt, 1, 1e27);
        reserve.mint(alice, amt);
        vm.prank(alice);
        reserve.approve(address(rt), amt);
        uint256 db = doub.balanceOf(alice);
        vm.prank(alice);
        rt.deposit(amt, 0);
        ghost_doubMinted += doub.balanceOf(alice) - db;
        vm.prank(alice);
        doub.approve(address(rt), type(uint256).max);
    }

    function depositBob(uint256 amt) external {
        amt = bound(amt, 1, 1e27);
        reserve.mint(bob, amt);
        vm.prank(bob);
        reserve.approve(address(rt), amt);
        uint256 db = doub.balanceOf(bob);
        vm.prank(bob);
        rt.deposit(amt, 0);
        ghost_doubMinted += doub.balanceOf(bob) - db;
        vm.prank(bob);
        doub.approve(address(rt), type(uint256).max);
    }

    function withdrawAlice(uint256 raw) external {
        uint256 bal = doub.balanceOf(alice);
        if (bal == 0) return;
        uint256 amt = bound(raw, 1, bal);
        vm.prank(alice);
        rt.withdraw(amt, 0);
        ghost_doubBurned += amt;
    }

    function withdrawBob(uint256 raw) external {
        uint256 bal = doub.balanceOf(bob);
        if (bal == 0) return;
        uint256 amt = bound(raw, 1, bal);
        vm.prank(bob);
        rt.withdraw(amt, 0);
        ghost_doubBurned += amt;
    }

    /// @dev Fee router must be this handler (role granted in test `setUp`).
    function pushFee(uint256 amt) external {
        amt = bound(amt, 1, 1e24);
        reserve.mint(address(this), amt);
        reserve.approve(address(rt), amt);
        rt.receiveFee(amt);
    }

    function finalizeEpoch() external {
        vm.warp(rt.epochEnd());
        rt.finalizeEpoch();
    }
}

/// @dev Stateful fuzz: ERC20 balance in treasury tracks `totalReserves`; DOUB supply matches mint/burn ghosts.
contract RabbitTreasuryInvariantTest is Test {
    uint256 internal constant ONE_DAY = 86_400;

    uint256 internal constant C_MAX = 2e18;
    uint256 internal constant C_STAR = 1_050_000_000_000_000_000;
    uint256 internal constant ALPHA = 2e16;
    uint256 internal constant BETA = 2e18;
    uint256 internal constant M_MIN = 98e16;
    uint256 internal constant M_MAX = 102e16;
    uint256 internal constant LAM = 5e17;
    uint256 internal constant DELTA_MAX_FRAC = 2e16;
    uint256 internal constant EPS = 1;

    MockReserveCl8yInv internal reserve;
    Doubloon internal doub;
    RabbitTreasury internal rt;
    RabbitTreasuryHandler internal handler;

    function setUp() public {
        reserve = new MockReserveCl8yInv();
        doub = new Doubloon(address(this));
        rt = UUPSDeployLib.deployRabbitTreasury(
            reserve,
            doub,
            ONE_DAY,
            C_MAX,
            C_STAR,
            ALPHA,
            BETA,
            M_MIN,
            M_MAX,
            LAM,
            DELTA_MAX_FRAC,
            EPS,
            25e16,
            1e16,
            5e17,
            0,
            address(0),
            address(this)
        );
        doub.grantRole(doub.MINTER_ROLE(), address(rt));
        rt.openFirstEpoch();

        address alice = makeAddr("inv_rt_alice");
        address bob = makeAddr("inv_rt_bob");
        handler = new RabbitTreasuryHandler(reserve, doub, rt, alice, bob);
        rt.grantRole(rt.FEE_ROUTER_ROLE(), address(handler));
        targetContract(address(handler));
    }

    function invariant_rabbitTreasury_reservesMatchTokenBalance() public view {
        assertEq(reserve.balanceOf(address(rt)), rt.totalReserves(), "reserves vs balance");
    }

    function invariant_rabbitTreasury_doubSupplyMatchesGhostMintBurn() public view {
        assertEq(handler.ghost_doubMinted() - handler.ghost_doubBurned(), doub.totalSupply(), "DOUB supply");
    }
}
