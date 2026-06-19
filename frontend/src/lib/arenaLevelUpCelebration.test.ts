// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import {
  detectUnseenLevelUpFeature,
  levelUpCelebrationUnlockLine,
} from "./arenaLevelUpCelebration";

describe("levelUpCelebrationUnlockLine", () => {
  it("returns concise unlock copy for L2+ features", () => {
    expect(levelUpCelebrationUnlockLine("time_booster")).toBe("Time Booster unlocked");
    expect(levelUpCelebrationUnlockLine("defended_streak")).toBe("Defended Streak unlocked");
    expect(levelUpCelebrationUnlockLine("warbow")).toBe("WarBow unlocked");
    expect(levelUpCelebrationUnlockLine("warbow_flag")).toBe("WarBow flag unlocked");
    expect(levelUpCelebrationUnlockLine("time_booster").length).toBeLessThanOrEqual(80);
  });
});

describe("detectUnseenLevelUpFeature", () => {
  it("returns time_booster when crossing L1→L2 and tutorial unseen", () => {
    const readSeen = vi.fn(() => false);
    expect(detectUnseenLevelUpFeature(1, 2, readSeen)).toBe("time_booster");
  });

  it("does not celebrate on L1 alone or unchanged level", () => {
    const readSeen = vi.fn(() => false);
    expect(detectUnseenLevelUpFeature(undefined, 1, readSeen)).toBeNull();
    expect(detectUnseenLevelUpFeature(1, 1, readSeen)).toBeNull();
    expect(detectUnseenLevelUpFeature(2, 2, readSeen)).toBeNull();
  });

  it("skips seen tutorials and returns the next unseen unlock", () => {
    const readSeen = vi.fn((feature: string) => feature === "time_booster");
    expect(detectUnseenLevelUpFeature(1, 3, readSeen)).toBe("defended_streak");
  });

  it("returns null when all crossed unlocks were already seen", () => {
    const readSeen = vi.fn(() => true);
    expect(detectUnseenLevelUpFeature(1, 2, readSeen)).toBeNull();
  });
});
