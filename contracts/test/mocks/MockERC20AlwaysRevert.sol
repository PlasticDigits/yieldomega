// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Any transfer or transferFrom reverts (griefing / misconfigured token).
contract MockERC20AlwaysRevert is ERC20 {
    error TransferBlocked();

    constructor() ERC20("Revert", "RV") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            revert TransferBlocked();
        }
        super._update(from, to, value);
    }
}
