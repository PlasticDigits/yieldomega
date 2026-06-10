// SPDX-License-Identifier: AGPL-3.0-only

/** Onchain player progression cap (GitLab #299). */
export const MAX_PLAYER_LEVEL = 5;

export type ArenaFeatureKey =
  | "last_buy"
  | "time_booster"
  | "defended_streak"
  | "warbow"
  | "warbow_flag";

/** Minimum level required to unlock each mechanic (#299 matrix). */
export const FEATURE_UNLOCK_LEVEL: Record<ArenaFeatureKey, number> = {
  last_buy: 1,
  time_booster: 2,
  defended_streak: 3,
  warbow: 4,
  warbow_flag: 5,
};

export function clampPlayerLevel(level: bigint | number): number {
  const n = typeof level === "bigint" ? Number(level) : level;
  if (!Number.isFinite(n) || n < 1) return 1;
  return n > MAX_PLAYER_LEVEL ? MAX_PLAYER_LEVEL : Math.floor(n);
}

export function isFeatureUnlocked(level: bigint | number, feature: ArenaFeatureKey): boolean {
  return clampPlayerLevel(level) >= FEATURE_UNLOCK_LEVEL[feature];
}

export function lockedUntilLevelCopy(requiredLevel: number): string {
  return `Locked until Level ${requiredLevel}`;
}

const TUTORIAL_STORAGE_PREFIX = "yieldomega.arena.featureTutorialSeen.v1.";

export function featureTutorialStorageKey(feature: ArenaFeatureKey): string {
  return `${TUTORIAL_STORAGE_PREFIX}${feature}`;
}

export function readFeatureTutorialSeen(feature: ArenaFeatureKey): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(featureTutorialStorageKey(feature)) === "1";
}

export function markFeatureTutorialSeen(feature: ArenaFeatureKey): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(featureTutorialStorageKey(feature), "1");
}

/** Progression tiers shown in the XP hero lock row (#299). */
export const ARENA_PROGRESSION_TIERS: ReadonlyArray<{
  feature: ArenaFeatureKey;
  shortLabel: string;
}> = [
  { feature: "last_buy", shortLabel: "Last Buy" },
  { feature: "time_booster", shortLabel: "Booster" },
  { feature: "defended_streak", shortLabel: "Streak" },
  { feature: "warbow", shortLabel: "WarBow" },
  { feature: "warbow_flag", shortLabel: "Flag" },
];

/** Map unlock level (2–5) to the feature key surfaced at that tier. */
export function featureKeyForUnlockLevel(level: number): ArenaFeatureKey | undefined {
  switch (level) {
    case 2:
      return "time_booster";
    case 3:
      return "defended_streak";
    case 4:
      return "warbow";
    case 5:
      return "warbow_flag";
    default:
      return undefined;
  }
}
