// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Copy and titles for **USD-shaped** figures that are **not** live oracle quotes.
 * See [GitLab #192](https://gitlab.com/PlasticDigits/yieldomega/-/issues/192).
 */

/** Arena hero “TOTAL USD” uses {@link CL8Y_USD_PRICE_PLACEHOLDER} (1:1) on total CL8Y raised. */
export const ARENA_TOTAL_USD_EQUIV_TITLE =
  "Total USD multiplies onchain total CL8Y raised by a fixed placeholder (1 CL8Y = 1 USD). It is not a live FX or oracle quote. The CL8Y total refreshes with the same ~1s contract poll as the rest of the hero.";

/** Simple podium “≈ $… USD” uses {@link fallbackPayTokenWeiForCl8y} `usdm` shape (0.98×). */
export const SIMPLE_PODIUM_USD_EQUIV_TITLE =
  "≈ USD uses the app’s static display-only CL8Y→USDM shape (0.98× per product default), not a live stablecoin price. CL8Y prize amounts follow onchain/indexer reads.";

/**
 * Compact relative age for “last seen CL8Y basis” labels (P3 — non-alarming).
 * @param fromMs wall-clock when the underlying CL8Y read last changed
 * @param nowMs wall-clock reference (typically `Date.now()`)
 */
export function formatRelativeFreshnessEnglish(fromMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (sec < 8) {
    return "just now";
  }
  if (sec < 60) {
    return `${sec}s ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
