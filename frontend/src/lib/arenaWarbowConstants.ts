// SPDX-License-Identifier: AGPL-3.0-only

/** `TimeArena` WarBow costs are ratios of the epoch CHARM anchor, not the live growth price. */
export const WARBOW_STEAL_ANCHOR_DIV = 5n;
export const WARBOW_GUARD_ANCHOR_DIV = 2n;
export const WARBOW_REVENGE_ANCHOR_DIV = 5n;
/** DeployDev anchor and a display fallback while an indexer head is unavailable. */
export const DEV_DEFAULT_ANCHOR_WAD = 1000n * 10n ** 18n;

export function warbowStealDoubFromAnchor(anchorWad: bigint): bigint {
  return anchorWad / WARBOW_STEAL_ANCHOR_DIV;
}

export function warbowGuardDoubFromAnchor(anchorWad: bigint): bigint {
  return anchorWad / WARBOW_GUARD_ANCHOR_DIV;
}

export function warbowRevengeDoubFromAnchor(anchorWad: bigint): bigint {
  return anchorWad / WARBOW_REVENGE_ANCHOR_DIV;
}

export const WARBOW_STEAL_LIMIT_BYPASS_DOUB_WAD = 50_000n * 10n ** 18n;
export const WARBOW_MAX_STEALS_PER_DAY = 3;
export const WARBOW_SECONDS_PER_DAY = 86_400n;
/** Onchain `WARBOW_FLAG_SILENCE_SEC` — plant-to-claim quiet window. */
export const WARBOW_FLAG_SILENCE_SEC = 300;
export const WARBOW_FLAG_CLAIM_BP = 1000n;
export const WARBOW_GUARD_DURATION_SEC = 6 * 60 * 60;
export const WARBOW_REVENGE_WINDOW_SEC = 24 * 60 * 60;
export const WARBOW_STEAL_DRAIN_BPS = 1000;
export const WARBOW_STEAL_DRAIN_GUARDED_BPS = 100;
