// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import { formatCompactDecimalString } from "@/lib/compactNumberFormat";

/** Thousand-step suffixes: 1k = 10³ … ud = 10³⁶ (12 steps). */
export const THOUSAND_SUFFIXES = [
  "",
  "k",
  "m",
  "b",
  "t",
  "q",
  "qi",
  "sx",
  "sp",
  "oc",
  "no",
  "dc",
  "ud",
] as const;

export interface AmountTriple {
  raw: string;
  decimal: string;
  abbrev: string;
}

export function parseBigIntString(s: string): bigint {
  try {
    return BigInt(s.trim() || "0");
  } catch {
    return 0n;
  }
}

function trimTrailingZerosDecimal(s: string): string {
  if (!s.includes(".")) {
    return s;
  }
  return s.replace(/\.?0+$/, "").replace(/\.$/, "");
}

/**
 * Abbreviates a non-negative decimal string (e.g. from `formatUnits`) using k, m, b, …
 * (thousands grouping). Preserves precision from the input string.
 */
export function abbreviateDecimalString(decimalStr: string): string {
  if (decimalStr === "" || decimalStr === "-") {
    return decimalStr;
  }
  const neg = decimalStr.startsWith("-");
  const t = neg ? decimalStr.slice(1) : decimalStr;
  const [intPart, frac = ""] = t.split(".");
  const intDigits = intPart.replace(/^0+/, "") || "0";
  const len = intDigits.length;

  if (len <= 3) {
    const s = trimTrailingZerosDecimal(t);
    return neg ? `-${s}` : s;
  }

  const tier = Math.min(
    Math.floor((len - 1) / 3),
    THOUSAND_SUFFIXES.length - 1,
  );
  const shift = tier * 3;
  const pos = len - shift;
  const allDigits = intDigits + frac;
  const whole = allDigits.slice(0, pos);
  const rest = allDigits.slice(pos);
  let dotted = rest.length > 0 ? `${whole}.${rest}` : whole;
  dotted = trimTrailingZerosDecimal(dotted);
  const suffix = THOUSAND_SUFFIXES[tier];
  const out = `${dotted}${suffix}`;
  return neg ? `-${out}` : out;
}

export function formatAmountTriple(raw: bigint, decimals: number): AmountTriple {
  const rawStr = raw.toString();
  const decimal = formatUnits(raw, decimals);
  const abbrev = formatCompactDecimalString(decimal);
  return { raw: rawStr, decimal, abbrev };
}

export function formatUnixSec(sec: bigint): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0 || n > 1e15) {
    return "—";
  }
  try {
    return new Date(n * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}
