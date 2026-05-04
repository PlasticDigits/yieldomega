// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockTokenInv is ERC20 {
    constructor() ERC20("MockToken", "MT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

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

contract FeeRouterInvariantTest is Test {
    MockTokenInv internal token;
    FeeRouter internal router;
    FeeRouterHandler internal handler;

    address internal s0 = makeAddr("inv_sink0");
    address internal s1 = makeAddr("inv_sink1");
    address internal s2 = makeAddr("inv_sink2");
    address internal s3 = makeAddr("inv_sink3");
    address internal s4 = makeAddr("inv_sink4");

    function setUp() public {
        token = new MockTokenInv();
        address[5] memory sinks = [s0, s1, s2, s3, s4];
        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            sinks,
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        router.setDistributableToken(IERC20(address(token)), true);
        handler = new FeeRouterHandler(token, router);
        targetContract(address(handler));
    }

    function invariant_feeRouter_routerBalanceMatchesGhost() public view {
        uint256 bal = token.balanceOf(address(router));
        assertEq(bal, handler.ghost_funded() - handler.ghost_distributed(), "router ledger");
    }

    function invariant_feeRouter_sinksSumEqualsDistributed() public view {
        uint256 sum = token.balanceOf(s0) + token.balanceOf(s1) + token.balanceOf(s2) + token.balanceOf(s3)
            + token.balanceOf(s4);
        assertEq(sum, handler.ghost_distributed(), "sink sum");
    }
}
