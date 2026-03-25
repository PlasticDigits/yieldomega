// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test stub for supply/balance drift: governance or oracle adjusts a balance without a matching user transfer.
contract MockERC20Rebasing is ERC20 {
    constructor() ERC20("Rebase", "RB") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev Simulates rebasing: arbitrarily set balance (mint/burn) to desync from prior accounting.
    function rebaseSimple(address account, uint256 newBalance) external {
        uint256 b = balanceOf(account);
        if (newBalance > b) {
            _mint(account, newBalance - b);
        } else if (newBalance < b) {
            _burn(account, b - newBalance);
        }
    }
}
