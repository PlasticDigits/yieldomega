// SPDX-License-Identifier: AGPL-3.0-only

import { type ArenaFeatureKey } from "@/lib/arenaProgression";
import { PODIUM_CONTRACT_TO_UX_CATEGORY } from "@/pages/arena/arenaSimplePodiumRanking";
import { PODIUM_LABELS } from "@/pages/arena/podiumCopy";

/** Timer bay carousel order — matches side-rail {@link ArenaTimerChips} contract index order. */
export const TIMER_PODIUM_CAROUSEL_SLOTS = [
  {
    contractIndex: 0,
    categoryIndex: 0,
    feature: "last_buy" as ArenaFeatureKey,
    label: PODIUM_LABELS[0],
    requiredLevel: 1,
  },
  {
    contractIndex: 1,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[1]!,
    feature: "time_booster" as ArenaFeatureKey,
    label: PODIUM_LABELS[3],
    requiredLevel: 2,
  },
  {
    contractIndex: 2,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[2]!,
    feature: "defended_streak" as ArenaFeatureKey,
    label: PODIUM_LABELS[2],
    requiredLevel: 3,
  },
  {
    contractIndex: 3,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[3]!,
    feature: "warbow" as ArenaFeatureKey,
    label: PODIUM_LABELS[1],
    requiredLevel: 4,
  },
] as const;

export const TIMER_PODIUM_CAROUSEL_COUNT = TIMER_PODIUM_CAROUSEL_SLOTS.length;

export function normalizeTimerPodiumSlideIndex(index: number): number {
  const count = TIMER_PODIUM_CAROUSEL_COUNT;
  if (!Number.isFinite(index)) return 0;
  return ((Math.floor(index) % count) + count) % count;
}
