// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Shared CHARM buy envelope for TimeArena, XP, and TWAP previews (#316).
library ArenaCharmBounds {
    uint256 internal constant CHARM_MIN_WAD = 99e16;
    uint256 internal constant CHARM_MAX_WAD = 10e18;

    /// @dev Reverts with the TimeArena ingress string so router and direct buys share one message.
    function validate(uint256 charmWad) internal pure {
        require(charmWad >= CHARM_MIN_WAD && charmWad <= CHARM_MAX_WAD, "TimeArena: charm bounds");
    }
}
