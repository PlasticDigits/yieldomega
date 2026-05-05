// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {RabbitTreasuryVault} from "../src/sinks/RabbitTreasuryVault.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev GitLab #159 — FeeRouter fifth sink can target `RabbitTreasuryVault`; balances are not Burrow book until `receiveFee` path.
contract RabbitTreasuryVaultTest is Test {
    MockToken token;
    FeeRouter router;
    RabbitTreasuryVault vault;

    address sink0 = makeAddr("doub_lp");
    address sink1 = makeAddr("cl8y_burn");
    address sink2 = makeAddr("podium_pool");
    address sink3 = makeAddr("team");
    address recipient = makeAddr("recipient");
    address stranger = makeAddr("stranger");

    function setUp() public {
        token = new MockToken();
        vault = new RabbitTreasuryVault(address(this));
        router = UUPSDeployLib.deployFeeRouter(
            address(this),
            [sink0, sink1, sink2, sink3, address(vault)],
            [uint16(3000), uint16(4000), uint16(2000), uint16(0), uint16(1000)]
        );
        router.setDistributableToken(IERC20(address(token)), true);
    }

    function test_distributeFees_increases_vault_balance() public {
        token.mint(address(router), 10_000);
        router.distributeFees(token, 10_000);
        assertEq(token.balanceOf(address(vault)), 1000);
    }

    function test_owner_withdrawERC20_moves_balance() public {
        token.mint(address(router), 10_000);
        router.distributeFees(token, 10_000);
        vm.expectEmit(true, true, true, true);
        emit RabbitTreasuryVault.ERC20Withdrawn(address(token), recipient, 1000, "sweep to ops");
        vault.withdrawERC20(IERC20(address(token)), recipient, 1000, "sweep to ops");
        assertEq(token.balanceOf(recipient), 1000);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_withdrawERC20_unauthorized_reverts() public {
        token.mint(address(router), 1000);
        router.distributeFees(token, 1000);
        vm.prank(stranger);
        vm.expectRevert();
        vault.withdrawERC20(IERC20(address(token)), recipient, 100, "");
    }

    function test_withdrawERC20_zero_to_reverts() public {
        token.mint(address(vault), 1);
        vm.expectRevert("RabbitTreasuryVault: zero to");
        vault.withdrawERC20(IERC20(address(token)), address(0), 1, "");
    }

    function test_withdrawETH_moves_balance() public {
        vm.deal(address(vault), 1 ether);
        address payable to = payable(makeAddr("eth_recv"));
        vault.withdrawETH(to, 0.25 ether, "test sweep");
        assertEq(to.balance, 0.25 ether);
        assertEq(address(vault).balance, 0.75 ether);
    }
}
