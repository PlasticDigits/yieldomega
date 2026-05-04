// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice DOUB token — mint/burn controlled exclusively by RabbitTreasury.
contract Doubloon is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) ERC20("Doubloon", "DOUB") {
        require(admin != address(0), "Doubloon: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }
}
