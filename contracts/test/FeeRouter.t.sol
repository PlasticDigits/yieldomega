// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeRouterTest is Test {
    MockToken token;
    FeeRouter router;

    address sink0 = makeAddr("doub_lp");
    address sink1 = makeAddr("cl8y_burn");
    address sink2 = makeAddr("podium_pool");
    address sink3 = makeAddr("team");
    address sink4 = makeAddr("rabbit_treasury");

    function setUp() public {
        token = new MockToken();
        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            [sink0, sink1, sink2, sink3, sink4],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        router.setDistributableToken(IERC20(address(token)), true);
    }

    function test_distributeFees_canonical_split() public {
        token.mint(address(router), 10_000);
        router.distributeFees(token, 10_000);
        assertEq(token.balanceOf(sink0), 3000);
        assertEq(token.balanceOf(sink1), 4000);
        assertEq(token.balanceOf(sink2), 2000);
        assertEq(token.balanceOf(sink3), 0);
        assertEq(token.balanceOf(sink4), 1000);
    }

    function test_distributeFees_remainder_to_last_sink() public {
        token.mint(address(router), 9999);
        router.distributeFees(token, 9999);
        uint256 total = token.balanceOf(sink0) + token.balanceOf(sink1) + token.balanceOf(sink2) + token.balanceOf(sink3)
            + token.balanceOf(sink4);
        assertEq(total, 9999, "no dust lost");
    }

    function test_no_dust_fuzz(uint128 amountRaw) public {
        uint256 amount = uint256(amountRaw) % 1e24 + 1;
        token.mint(address(router), amount);
        router.distributeFees(token, amount);
        assertEq(token.balanceOf(address(router)), 0, "router retains dust");
        uint256 total = token.balanceOf(sink0) + token.balanceOf(sink1) + token.balanceOf(sink2) + token.balanceOf(sink3)
            + token.balanceOf(sink4);
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

    function test_updateSinks() public {
        address newSink = makeAddr("new");
        router.updateSinks(
            [newSink, sink1, sink2, sink3, sink4],
            [uint16(4000), uint16(1000), uint16(2000), uint16(500), uint16(2500)]
        );
        (address dest,) = router.sinks(0);
        assertEq(dest, newSink);
    }

    function test_updateSinks_invalid_sum_reverts() public {
        vm.expectRevert("FeeMath: weights != 10000");
        router.updateSinks(
            [sink0, sink1, sink2, sink3, sink4],
            [uint16(5000), uint16(5000), uint16(5000), uint16(5000), uint16(5000)]
        );
    }

    function test_updateSinks_unauthorized_reverts() public {
        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        router.updateSinks(
            [sink0, sink1, sink2, sink3, sink4],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
    }

    function test_updateSinks_zero_address_reverts() public {
        vm.expectRevert("FeeRouter: zero address");
        router.updateSinks(
            [address(0), sink1, sink2, sink3, sink4],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
    }

    function test_weights_sum_invariant() public view {
        uint256 total;
        for (uint8 i; i < 5; ++i) {
            (, uint16 w) = router.sinks(i);
            total += w;
        }
        assertEq(total, 10_000);
    }

    function test_distributeFees_reverts_when_token_not_distributable() public {
        MockToken stray = new MockToken();
        stray.mint(address(router), 1_000);
        vm.expectRevert("FeeRouter: token not distributable");
        router.distributeFees(IERC20(address(stray)), 1_000);
    }

    function test_setDistributableToken_emits_and_gate() public {
        MockToken stray = new MockToken();
        assertEq(router.distributableToken(address(stray)), false);
        vm.expectEmit(true, true, true, true);
        emit FeeRouter.DistributableTokenUpdated(address(stray), true, address(this));
        router.setDistributableToken(IERC20(address(stray)), true);
        stray.mint(address(router), 100);
        router.distributeFees(IERC20(address(stray)), 100);
        assertEq(stray.balanceOf(sink0), 30);
    }

    function test_setDistributableToken_zero_token_reverts() public {
        vm.expectRevert("FeeRouter: zero token");
        router.setDistributableToken(IERC20(address(0)), true);
    }

    function test_setDistributableToken_unauthorized_reverts() public {
        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        router.setDistributableToken(IERC20(address(token)), false);
    }

    function test_rescueERC20_moves_balance() public {
        MockToken stray = new MockToken();
        stray.mint(address(router), 500);
        address recipient = makeAddr("recipient");
        vm.expectEmit(true, true, true, true);
        emit FeeRouter.ERC20Rescued(address(stray), recipient, 500, address(this));
        router.rescueERC20(IERC20(address(stray)), recipient, 500);
        assertEq(stray.balanceOf(recipient), 500);
        assertEq(stray.balanceOf(address(router)), 0);
    }

    function test_rescueERC20_unauthorized_reverts() public {
        token.mint(address(router), 100);
        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        router.rescueERC20(IERC20(address(token)), sink0, 100);
    }

    function test_rescueERC20_zero_to_reverts() public {
        token.mint(address(router), 10);
        vm.expectRevert("FeeRouter: zero to");
        router.rescueERC20(IERC20(address(token)), address(0), 10);
    }
}
