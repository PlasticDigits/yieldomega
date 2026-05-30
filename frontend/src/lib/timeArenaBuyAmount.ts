// SPDX-License-Identifier: AGPL-3.0-only

import { WAD } from "@/lib/timeArenaMath";

export type Cl8ySpendBounds = { minS: bigint; maxS: bigint };

function clampBigintSpend(x: bigint, lo: bigint, hi: bigint): bigint {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/**
 * When the CL8Y spend band changes (notably wallet balance after a buy), keep the
 * same slider position (permille along `[minS, maxS]`) instead of snapping to the midpoint.
 */
export function reconcileSpendWeiToCl8yBounds(args: {
  prevSpendWei: bigint;
  nextBounds: Cl8ySpendBounds;
  prevBounds: Cl8ySpendBounds | null;
}): bigint {
  const { minS, maxS } = args.nextBounds;
  const prev = args.prevSpendWei;
  if (maxS <= minS) {
    return clampBigintSpend(prev, minS, maxS);
  }

  if (prev === 0n) {
    return minS + (maxS - minS) / 2n;
  }
  if (prev >= minS && prev <= maxS) {
    return prev;
  }

  if (args.prevBounds) {
    const pMin = args.prevBounds.minS;
    const pMax = args.prevBounds.maxS;
    const span = pMax - pMin;
    if (span > 0n) {
      const permille = clampBigintSpend(((prev - pMin) * 10000n) / span, 0n, 10000n);
      const newSpan = maxS - minS;
      const mapped = minS + (newSpan * permille) / 10000n;
      return clampBigintSpend(mapped, minS, maxS);
    }
  }

  return clampBigintSpend(minS + (maxS - minS) / 2n, minS, maxS);
}

/** Map desired CL8Y spend to onchain `charmWad`, clamping to `[minCharmWad, maxCharmWad]`; returns implied gross spend after clamp. */
export function finalizeCharmSpendForBuy(
  spendWei: bigint,
  pricePerCharmWad: bigint,
  minCharmWad: bigint,
  maxCharmWad: bigint,
): { charmWad: bigint; spendWei: bigint } {
  if (pricePerCharmWad <= 0n) {
    throw new Error("pricePerCharmWad must be positive");
  }
  /** Integer division **floors** CHARM from CL8Y spend (never rounds up past the band). */
  let cw = (spendWei * WAD) / pricePerCharmWad;
  if (cw < minCharmWad) cw = minCharmWad;
  if (cw > maxCharmWad) cw = maxCharmWad;
  const spendOut = (cw * pricePerCharmWad) / WAD;
  return { charmWad: cw, spendWei: spendOut };
}
