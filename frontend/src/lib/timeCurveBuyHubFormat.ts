// SPDX-License-Identifier: AGPL-3.0-only

import { formatCompactFromRaw } from "@/lib/compactNumberFormat";

/**
 * Significant figures for **derived** buy-hub amounts (live CL8Y band, routed pay
 * band hints, CHARM preview, CL8Y-at-launch projection, Arena buy summary chips).
 *
 * **Not** used for: hero “price now / at launch” tiles (fixed fractional digits so
 * per-block ticks stay visible — see `TimeCurveSimplePage` / `TimeCurveArenaView`
 * `formatPriceFixed6` / `formatEthRateHero`), wallet balances (`AmountDisplay`),
 * or DOUB-per-CHARM redemption compact (**5** sigfigs — product choice).
 *
 * @see [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191)
 * @see `docs/frontend/timecurve-views.md` — Arena / Simple buy hub numeric display
 */
export const TIMECURVE_BUY_HUB_DERIVED_SIGFIGS = 4 as const;

/** {@link formatCompactFromRaw} with {@link TIMECURVE_BUY_HUB_DERIVED_SIGFIGS}. */
export function formatBuyHubDerivedCompact(
  raw: bigint | string | number,
  decimals: number,
): string {
  return formatCompactFromRaw(raw, decimals, { sigfigs: TIMECURVE_BUY_HUB_DERIVED_SIGFIGS });
}
