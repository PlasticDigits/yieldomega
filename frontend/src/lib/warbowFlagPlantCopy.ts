// SPDX-License-Identifier: AGPL-3.0-only

import { formatLocaleInteger } from "@/lib/formatAmount";

/**
 * One-line explainer for the ADVANCED “plant WarBow flag” checkbox — values track
 * {@link TimeCurve.WARBOW_FLAG_CLAIM_BP}, `WARBOW_FLAG_CLAIM_BP * 2` penalty, and
 * {@link TimeCurve.WARBOW_FLAG_SILENCE_SEC} (shown as whole minutes, rounded up).
 */
export function warbowFlagPlantMutedLine(opts: { claimBp: bigint; silenceSec: bigint }): string {
  const loseBp = opts.claimBp * 2n;
  const minutes = BigInt(Math.max(1, Math.ceil(Number(opts.silenceSec) / 60)));
  return `Earn ${formatLocaleInteger(opts.claimBp)} WarBow Points if no one buys in ${formatLocaleInteger(minutes)} minutes, lose ${formatLocaleInteger(loseBp)} WarBow Points if someone buys before that time ends.`;
}
