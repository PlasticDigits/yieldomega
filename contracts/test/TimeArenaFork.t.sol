// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @dev Minimal view surface for optional fork head-state smoke (GitLab #275).
interface ITimeArenaForkView {
    function paused() external view returns (bool);
    function deadline() external view returns (uint256);
}

/// @dev Optional RPC fork smoke for Arena v2. When `FORK_URL` is unset or empty, tests no-op (pass).
///      Reads `FORK_URL` only (not Foundry's global `--fork-url`). For MegaETH, set `export FORK_URL=<rpc>`;
///      example URLs and labels live in `foundry.toml` (`megaeth`, `megaeth_testnet`).
///      Policy, CI mapping, and manual runbook: `docs/testing/contract-fork-smoke.md`.
contract TimeArenaForkTest is Test {
    function test_fork_smoke_chainIdAndBlock() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) {
            return;
        }
        vm.createSelectFork(url);
        assertGt(block.chainid, 0);
        assertGt(block.number, 0);
    }

    /// @dev Optional: read `TimeArena` head state when `TIME_ARENA_FORK_ADDRESS` is a deployed proxy.
    ///      Skips when unset, zero, or no bytecode (mainnet registry placeholder until #259 deploy).
    function test_fork_smoke_timeArenaHeadState() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) {
            return;
        }
        vm.createSelectFork(url);

        address arena = vm.envOr("TIME_ARENA_FORK_ADDRESS", address(0));
        if (arena == address(0)) {
            return;
        }
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(arena)
        }
        if (codeSize == 0) {
            return;
        }

        ITimeArenaForkView ta = ITimeArenaForkView(arena);
        ta.paused();
        assertGe(ta.deadline(), 0);
    }
}
