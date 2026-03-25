// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Dev/test CL8Y for `ReferralRegistry` registration burns. NOT for production.
contract MockCL8Y is ERC20 {
    constructor() ERC20("Mock CL8Y", "CL8Y") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
