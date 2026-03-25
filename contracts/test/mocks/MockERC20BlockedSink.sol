// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Transfers succeed unless `to == blocked` (simulates malicious sink griefing via nonstandard token hooks is not modeled — this models token-level block).
contract MockERC20BlockedSink is ERC20 {
    address public immutable blocked;

    constructor(address blocked_) ERC20("Blocked", "BL") {
        blocked = blocked_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    error BlockedRecipient();

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && to == blocked) {
            revert BlockedRecipient();
        }
        super._update(from, to, value);
    }
}
