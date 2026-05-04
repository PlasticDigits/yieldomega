// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Doubloon (DOUB)
/// @notice Fungible Burrow receipt token.
/// @dev **Minting** is restricted to `MINTER_ROLE` (expected holder: `RabbitTreasury`). **Burning** uses OpenZeppelin
///      `ERC20Burnable`: holders may `burn` their own balance; third parties (including `RabbitTreasury` on withdraw)
///      must use `burnFrom` with a standard ERC-20 allowance from the holder. There is **no** separate burner role and
///      **`MINTER_ROLE` does not authorize burning another account’s tokens** ([GitLab #132](https://gitlab.com/PlasticDigits/yieldomega/-/issues/132)).
contract Doubloon is ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) ERC20("Doubloon", "DOUB") {
        require(admin != address(0), "Doubloon: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
