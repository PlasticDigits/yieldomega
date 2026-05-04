// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DevOnlyChainGuard} from "../script/DevOnlyChainGuard.sol";

/// @dev Exposes the library for `vm.chainId` matrix tests (GitLab #141).
contract DevOnlyChainGuardHarness {
    function check() external view {
        DevOnlyChainGuard.assertDevScriptChain();
    }
}

contract DevOnlyChainGuardTest is Test {
    DevOnlyChainGuardHarness internal harness = new DevOnlyChainGuardHarness();

    function test_assertDevScriptChain_allows_anvil() public {
        vm.chainId(31337);
        harness.check();
    }

    function test_assertDevScriptChain_allows_megaeth_testnet() public {
        vm.chainId(6343);
        harness.check();
    }

    function test_assertDevScriptChain_allows_megaeth_testnet_legacy() public {
        vm.chainId(6342);
        harness.check();
    }

    function test_assertDevScriptChain_reverts_mainnet_eth() public {
        vm.chainId(1);
        vm.expectRevert(
            bytes("DevOnlyChainGuard: chain not allowed (31337/6342/6343)")
        );
        harness.check();
    }

    function test_assertDevScriptChain_reverts_megaeth_mainnet() public {
        vm.chainId(4326);
        vm.expectRevert(
            bytes("DevOnlyChainGuard: chain not allowed (31337/6342/6343)")
        );
        harness.check();
    }
}
