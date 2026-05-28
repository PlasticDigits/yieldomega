// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Non-transferable Play CRED ledger minted by TimeArena.
interface IPlayCred {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
