// SPDX-License-Identifier: AGPL-3.0-only

/** Canonical TimeCurve → FeeRouter weights (basis points, sum 10_000). Order: LP · CL8Y burned · podium · team · Rabbit. */
export const RESERVE_FEE_ROUTING_BPS = {
  doubLpLockedLiquidity: 3000,
  /** Sale is in CL8Y; this slice is sent to the burn sink (not a separate “buy-and-burn” step). */
  cl8yBurned: 4000,
  podiumPool: 2000,
  team: 0,
  rabbitTreasury: 1000,
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

/**
 * Slices of the podium pool for UX order: Last Buy, WarBow, Defended Streak, Time Booster.
 * Matches `TimeCurve.distributePrizes` (40% / 25% / 20% / 15% of pool = 8/5/4/3% of gross raise).
 */
export function podiumCategorySlices(pool: bigint): [bigint, bigint, bigint, bigint] {
  if (pool <= 0n) {
    return [0n, 0n, 0n, 0n];
  }
  const last = (pool * 40n) / 100n;
  const war = (pool * 25n) / 100n;
  const def = (pool * 20n) / 100n;
  const time = pool - last - war - def;
  return [last, war, def, time];
}

/** Implied reserve (accepted asset wei) per 1 launched token wei at current totals — projection for UX. */
export function projectedReservePerDoubWad(totalRaised: bigint, totalTokensForSale: bigint): bigint | null {
  if (totalTokensForSale === 0n) {
    return null;
  }
  return (totalRaised * 10n ** 18n) / totalTokensForSale;
}

/**
 * Canonical **launch-liquidity anchor** vs per-CHARM **clearing** price (WAD ratio).
 * **1.275×** = **27.5%** above final clearing — product policy [GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158).
 * Use **`clearingWad * NUM / DEN`** for exact integer math (same ratio in {@link participantLaunchValueCl8yWei}).
 */
export const LAUNCH_LIQUIDITY_ANCHOR_NUM = 1275n;
export const LAUNCH_LIQUIDITY_ANCHOR_DEN = 1000n;

export function launchLiquidityAnchorWad(clearingWad: bigint): bigint {
  return (clearingWad * LAUNCH_LIQUIDITY_ANCHOR_NUM) / LAUNCH_LIQUIDITY_ANCHOR_DEN;
}

export function kumbayaBandLowerWad(launchAnchorWad: bigint): bigint {
  return (launchAnchorWad * 8n) / 10n;
}

/**
 * Live **DOUB per 1 CHARM at launch** — `totalTokensForSale / totalCharmWeight`
 * scaled to WAD. This is a **redemption rate**, not a holdings projection, and
 * it **decreases** as `totalCharmWeight` grows (more CHARM minted ⇒ each CHARM
 * redeems for less DOUB). Used by the Simple page rate board so participants
 * can see the full math chain `1 CHARM → X DOUB → Y CL8Y at launch` and trust
 * the **1.275×** launch anchor (see {@link participantLaunchValueCl8yWei}).
 *
 * Returns `undefined` when reads are pending or no CHARM has been minted yet
 * (denominator zero) so callers can render "—".
 */
export function doubPerCharmAtLaunchWad(input: {
  totalTokensForSaleWad: bigint | undefined;
  totalCharmWeightWad: bigint | undefined;
}): bigint | undefined {
  const { totalTokensForSaleWad, totalCharmWeightWad } = input;
  if (totalTokensForSaleWad === undefined || totalCharmWeightWad === undefined) return undefined;
  if (totalCharmWeightWad === 0n) return undefined;
  const WAD = 10n ** 18n;
  return (totalTokensForSaleWad * WAD) / totalCharmWeightWad;
}

/**
 * **Launch-anchor invariant (canonical)** — what 1 unit of CHARM is projected
 * to be worth in CL8Y *at launch*.
 *
 * The DOUB/CL8Y locked-liquidity sink (`DoubLPIncentives`) seeds liquidity at
 * **1.275× the per-CHARM clearing price**, so every CHARM held during the sale
 * is projected to redeem for `1.275 × pricePerCharmWad` CL8Y wei when the LP is
 * paired post-sale. See:
 *   • [`contracts/src/sinks/DoubLPIncentives.sol`](../../../contracts/src/sinks/DoubLPIncentives.sol)
 *   • [`docs/onchain/fee-routing-and-governance.md`](../../../docs/onchain/fee-routing-and-governance.md)
 *   • [`docs/testing/invariants-and-business-logic.md`](../../../docs/testing/invariants-and-business-logic.md)
 *
 * Spec example (PARAMETERS / user brief): final per-CHARM price = 2 CL8Y,
 * 1 CHARM redeems for 100 DOUB → those 100 DOUB are worth `2 × 1.275 = 2.55`
 * CL8Y at launch. The DOUB count is intentionally absent from the formula
 * because DOUB-per-CHARM dilutes as `totalCharmWeight` grows; the CL8Y value
 * only depends on the per-CHARM price (which is monotone non-decreasing for
 * `LinearCharmPrice`), so the projection only ever stays the same or rises.
 *
 * Returns `undefined` when an input is missing so callers can render "—"
 * without leaking a bogus `0` to the UI.
 */
export function participantLaunchValueCl8yWei(input: {
  charmWeightWad: bigint | undefined;
  pricePerCharmWad: bigint | undefined;
}): bigint | undefined {
  const { charmWeightWad, pricePerCharmWad } = input;
  if (charmWeightWad === undefined || pricePerCharmWad === undefined) {
    return undefined;
  }
  if (charmWeightWad === 0n || pricePerCharmWad === 0n) {
    return 0n;
  }
  // Multiply first, divide last to avoid pre-truncation in WAD math.
  const WAD = 10n ** 18n;
  return (charmWeightWad * pricePerCharmWad * LAUNCH_LIQUIDITY_ANCHOR_NUM) / (LAUNCH_LIQUIDITY_ANCHOR_DEN * WAD);
}
