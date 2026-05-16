// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import {
  formatCompactDecimalString,
  formatCompactFromRaw,
  normalizeScientificString,
  truncatePlainDecimalSigfigsString,
} from "@/lib/compactNumberFormat";

/**
 * Significant figures for **derived** buy-hub amounts (live CL8Y band, routed pay
 * band hints, CHARM preview, CL8Y-at-launch projection, Arena buy summary chips).
 *
 * **Not** used for: hero “price now / at launch” tiles ({@link TIMECURVE_HERO_RATE_SIGFIGS}
 * sigfigs via {@link formatHeroRateFromWad} (truncated, trailing-zero padded) — see `TimeCurveSimplePage` /
 * `TimeCurveArenaView`), or DOUB-per-CHARM redemption compact
 * (**5** sigfigs — product choice). Wallet balances use `AmountDisplay`, which applies
 * the same **4** sigfig compact policy via `formatCompactFromRaw`.
 *
 * @see [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191)
 * @see `docs/frontend/timecurve-views.md` — Arena / Simple buy hub numeric display
 */
export const TIMECURVE_BUY_HUB_DERIVED_SIGFIGS = 4 as const;

/**
 * Significant figures for the primary **Buy CHARM** CTA amount (middle token of
 * `Buy {amount} CHARM`). **4** with **truncation** (see {@link formatBuyCtaCharmAmountLabel}) so the
 * label never rounds up past onchain-floored sizing; other derived hub numbers use
 * {@link TIMECURVE_BUY_HUB_DERIVED_SIGFIGS}.
 */
export const TIMECURVE_BUY_CTA_CHARM_SIGFIGS = 4 as const;

/** Significant figures for hero “1 CHARM = …” rate tiles (CL8Y / ETH / USDM). */
export const TIMECURVE_HERO_RATE_SIGFIGS = 6 as const;

/**
 * `formatUnits(raw, 18)` then {@link truncatePlainDecimalSigfigsString} at {@link TIMECURVE_HERO_RATE_SIGFIGS}
 * with trailing zeros kept so the label always shows exactly that many significant figures (truncation toward zero).
 */
export function formatHeroRateFromWad(raw: bigint): string {
  return truncatePlainDecimalSigfigsString(formatUnits(raw, 18), TIMECURVE_HERO_RATE_SIGFIGS, {
    preserveTrailingSigfigZeros: true,
  });
}

/** {@link formatCompactFromRaw} with {@link TIMECURVE_BUY_HUB_DERIVED_SIGFIGS}. */
export function formatBuyHubDerivedCompact(
  raw: bigint | string | number,
  decimals: number,
): string {
  return formatCompactFromRaw(raw, decimals, { sigfigs: TIMECURVE_BUY_HUB_DERIVED_SIGFIGS });
}

/**
 * CHARM size snippet for the buy CTA (`Buy 9.086e3 CHARM`): {@link formatUnits} at
 * 18 decimals, then {@link truncatePlainDecimalSigfigsString} at {@link TIMECURVE_BUY_CTA_CHARM_SIGFIGS}.
 * Scientific exponents use {@link normalizeScientificString} with a compact **`e`** form
 * (positive exponents omit **`+`** after **`e`**, e.g. `9.086e3`).
 */
export function formatBuyCtaCharmAmountLabel(charmWad: bigint): string {
  const decimalStr = formatUnits(charmWad, 18);
  let out = truncatePlainDecimalSigfigsString(decimalStr, TIMECURVE_BUY_CTA_CHARM_SIGFIGS);
  if (/e/i.test(out)) {
    out = normalizeScientificString(out).replace(/e\+/i, "e");
  }
  return out;
}

/**
 * Fixed-point decimal string for `num/den` with up to `maxFracDigits` after the radix (no rounding up).
 */
function decimalStringFromRational(num: bigint, den: bigint, maxFracDigits: number): string {
  if (den <= 0n) {
    return "0";
  }
  let sign = "";
  let n = num;
  if (n < 0n) {
    sign = "-";
    n = -n;
  }
  const intPart = n / den;
  let rem = n % den;
  let frac = "";
  for (let i = 0; i < maxFracDigits; i++) {
    rem *= 10n;
    frac += String(rem / den);
    rem %= den;
  }
  return `${sign}${intPart}.${frac}`;
}

/** Percent magnitudes where trailing zeros are significant (e.g. `27.50` for four sigfigs). */
function formatPercentMagnitudeSigfigs(decimalStr: string, sigfigs: number): string {
  const trimmed = decimalStr.trim();
  const neg = trimmed.startsWith("-");
  const body = neg ? trimmed.slice(1) : trimmed;
  const n = Number(body);
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) {
    return formatCompactDecimalString(trimmed, { sigfigs });
  }
  const p = n.toPrecision(sigfigs);
  return neg ? `-${p}` : p;
}

/**
 * **CL8Y-only** checkout preview: implied clearing CL8Y for the floored CHARM size vs launch-anchored CL8Y
 * (`participantLaunchValueCl8yWei`). At the canonical **1.275×** anchor this is about **+27.5%** above
 * clearing spend ([GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158)).
 *
 * Returns a label like `+27.50% GAIN` using {@link TIMECURVE_BUY_HUB_DERIVED_SIGFIGS}. When spend and
 * launch value are in the same wei denomination (CL8Y), this is `100 × (approx − spend) / spend`.
 */
export function formatBuyHubLaunchVsClearingGainPercentLabel(input: {
  clearingSpendCl8yWei: bigint | undefined;
  approxLaunchCl8yWei: bigint | undefined;
}): string | null {
  const spend = input.clearingSpendCl8yWei;
  const approx = input.approxLaunchCl8yWei;
  if (spend === undefined || approx === undefined) return null;
  if (spend <= 0n || approx <= 0n) return null;

  const raw = decimalStringFromRational((approx - spend) * 100n, spend, 24);
  const trimmed = raw.trim();
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n === 0) {
    return "+0.000% GAIN";
  }
  const compact = formatPercentMagnitudeSigfigs(trimmed, TIMECURVE_BUY_HUB_DERIVED_SIGFIGS);
  const neg = trimmed.startsWith("-");
  return neg ? `${compact}% GAIN` : `+${compact}% GAIN`;
}
