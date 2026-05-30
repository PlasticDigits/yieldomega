// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import {
  formatCompactFromRaw,
  normalizeScientificString,
  truncatePlainDecimalSigfigsString,
} from "@/lib/compactNumberFormat";

/**
 * Significant figures for **derived** buy-hub amounts (live CL8Y band, routed pay
 * band hints, CHARM preview, Arena buy summary chips).
 *
 * **Not** used for: hero per-CHARM rate tiles ({@link ARENA_HERO_RATE_SIGFIGS}
 * sigfigs via {@link formatHeroRateFromWad} — see `ArenaSimplePage`). Wallet balances use `AmountDisplay`, which applies
 * the same **4** sigfig compact policy via `formatCompactFromRaw`.
 *
 * @see [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191)
 * @see `docs/frontend/arena-views.md` — Arena / Simple buy hub numeric display
 */
export const ARENA_BUY_HUB_DERIVED_SIGFIGS = 4 as const;

/**
 * Significant figures for the primary **Buy CHARM** CTA amount (middle token of
 * `Buy {amount} CHARM`). **4** with **truncation** (see {@link formatBuyCtaCharmAmountLabel}) so the
 * label never rounds up past onchain-floored sizing; other derived hub numbers use
 * {@link ARENA_BUY_HUB_DERIVED_SIGFIGS}.
 */
export const ARENA_BUY_CTA_CHARM_SIGFIGS = 4 as const;

/** Significant figures for hero “1 CHARM = …” rate tiles (CL8Y / ETH / USDM). */
export const ARENA_HERO_RATE_SIGFIGS = 6 as const;

/**
 * `formatUnits(raw, 18)` then {@link truncatePlainDecimalSigfigsString} at {@link ARENA_HERO_RATE_SIGFIGS}
 * with trailing zeros kept so the label always shows exactly that many significant figures (truncation toward zero).
 */
export function formatHeroRateFromWad(raw: bigint): string {
  return truncatePlainDecimalSigfigsString(formatUnits(raw, 18), ARENA_HERO_RATE_SIGFIGS, {
    preserveTrailingSigfigZeros: true,
  });
}

/** {@link formatCompactFromRaw} with {@link ARENA_BUY_HUB_DERIVED_SIGFIGS}. */
export function formatBuyHubDerivedCompact(
  raw: bigint | string | number,
  decimals: number,
): string {
  return formatCompactFromRaw(raw, decimals, { sigfigs: ARENA_BUY_HUB_DERIVED_SIGFIGS });
}

/**
 * CHARM size snippet for the buy CTA (`Buy 9.086e3 CHARM`): {@link formatUnits} at
 * 18 decimals, then {@link truncatePlainDecimalSigfigsString} at {@link ARENA_BUY_CTA_CHARM_SIGFIGS}.
 * Scientific exponents use {@link normalizeScientificString} with a compact **`e`** form
 * (positive exponents omit **`+`** after **`e`**, e.g. `9.086e3`).
 */
export function formatBuyCtaCharmAmountLabel(charmWad: bigint): string {
  const decimalStr = formatUnits(charmWad, 18);
  let out = truncatePlainDecimalSigfigsString(decimalStr, ARENA_BUY_CTA_CHARM_SIGFIGS);
  if (/e/i.test(out)) {
    out = normalizeScientificString(out).replace(/e\+/i, "e");
  }
  return out;
}
