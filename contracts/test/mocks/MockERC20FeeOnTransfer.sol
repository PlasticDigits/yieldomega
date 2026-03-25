// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev On peer-to-peer transfers, recipient receives `amount - fee`; fee is burned.
contract MockERC20FeeOnTransfer is ERC20 {
    uint256 public immutable feeBps;
    uint256 internal constant BPS = 10_000;

    constructor(uint256 feeBps_) ERC20("FeeOn", "FO") {
        require(feeBps_ < BPS, "fee too high");
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * feeBps) / BPS;
            uint256 received = value - fee;
            super._update(from, to, received);
            if (fee > 0) {
                super._update(from, address(0), fee);
            }
            return;
        }
        super._update(from, to, value);
    }
}
