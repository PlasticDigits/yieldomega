// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_PROGRESSION_TIERS,
  clampPlayerLevel,
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  lockedUntilLevelCopy,
  MAX_PLAYER_LEVEL,
  nextUnlockLevel,
  shouldShowLevelLock,
  shouldShowPodiumFeatureLock,
  shouldShowPodiumLevelLock,
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
    expect(lockedUntilLevelCopy(FEATURE_UNLOCK_LEVEL.warbow)).toBe("LEVEL 4");
  });

  it("nextUnlockLevel returns immediate next tier through L5 cap (#334)", () => {
    expect(nextUnlockLevel(1)).toBe(2);
    expect(nextUnlockLevel(4)).toBe(5);
    expect(nextUnlockLevel(5)).toBeNull();
    expect(nextUnlockLevel(99)).toBeNull();
  });

  it("shouldShowLevelLock gates only the immediate next tier (#334)", () => {
    expect(shouldShowLevelLock(1, 2)).toBe(true);
    expect(shouldShowLevelLock(1, 3)).toBe(false);
    expect(shouldShowLevelLock(1, 4)).toBe(false);
    expect(shouldShowLevelLock(4, 5)).toBe(true);
    expect(shouldShowLevelLock(4, 4)).toBe(false);
    expect(shouldShowLevelLock(5, 5)).toBe(false);
    expect(shouldShowLevelLock(undefined, 2)).toBe(false);
  });

  it("shouldShowPodiumLevelLock skips Last Buy and disconnected secondary tiers (#334)", () => {
    expect(shouldShowPodiumLevelLock(true, 1, 2, 1)).toBe(true);
    expect(shouldShowPodiumLevelLock(true, 1, 3, 2)).toBe(false);
    expect(shouldShowPodiumLevelLock(false, undefined, 2, 1)).toBe(false);
    expect(shouldShowPodiumLevelLock(true, 1, 1, 0)).toBe(false);
  });

  it("shouldShowPodiumFeatureLock keeps hero Last Buy unlocked while side rail gates (#334)", () => {
    const gated = {
      walletConnected: false,
      viewerLevel: undefined,
      walletSurfaceUnlocked: false,
      walletStatsPending: false,
    };
    expect(
      shouldShowPodiumFeatureLock({ ...gated, categoryIndex: 0, requiredLevel: 1 }),
    ).toEqual({ locked: false, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...gated, categoryIndex: 1, requiredLevel: 2 }),
    ).toEqual({ locked: true, lockedForConnection: true });
  });

  it("shouldShowPodiumFeatureLock locks secondary tiers while wallet stats load (#334)", () => {
    const pending = {
      walletConnected: true,
      viewerLevel: 1,
      walletSurfaceUnlocked: false,
      walletStatsPending: true,
    };
    expect(
      shouldShowPodiumFeatureLock({ ...pending, categoryIndex: 0, requiredLevel: 1 }),
    ).toEqual({ locked: false, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...pending, categoryIndex: 1, requiredLevel: 2 }),
    ).toEqual({ locked: true, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...pending, categoryIndex: 3, requiredLevel: 4 }),
    ).toEqual({ locked: true, lockedForConnection: false });
  });

  it("shouldShowPodiumFeatureLock locks secondary tiers before wallet buy (#334)", () => {
    const preBuy = {
      walletConnected: true,
      viewerLevel: 1,
      walletSurfaceUnlocked: false,
      walletStatsPending: false,
    };
    expect(
      shouldShowPodiumFeatureLock({ ...preBuy, categoryIndex: 0, requiredLevel: 1 }),
    ).toEqual({ locked: false, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...preBuy, categoryIndex: 1, requiredLevel: 2 }),
    ).toEqual({ locked: true, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...preBuy, categoryIndex: 2, requiredLevel: 3 }),
    ).toEqual({ locked: true, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...preBuy, categoryIndex: 3, requiredLevel: 4 }),
    ).toEqual({ locked: true, lockedForConnection: false });
  });

  it("shouldShowPodiumFeatureLock marks disconnected locks for connect copy (#334)", () => {
    expect(
      shouldShowPodiumFeatureLock({
        categoryIndex: 2,
        requiredLevel: 3,
        walletConnected: false,
        viewerLevel: undefined,
        walletSurfaceUnlocked: false,
      }),
    ).toEqual({ locked: true, lockedForConnection: true });
  });

  it("shouldShowPodiumFeatureLock shows only next tier after wallet buy (#334)", () => {
    const postBuy = {
      walletConnected: true,
      viewerLevel: 1,
      walletSurfaceUnlocked: true,
      walletStatsPending: false,
    };
    expect(
      shouldShowPodiumFeatureLock({ ...postBuy, categoryIndex: 1, requiredLevel: 2 }),
    ).toEqual({ locked: true, lockedForConnection: false });
    expect(
      shouldShowPodiumFeatureLock({ ...postBuy, categoryIndex: 2, requiredLevel: 3 }),
    ).toEqual({ locked: false, lockedForConnection: false });
  });
});
