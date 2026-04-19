// SPDX-License-Identifier: AGPL-3.0-only

/** UX label order. Contract reads use {@link PODIUM_CONTRACT_CATEGORY_INDEX}. */
export const PODIUM_LABELS = ["Last Buy", "WarBow", "Defended Streak", "Time Booster"] as const;

export const PODIUM_HELP = [
  "40% of the prize pool. The final buyer takes first, with the two buyers before them taking second and third.",
  "25% of the prize pool. Top Battle Points on the WarBow ladder (1st / 2nd / 3rd).",
  "20% of the prize pool. Tracks the best under-15-minute defended streak per wallet.",
  "15% of the prize pool. Tracks the wallets that added the most real seconds to the deadline.",
] as const;

/** Maps each {@link PODIUM_LABELS} slot to `TimeCurve.podium(category)` index. */
export const PODIUM_CONTRACT_CATEGORY_INDEX: readonly number[] = [0, 3, 2, 1];
