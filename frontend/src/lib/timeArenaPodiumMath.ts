// SPDX-License-Identifier: AGPL-3.0-only

/** Arena v2 DOUB buy split (basis points, sum 10_000) — matches `ArenaBuyRouting.sol`. */
export const ARENA_DOUB_ROUTING_BPS = {
  activePodium: 4000,
  seedPodium: 3000,
  adminVault: 3000,
} as const;

/** @deprecated Use `ARENA_DOUB_ROUTING_BPS`. Kept so older imports fail loudly in review. */
export const RESERVE_FEE_ROUTING_BPS = ARENA_DOUB_ROUTING_BPS;

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
