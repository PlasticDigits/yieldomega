// SPDX-License-Identifier: AGPL-3.0-only

/** Canonical TimeCurve → FeeRouter weights (basis points, sum 10_000). Order: LP · CL8Y · podium · team · Rabbit. */
export const RESERVE_FEE_ROUTING_BPS = {
  doubLpLockedLiquidity: 2500,
  cl8yBuyAndBurn: 3500,
  podiumPool: 2000,
  team: 0,
  rabbitTreasury: 2000,
} as const;

/** Within a category slice: 1st : 2nd : 3rd = 4 : 2 : 1. */
export function podiumPlacementShares(slice: bigint): [bigint, bigint, bigint] {
  if (slice <= 0n) {
    return [0n, 0n, 0n];
  }
  const first = (slice * 4n) / 7n;
  const second = (slice * 2n) / 7n;
  const third = slice - first - second;
  return [first, second, third];
}

/** Slices match `TimeCurve.distributePrizes`: [last buy, time booster, activity leader, defended streak]. */
export function podiumCategorySlices(pool: bigint): [bigint, bigint, bigint, bigint] {
  if (pool <= 0n) {
    return [0n, 0n, 0n, 0n];
  }
  const last = (pool * 50n) / 100n;
  const timeBooster = (pool * 20n) / 100n;
  const activity = (pool * 10n) / 100n;
  const defended = pool - last - timeBooster - activity;
  return [last, timeBooster, activity, defended];
}

/** Implied reserve (accepted asset wei) per 1 launched token wei at current totals — projection for UX. */
export function projectedReservePerDoubWad(totalRaised: bigint, totalTokensForSale: bigint): bigint | null {
  if (totalTokensForSale === 0n) {
    return null;
  }
  return (totalRaised * 10n ** 18n) / totalTokensForSale;
}

export function launchLiquidityAnchorWad(clearingWad: bigint): bigint {
  return (clearingWad * 12n) / 10n;
}

export function kumbayaBandLowerWad(launchAnchorWad: bigint): bigint {
  return (launchAnchorWad * 8n) / 10n;
}
