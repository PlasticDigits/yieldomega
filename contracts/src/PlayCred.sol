// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IPlayCred} from "./interfaces/IPlayCred.sol";

/// @title PlayCred — non-transferable arena CRED (Arena v2 #248).
contract PlayCred is ERC20, AccessControl, IPlayCred {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) ERC20("Play CRED", "CRED") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        require(from == address(0) || to == address(0), "PlayCred: non-transferable");
        super._update(from, to, value);
    }
}
