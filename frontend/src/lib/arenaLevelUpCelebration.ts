// SPDX-License-Identifier: AGPL-3.0-only

import {
  type ArenaFeatureKey,
  featureKeyForUnlockLevel,
  readFeatureTutorialSeen,
} from "@/lib/arenaProgression";

/** Concise unlock line for the level-up celebration popover (≤80 chars, #335). */
export function levelUpCelebrationUnlockLine(feature: ArenaFeatureKey): string {
  switch (feature) {
    case "time_booster":
      return "Time Booster unlocked";
    case "defended_streak":
      return "Defended Streak unlocked";
    case "warbow":
      return "WarBow unlocked";
    case "warbow_flag":
      return "WarBow flag unlocked";
    default:
      return "New feature unlocked";
  }
}

/**
 * First unseen feature unlocked by crossing from `prevLevel` to `currentLevel`.
 * Level 1 / wallet connect alone never returns a key (#335).
 */
export function detectUnseenLevelUpFeature(
  prevLevel: number | undefined,
  currentLevel: number,
  readSeen: (feature: ArenaFeatureKey) => boolean = readFeatureTutorialSeen,
): ArenaFeatureKey | null {
  if (prevLevel === undefined || currentLevel <= prevLevel) {
    return null;
  }
  for (let unlock = prevLevel + 1; unlock <= currentLevel; unlock += 1) {
    const key = featureKeyForUnlockLevel(unlock);
    if (key && !readSeen(key)) {
      return key;
    }
  }
  return null;
}
