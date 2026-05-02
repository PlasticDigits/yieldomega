// SPDX-License-Identifier: AGPL-3.0-only

/** Not yet seeded from the leaderboard — never fire on this transition. */
export const WARBOW_RANK_SFX_UNSET = Symbol("warbowRankSfxUnset");

export type WarbowRankSfxPrior = typeof WARBOW_RANK_SFX_UNSET | number | null;

/**
 * Whether the indexed WarBow leaderboard rank warrants a restrained ladder stinger.
 * Mixer-level throttling still applies (indexer jitter / React re-render).
 *
 * Rules:
 * - Rank **improved** strictly (number goes **down**) **and** **new rank is in top 3**.
 * - **First observable** indexed top‑3 placement **from deeper or unranked** (entered ranks **1–3**).
 */
export function shouldPlayWarbowRankStinger(prev: WarbowRankSfxPrior, cur: number | null): boolean {
  if (prev === WARBOW_RANK_SFX_UNSET) return false;
  if (
    typeof prev === "number" &&
    cur !== null &&
    cur < prev &&
    cur <= 3
  ) {
    return true;
  }
  if (
    cur !== null &&
    cur <= 3 &&
    (prev === null || (typeof prev === "number" && prev > 3))
  ) {
    return true;
  }
  return false;
}
