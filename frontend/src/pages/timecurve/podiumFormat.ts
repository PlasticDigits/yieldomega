// SPDX-License-Identifier: AGPL-3.0-only

import { formatLocaleInteger } from "@/lib/formatAmount";
import { formatTimeBoosterPodiumSec } from "./timeBoosterPodiumFormat";

/** `categoryIndex` follows {@link PODIUM_LABELS} order: 0 Last Buy, 1 WarBow, 2 Defended, 3 Time Booster. */
export function formatPodiumLeaderboardValue(categoryIndex: number, raw: string): string {
  const bi = BigInt(raw);
  if (categoryIndex === 3) {
    return formatTimeBoosterPodiumSec(bi);
  }
  if (categoryIndex === 1) {
    return `${formatLocaleInteger(bi)} BP`;
  }
  return formatLocaleInteger(bi);
}
