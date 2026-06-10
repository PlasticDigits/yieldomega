// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_PROGRESSION_TIERS,
  clampPlayerLevel,
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  lockedUntilLevelCopy,
  MAX_PLAYER_LEVEL,
} from "./arenaProgression";

describe("arenaProgression", () => {
  it("caps level at 5", () => {
    expect(clampPlayerLevel(99n)).toBe(MAX_PLAYER_LEVEL);
    expect(clampPlayerLevel(1)).toBe(1);
  });

  it("lists five progression tiers for the XP hero lock row", () => {
    expect(ARENA_PROGRESSION_TIERS).toHaveLength(5);
    expect(ARENA_PROGRESSION_TIERS.map((tier) => tier.feature)).toEqual([
      "last_buy",
      "time_booster",
      "defended_streak",
      "warbow",
      "warbow_flag",
    ]);
  });

  it("gates features by unlock matrix", () => {
    expect(isFeatureUnlocked(1, "last_buy")).toBe(true);
    expect(isFeatureUnlocked(1, "time_booster")).toBe(false);
    expect(isFeatureUnlocked(2, "time_booster")).toBe(true);
    expect(isFeatureUnlocked(3, "defended_streak")).toBe(true);
    expect(isFeatureUnlocked(4, "warbow")).toBe(true);
    expect(isFeatureUnlocked(4, "warbow_flag")).toBe(false);
    expect(isFeatureUnlocked(5, "warbow_flag")).toBe(true);
  });

  it("formats locked copy", () => {
    expect(lockedUntilLevelCopy(FEATURE_UNLOCK_LEVEL.warbow)).toBe("Locked until Level 4");
  });
});
