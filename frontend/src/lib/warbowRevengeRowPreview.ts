// SPDX-License-Identifier: AGPL-3.0-only

/**
 * WarBow revenge row preview math (GitLab #236).
 *
 * Mirrors onchain `TimeCurve._warbowStealDrainBp(stealerBp, WARBOW_STEAL_DRAIN_BPS)` so the
 * Arena revenge hero card can show the BP a successful revenge would reclaim before signing.
 *
 * Onchain formula (TimeCurve.sol):
 *   drain = (stealerBp * WARBOW_STEAL_DRAIN_BPS) / BPS_DENOMINATOR
 *   where WARBOW_STEAL_DRAIN_BPS = 1000 and BPS_DENOMINATOR = 10000.
 * Integer division floors toward zero — match the same semantics here via BigInt division.
 *
 * Display-only; the actual onchain call uses live state and the preflight narrative
 * (`revertMessage.ts`) surfaces "TimeCurve: revenge zero" when drain would be 0.
 */
export const WARBOW_STEAL_DRAIN_BPS = 1000n;
export const WARBOW_BPS_DENOMINATOR = 10000n;

/**
 * Compute BP reclaimed by a successful `warbowRevenge(stealer)`.
 *
 * @param stealerBp Current Battle Points of the stealer (live read).
 * @returns BP that would be drained from stealer and credited to the avenger. Returns 0n
 *   for non-positive input. Caller should surface a zero-drain hint in the row preview
 *   (see GitLab #236 acceptance criteria — "TimeCurve: revenge zero" narrative).
 */
export function warbowRevengeDrainBp(stealerBp: bigint): bigint {
  if (stealerBp <= 0n) {
    return 0n;
  }
  return (stealerBp * WARBOW_STEAL_DRAIN_BPS) / WARBOW_BPS_DENOMINATOR;
}
