// SPDX-License-Identifier: AGPL-3.0-only

import { WAD } from "@/lib/timeCurveMath";

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
