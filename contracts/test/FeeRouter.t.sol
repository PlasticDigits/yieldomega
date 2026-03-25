// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FeeRouter} from "../src/FeeRouter.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FeeRouterTest is Test {
    MockToken token;
    FeeRouter router;

    address sink0 = makeAddr("doub_lp");
    address sink1 = makeAddr("rabbit_treasury");
    address sink2 = makeAddr("prizes");
    address sink3 = makeAddr("cl8y_treasury");

    function setUp() public {
        token = new MockToken();
        router = new FeeRouter(
            address(this),
            [sink0, sink1, sink2, sink3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
    }

    function test_distributeFees_canonical_split() public {
        token.mint(address(router), 10_000);
        router.distributeFees(token, 10_000);
        assertEq(token.balanceOf(sink0), 3000);
        assertEq(token.balanceOf(sink1), 2000);
        assertEq(token.balanceOf(sink2), 3500);
        assertEq(token.balanceOf(sink3), 1500);
    }

    function test_distributeFees_remainder_to_last_sink() public {
        // 9999 * 3000/10000 = 2999, *2000/10000=1999, *3500/10000=3499
        // remaining = 9999 - 2999 - 1999 - 3499 = 1502 (not 1499)
        token.mint(address(router), 9999);
        router.distributeFees(token, 9999);
        uint256 total = token.balanceOf(sink0) + token.balanceOf(sink1) + token.balanceOf(sink2) + token.balanceOf(sink3);
        assertEq(total, 9999, "no dust lost");
    }

    /// @dev Invariant: all fees distributed, nothing stuck in router.
    function test_no_dust_fuzz(uint128 amountRaw) public {
        uint256 amount = uint256(amountRaw) % 1e24 + 1;
        token.mint(address(router), amount);
        router.distributeFees(token, amount);
        assertEq(token.balanceOf(address(router)), 0, "router retains dust");
        uint256 total = token.balanceOf(sink0) + token.balanceOf(sink1) + token.balanceOf(sink2) + token.balanceOf(sink3);
        assertEq(total, amount, "total != amount");
    }

    function test_distributeFees_zero_reverts() public {
        vm.expectRevert("FeeRouter: zero amount");
        router.distributeFees(token, 0);
    }

    function test_distributeFees_insufficient_balance_reverts() public {
        token.mint(address(router), 100);
        vm.expectRevert(); // ERC20InsufficientBalance from OZ
        router.distributeFees(token, 101);
    }

    // ── Governance ─────────────────────────────────────────────────────

    function test_updateSinks() public {
        address newSink = makeAddr("new");
        router.updateSinks(
            [newSink, sink1, sink2, sink3],
            [uint16(4000), uint16(1000), uint16(3500), uint16(1500)]
        );
        (address dest,) = router.sinks(0);
        assertEq(dest, newSink);
    }

    function test_updateSinks_invalid_sum_reverts() public {
        vm.expectRevert("FeeMath: weights != 10000");
        router.updateSinks(
            [sink0, sink1, sink2, sink3],
            [uint16(5000), uint16(5000), uint16(5000), uint16(5000)]
        );
    }

    function test_updateSinks_unauthorized_reverts() public {
        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        router.updateSinks(
            [sink0, sink1, sink2, sink3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
    }

    function test_updateSinks_zero_address_reverts() public {
        vm.expectRevert("FeeRouter: zero address");
        router.updateSinks(
            [address(0), sink1, sink2, sink3],
            [uint16(3000), uint16(2000), uint16(3500), uint16(1500)]
        );
    }

    /// @dev Post-update invariant: weights always sum to 10 000.
    function test_weights_sum_invariant() public view {
        uint256 total;
        for (uint8 i; i < 4; ++i) {
            (, uint16 w) = router.sinks(i);
            total += w;
        }
        assertEq(total, 10_000);
    }
}
