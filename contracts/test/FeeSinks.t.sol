// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {PrizeVault} from "../src/sinks/PrizeVault.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeSinksTest is Test {
    MockToken token;
    EcosystemTreasury sink;
    PrizeVault vault;
    address stranger = makeAddr("stranger");
    address winner = makeAddr("winner");

    function setUp() public {
        token = new MockToken();
        sink = new EcosystemTreasury(address(this));
        vault = new PrizeVault(address(this));
    }

    // ── FeeSink (via EcosystemTreasury) ─────────────────────────────────

    function test_feeSink_withdraw_happy_path() public {
        token.mint(address(sink), 100);
        sink.withdraw(IERC20(address(token)), winner, 100);
        assertEq(token.balanceOf(winner), 100);
    }

    function test_feeSink_withdraw_zero_to_reverts() public {
        token.mint(address(sink), 1);
        vm.expectRevert("FeeSink: zero address");
        sink.withdraw(IERC20(address(token)), address(0), 1);
    }

    function test_feeSink_withdraw_unauthorized_reverts() public {
        token.mint(address(sink), 1);
        vm.prank(stranger);
        vm.expectRevert();
        sink.withdraw(IERC20(address(token)), winner, 1);
    }

    // ── PrizeVault ──────────────────────────────────────────────────────

    function test_prizeVault_payPrize_happy_path() public {
        address distributor = makeAddr("timecurve");
        vault.grantRole(vault.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(vault), 50);
        vm.prank(distributor);
        vault.payPrize(IERC20(address(token)), winner, 50, 1, 1);
        assertEq(token.balanceOf(winner), 50);
    }

    function test_prizeVault_payPrize_zero_winner_reverts() public {
        address distributor = makeAddr("timecurve");
        vault.grantRole(vault.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(vault), 1);
        vm.prank(distributor);
        vm.expectRevert("PrizeVault: zero winner");
        vault.payPrize(IERC20(address(token)), address(0), 1, 0, 0);
    }

    function test_prizeVault_payPrize_unauthorized_reverts() public {
        token.mint(address(vault), 1);
        vm.prank(stranger);
        vm.expectRevert();
        vault.payPrize(IERC20(address(token)), winner, 1, 0, 0);
    }
}
