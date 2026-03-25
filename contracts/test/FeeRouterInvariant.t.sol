// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FeeRouter} from "../src/FeeRouter.sol";

contract MockTokenInv is ERC20 {
    constructor() ERC20("MockToken", "MT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Stateful handler for invariant fuzzing (fund + distribute only).
contract FeeRouterHandler is Test {
    IERC20 public immutable token;
    FeeRouter public immutable router;

    uint256 public ghost_funded;
    uint256 public ghost_distributed;

    constructor(IERC20 _token, FeeRouter _router) {
        token = _token;
        router = _router;
    }

    function fund(uint256 amt) external {
        amt = bound(amt, 1, 1e24);
        MockTokenInv(address(token)).mint(address(router), amt);
        ghost_funded += amt;
    }

    function distribute(uint256 amt) external {
        uint256 bal = token.balanceOf(address(router));
        if (bal == 0) return;
        amt = bound(amt, 1, bal);
        router.distributeFees(token, amt);
        ghost_distributed += amt;
    }
}

/// @dev Stateful fuzz: random fund + distribute sequences must preserve router/sink accounting.
contract FeeRouterInvariantTest is Test {
    MockTokenInv internal token;
    FeeRouter internal router;
    FeeRouterHandler internal handler;

    address internal s0 = makeAddr("inv_sink0");
    address internal s1 = makeAddr("inv_sink1");
    address internal s2 = makeAddr("inv_sink2");
    address internal s3 = makeAddr("inv_sink3");

    function setUp() public {
        token = new MockTokenInv();
        address[4] memory sinks = [s0, s1, s2, s3];
        router = new FeeRouter(
            address(this),
            sinks,
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
        handler = new FeeRouterHandler(token, router);
        targetContract(address(handler));
    }

    /// @dev Router balance equals funds added minus amounts distributed.
    function invariant_feeRouter_routerBalanceMatchesGhost() public view {
        uint256 bal = token.balanceOf(address(router));
        assertEq(bal, handler.ghost_funded() - handler.ghost_distributed(), "router ledger");
    }

    /// @dev Sinks (starting at zero) hold exactly what left the router.
    function invariant_feeRouter_sinksSumEqualsDistributed() public view {
        uint256 sum = token.balanceOf(s0) + token.balanceOf(s1) + token.balanceOf(s2) + token.balanceOf(s3);
        assertEq(sum, handler.ghost_distributed(), "sink sum");
    }
}
