const CHARM_MIN_WAD = 99n * 10n ** 16n;
const CHARM_MAX_WAD = 10n * 10n ** 18n;

export function xpForCharm(charmWad: bigint): bigint {
  if (charmWad <= CHARM_MIN_WAD) return 1n;
  if (charmWad >= CHARM_MAX_WAD) return 10n;
  const range = CHARM_MAX_WAD - CHARM_MIN_WAD;
  const extra = ((charmWad - CHARM_MIN_WAD) * 9n) / range;
  return 1n + extra;
}

export function xpToAdvance(level: bigint): bigint {
  if (level === 0n) return 10n;
  let step = 10n + (level - 1n) * 5n;
  if (step > 100n) step = 100n;
  return step;
}

export function levelFromXp(xp: bigint): bigint {
  let level = 1n;
  let rem = xp;
  while (true) {
    const need = xpToAdvance(level);
    if (rem < need) break;
    rem -= need;
    level += 1n;
  }
  return level;
}

export function xpToNextLevel(xp: bigint): bigint {
  const level = levelFromXp(xp);
  let used = 0n;
  for (let l = 1n; l < level; l++) {
    used += xpToAdvance(l);
  }
  const need = xpToAdvance(level);
  const inLevel = xp - used;
  return need > inLevel ? need - inLevel : 0n;
}

export const MAX_LEVEL_UPS_PER_BUY = 5;
export const MAX_PLAYER_LEVEL = 5n;

export function clampLevel(level: bigint): bigint {
  return level > MAX_PLAYER_LEVEL ? MAX_PLAYER_LEVEL : level;
}

/** Buy-path incremental update (mirrors `ArenaXp.applyXpGain`, GitLab #265). */
export function applyXpGain(
  level: bigint,
  xpTowardNext: bigint,
  xpGain: bigint,
): { level: bigint; xpTowardNext: bigint } {
  if (level < 1n) throw new Error("level");
  if (level >= MAX_PLAYER_LEVEL) {
    return { level: MAX_PLAYER_LEVEL, xpTowardNext: 0n };
  }
  let newLevel = level;
  let newToward = xpTowardNext + xpGain;
  let levelsGained = 0;
  while (levelsGained < MAX_LEVEL_UPS_PER_BUY && newLevel < MAX_PLAYER_LEVEL) {
    const need = xpToAdvance(newLevel);
    if (newToward < need) break;
    newToward -= need;
    newLevel += 1n;
    levelsGained += 1;
  }
  if (newLevel >= MAX_PLAYER_LEVEL) {
    newLevel = MAX_PLAYER_LEVEL;
    newToward = 0n;
  }
  return { level: newLevel, xpTowardNext: newToward };
}

export function xpRemainingToNextLevel(level: bigint, xpTowardNext: bigint): bigint {
  if (level < 1n) throw new Error("level");
  if (level >= MAX_PLAYER_LEVEL) return 0n;
  const need = xpToAdvance(level);
  return need > xpTowardNext ? need - xpTowardNext : 0n;
}

/** Reconcile stale level with inflated `xp_toward_next` after optimistic/indexer drift. */
export function normalizeXpProgress(
  level: bigint,
  xpTowardNext: bigint,
): { level: bigint; xpTowardNext: bigint } {
  let lvl = level < 1n ? 1n : clampLevel(level);
  let toward = xpTowardNext < 0n ? 0n : xpTowardNext;
  if (lvl >= MAX_PLAYER_LEVEL) {
    return { level: MAX_PLAYER_LEVEL, xpTowardNext: 0n };
  }
  while (toward >= xpToAdvance(lvl) && lvl < MAX_PLAYER_LEVEL) {
    toward -= xpToAdvance(lvl);
    lvl += 1n;
  }
  if (lvl >= MAX_PLAYER_LEVEL) {
    return { level: MAX_PLAYER_LEVEL, xpTowardNext: 0n };
  }
  return { level: lvl, xpTowardNext: toward };
}
