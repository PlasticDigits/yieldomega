// SPDX-License-Identifier: AGPL-3.0-only

/** Lower multiple for `TimeArena.warbowSteal` victim vs attacker BP (matches onchain literal `1`). */
export const WARBOW_STEAL_VICTIM_MIN_MULT = 1n;
/** Upper multiple for `TimeArena.warbowSteal` victim vs attacker BP (matches onchain literal `50`). */
export const WARBOW_STEAL_VICTIM_MAX_MULT = 50n;

/**
 * Mirrors `TimeArena.warbowSteal` BP bracket after DOUB pulls: attacker BP must be positive and
 * victim BP must satisfy `1× attacker ≤ victim ≤ 50× attacker` (uint256 `*` semantics).
 */
export function isWarbowStealVictimBpInBand(attackerBp: bigint, victimBp: bigint): boolean {
  if (attackerBp <= 0n) {
    return false;
  }
  const minVictim = attackerBp * WARBOW_STEAL_VICTIM_MIN_MULT;
  const maxVictim = attackerBp * WARBOW_STEAL_VICTIM_MAX_MULT;
  return victimBp >= minVictim && victimBp <= maxVictim;
}
