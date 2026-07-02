// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";

/** Slider + default buy amount display for DOUB / USDM / CL8Y / CRED (not ETH). */
export const ARENA_PAY_SPEND_INPUT_SLIDER_FRACTION_DIGITS = 2;

/**
 * Truncate a plain decimal string toward zero at `fractionDigits` after the dot.
 * Does not round up (30058.769 → 30058.76 at 2 places).
 */
export function truncateDecimalStringToFractionPlaces(
  decimalStr: string,
  fractionDigits: number,
): string {
  const places = Math.max(0, Math.floor(fractionDigits));
  const trimmed = decimalStr.trim();
  if (trimmed === "" || trimmed === "-") {
    return trimmed;
  }
  const neg = trimmed.startsWith("-");
  const body = neg ? trimmed.slice(1) : trimmed;
  const dot = body.indexOf(".");
  if (dot < 0) {
    return neg ? `-${body}` : body;
  }
  const intPart = body.slice(0, dot);
  const fracPart = body.slice(dot + 1);
  const truncatedFrac = fracPart.slice(0, places);
  const withoutTrailingZeros = truncatedFrac.replace(/0+$/, "");
  const out =
    withoutTrailingZeros.length > 0 ? `${intPart}.${withoutTrailingZeros}` : intPart;
  return neg ? `-${out}` : out;
}

export function formatArenaPaySpendInputDisplay(
  wei: bigint,
  tokenDecimals: number,
  payWith: PayWithAsset,
  options?: { compactFractionDigits?: number },
): string {
  const full = formatUnits(wei, tokenDecimals);
  if (payWith === "eth") {
    return full;
  }
  const compact = options?.compactFractionDigits;
  if (compact === undefined) {
    return full;
  }
  return truncateDecimalStringToFractionPlaces(full, compact);
}
