// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @dev Optional RPC fork smoke. When `FORK_URL` is unset or empty, tests no-op (pass) — same pattern as indexer Postgres integration.
///      This contract reads `FORK_URL` only (not Foundry's global `--fork-url`). For MegaETH, set `export FORK_URL=<rpc>`;
///      example URLs and labels live in `foundry.toml` (`megaeth`, `megaeth_testnet`).
///      Policy, CI mapping, and manual runbook: `docs/testing/contract-fork-smoke.md`.
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
