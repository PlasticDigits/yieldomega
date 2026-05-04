// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EcosystemTreasury} from "../src/sinks/EcosystemTreasury.sol";
import {PodiumPool} from "../src/sinks/PodiumPool.sol";
import {UUPSDeployLib} from "../script/UUPSDeployLib.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeSinksTest is Test {
    MockToken token;
    EcosystemTreasury sink;
    PodiumPool podiumPool;
    address stranger = makeAddr("stranger");
    address winner = makeAddr("winner");

    function setUp() public {
        token = new MockToken();
        sink = UUPSDeployLib.deployEcosystemTreasury(address(this));
        podiumPool = UUPSDeployLib.deployPodiumPool(address(this));
    }

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

    function test_podiumPool_payPodiumPayout_happy_path() public {
        address distributor = makeAddr("timecurve");
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(podiumPool), 50);
        vm.prank(distributor);
        podiumPool.payPodiumPayout(IERC20(address(token)), winner, 50, 1, 1);
        assertEq(token.balanceOf(winner), 50);
    }

    function test_podiumPool_payPodiumPayout_zero_winner_reverts() public {
        address distributor = makeAddr("timecurve");
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(podiumPool), 1);
        vm.prank(distributor);
        vm.expectRevert("PodiumPool: zero winner");
        podiumPool.payPodiumPayout(IERC20(address(token)), address(0), 1, 0, 0);
    }

    function test_podiumPool_payPodiumPayout_unauthorized_reverts() public {
        token.mint(address(podiumPool), 1);
        vm.prank(stranger);
        vm.expectRevert();
        podiumPool.payPodiumPayout(IERC20(address(token)), winner, 1, 0, 0);
    }

    /// @dev GitLab #70 — when `prizePusher` is wired, `DISTRIBUTOR_ROLE` alone is insufficient.
    function test_podiumPool_payPodiumPayout_prize_pusher_wins_over_distributor_role() public {
        address distributor = makeAddr("timecurve");
        address rogue = makeAddr("rogue");
        token.mint(address(podiumPool), 50);
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), rogue);
        podiumPool.setPrizePusher(distributor);
        vm.prank(rogue);
        vm.expectRevert();
        podiumPool.payPodiumPayout(IERC20(address(token)), winner, 50, 1, 1);
        vm.prank(distributor);
        podiumPool.payPodiumPayout(IERC20(address(token)), winner, 50, 1, 1);
        assertEq(token.balanceOf(winner), 50);
    }

    /// @dev GitLab #116 — `forwardPodiumResidual` mirrors `payPodiumPayout` auth (prize pusher when set).
    function test_podiumPool_forwardPodiumResidual_happy_path() public {
        address distributor = makeAddr("timecurve");
        address protocol = makeAddr("protocol");
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(podiumPool), 99);
        vm.prank(distributor);
        podiumPool.forwardPodiumResidual(IERC20(address(token)), protocol, 42, 2);
        assertEq(token.balanceOf(protocol), 42);
        assertEq(token.balanceOf(address(podiumPool)), 57);
    }

    function test_podiumPool_forwardPodiumResidual_unauthorized_reverts() public {
        token.mint(address(podiumPool), 1);
        vm.prank(stranger);
        vm.expectRevert();
        podiumPool.forwardPodiumResidual(IERC20(address(token)), winner, 1, 0);
    }

    function test_podiumPool_forwardPodiumResidual_zero_recipient_reverts() public {
        address distributor = makeAddr("timecurve");
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), distributor);
        token.mint(address(podiumPool), 1);
        vm.prank(distributor);
        vm.expectRevert("PodiumPool: zero recipient");
        podiumPool.forwardPodiumResidual(IERC20(address(token)), address(0), 1, 0);
    }

    /// @dev GitLab #116 — same auth as `payPodiumPayout` when `prizePusher` is wired (GitLab #70).
    function test_podiumPool_forwardPodiumResidual_prize_pusher_wins_over_distributor_role() public {
        address distributor = makeAddr("timecurve");
        address rogue = makeAddr("rogue");
        address protocol = makeAddr("protocol");
        token.mint(address(podiumPool), 50);
        podiumPool.grantRole(podiumPool.DISTRIBUTOR_ROLE(), rogue);
        podiumPool.setPrizePusher(distributor);
        vm.prank(rogue);
        vm.expectRevert();
        podiumPool.forwardPodiumResidual(IERC20(address(token)), protocol, 50, 3);
        vm.prank(distributor);
        podiumPool.forwardPodiumResidual(IERC20(address(token)), protocol, 50, 3);
        assertEq(token.balanceOf(protocol), 50);
    }
}
