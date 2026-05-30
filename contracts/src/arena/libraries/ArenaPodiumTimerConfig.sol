// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @notice Canonical per-podium timer table for TimeArena (GitLab #271).
/// @dev Scoring hooks (Time Booster, Defended Streak, WarBow BP) use Last Buy (cat 0) timer only;
///      per-category params govern prize-settlement deadlines.
library ArenaPodiumTimerConfig {
    uint8 internal constant NUM_CATEGORIES = 4;

    /// @dev Product table: Last Buy · Time Booster · Defended Streak · WarBow.
    function getProductionDefaults()
        external
        pure
        returns (
            uint256[4] memory extensionSec,
            uint256[4] memory initialTimerSec,
            uint256[4] memory timerCapSec,
            uint256[4] memory resetBelowRemainingSec,
            uint256[4] memory resetToRemainingSec
        )
    {
        extensionSec = [uint256(120), 60, 90, 300];
        initialTimerSec = [uint256(86_400), 43_200, 64_800, 172_800];
        timerCapSec = [uint256(4 * 86_400), 4 * 43_200, 4 * 64_800, 4 * 172_800];
        resetBelowRemainingSec = [uint256(780), 240, 510, 3300];
        resetToRemainingSec = [uint256(900), 300, 600, 3600];
    }

    function validate(
        uint256[4] calldata extensionSec,
        uint256[4] calldata initialTimerSec,
        uint256[4] calldata timerCapSec,
        uint256[4] calldata resetBelowRemainingSec,
        uint256[4] calldata resetToRemainingSec
    ) internal pure {
        for (uint8 i; i < NUM_CATEGORIES; ++i) {
            require(extensionSec[i] > 0, "ArenaPodiumTimerConfig: zero extension");
            require(initialTimerSec[i] > 0, "ArenaPodiumTimerConfig: zero initial");
            require(timerCapSec[i] >= initialTimerSec[i], "ArenaPodiumTimerConfig: cap < initial");
            require(
                resetBelowRemainingSec[i] < resetToRemainingSec[i],
                "ArenaPodiumTimerConfig: reset band"
            );
            require(resetToRemainingSec[i] <= timerCapSec[i], "ArenaPodiumTimerConfig: reset > cap");
        }
    }
}
