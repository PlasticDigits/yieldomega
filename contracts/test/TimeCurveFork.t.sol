// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @dev Optional RPC fork smoke. When `FORK_URL` is unset or empty, tests no-op (pass) — same pattern as indexer Postgres integration.
///      For MegaETH: set `export FORK_URL=...` or use `forge test --fork-url <rpc>` with URLs from `foundry.toml`
///      (`[rpc_endpoints]` keys `megaeth`, `megaeth_testnet`). CI does not run fork tests against live RPC.
contract TimeCurveForkTest is Test {
    function test_fork_smoke_chainIdAndBlock() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) {
            return;
        }
        vm.createSelectFork(url);
        assertGt(block.chainid, 0);
        assertGt(block.number, 0);
    }
}
