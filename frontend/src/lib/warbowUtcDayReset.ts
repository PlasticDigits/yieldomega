// SPDX-License-Identifier: AGPL-3.0-only

/** Floor UTC day id — mirrors `TimeArena` `block.timestamp / SECONDS_PER_DAY`. */
export function warbowUtcDayId(chainNowSec: number, secondsPerDay: number | bigint): bigint {
  const day = Number(secondsPerDay);
  if (!Number.isFinite(chainNowSec) || day <= 0) return 0n;
  return BigInt(Math.floor(chainNowSec / day));
}

/** Whole seconds until the next UTC-day boundary (same `SECONDS_PER_DAY` floor division as onchain). */
export function warbowSecondsUntilNextUtcDay(
  chainNowSec: number,
  secondsPerDay: number | bigint,
): number {
  const day = Number(secondsPerDay);
  if (!Number.isFinite(chainNowSec) || day <= 0) return 0;
  const elapsedInDay = ((Math.floor(chainNowSec) % day) + day) % day;
  return day - elapsedInDay;
}
