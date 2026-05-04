// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @title DevOnlyChainGuard
/// @notice Reverts unless `block.chainid` is an allowlisted **local / MegaETH testnet** ID.
/// @dev Dev Foundry scripts (`DeployDev`, Kumbaya fixtures, Anvil drills, rich-state sim) deploy mocks and
///      flip operator gates — they must **not** be broadcast to MegaETH mainnet or arbitrary chains.
///      Allowed: Anvil **31337**, MegaETH testnet **6343** ([`contracts/README.md`](../../contracts/README.md)),
///      legacy testnet **6342** (still referenced in indexer examples). **4326** (MegaETH mainnet) is **disallowed** here;
///      use production deploy tooling, not these scripts. GitLab #141 / #138; invariant `INV-DEVSCRIPT-141`.
library DevOnlyChainGuard {
    /// @dev Anvil default chain.
    uint256 internal constant CHAIN_ANVIL = 31337;
    /// @dev Legacy / alternate MegaETH testnet id (`indexer/.env.example` example).
    uint256 internal constant CHAIN_MEGAETH_TESTNET_LEGACY = 6342;
    /// @dev Current MegaETH testnet id (`contracts/README.md` RPC table).
    uint256 internal constant CHAIN_MEGAETH_TESTNET = 6343;

    /// @dev Reverts with a fixed message when `block.chainid` is not in the allowlist.
    function assertDevScriptChain() internal view {
        uint256 id = block.chainid;
        require(
            id == CHAIN_ANVIL || id == CHAIN_MEGAETH_TESTNET_LEGACY || id == CHAIN_MEGAETH_TESTNET,
            "DevOnlyChainGuard: chain not allowed (31337/6342/6343)"
        );
    }
}
