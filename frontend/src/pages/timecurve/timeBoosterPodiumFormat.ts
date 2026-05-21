// SPDX-License-Identifier: AGPL-3.0-only

import { formatLocaleInteger } from "@/lib/formatAmount";
import { formatCountdown, formatLaunchCountdown, formatMmSsCountdown } from "./formatTimer";

const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;

function wholeSeconds(totalSec: number | bigint): number {
  const bi = typeof totalSec === "bigint" ? totalSec : BigInt(Math.floor(totalSec));
  const clamped = bi < 0n ? 0n : bi;
  return Number(clamped);
}

/**
 * Tiered clock formatting for Time Booster podium scores (`totalEffectiveTimerSecAdded`).
 *
 * Display-only — onchain/indexer values stay whole seconds.
 */
export function formatTimeBoosterPodiumSec(totalSec: number | bigint): string {
  const n = wholeSeconds(totalSec);

  if (n < SEC_PER_MIN) {
    return formatLocaleInteger(BigInt(n));
  }
  if (n < SEC_PER_HOUR) {
    return formatMmSsCountdown(n);
  }
  if (n < SEC_PER_DAY) {
    return formatCountdown(n);
  }
  const { days, clock } = formatLaunchCountdown(n);
  return `${days}:${clock}`;
}
