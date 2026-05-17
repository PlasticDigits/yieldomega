// SPDX-License-Identifier: AGPL-3.0-only

/** Lower multiple for `TimeCurve.warbowSteal` victim vs attacker BP (matches onchain literal `2`). */
export const WARBOW_STEAL_VICTIM_MIN_MULT = 2n;
/** Upper multiple for `TimeCurve.warbowSteal` victim vs attacker BP (matches onchain literal `10`). */
export const WARBOW_STEAL_VICTIM_MAX_MULT = 10n;

/**
 * Mirrors `TimeCurve.warbowSteal` BP bracket after CL8Y pulls: attacker BP must be positive and
 * victim BP must satisfy `2× attacker ≤ victim ≤ 10× attacker` (uint256 `*` semantics).
 */
export function isWarbowStealVictimBpInBand(attackerBp: bigint, victimBp: bigint): boolean {
  if (attackerBp <= 0n) {
    return false;
  }
  const minVictim = attackerBp * WARBOW_STEAL_VICTIM_MIN_MULT;
  const maxVictim = attackerBp * WARBOW_STEAL_VICTIM_MAX_MULT;
  return victimBp >= minVictim && victimBp <= maxVictim;
}
