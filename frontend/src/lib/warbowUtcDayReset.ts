// SPDX-License-Identifier: AGPL-3.0-only

/** Whole seconds until the next UTC day boundary — matches `TimeArena` `block.timestamp / SECONDS_PER_DAY`. */
export function warbowUtcDayResetSec(chainNowSec: number, secondsPerDay: number): number {
  const daySec = Math.max(1, Math.floor(secondsPerDay));
  const now = Math.floor(chainNowSec);
  const elapsedInDay = ((now % daySec) + daySec) % daySec;
  return daySec - elapsedInDay;
}
