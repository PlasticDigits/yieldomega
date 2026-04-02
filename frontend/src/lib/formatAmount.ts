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

/** Formatted views of one onchain amount; `raw` is the smallest-unit string for tests / tooling only—not for user-facing UI. */
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

/**
 * Locale grouping for plain whole numbers: gas units, block height, timer seconds, buy counts.
 * **Not** for token wei/WAD or charm weight — use `AmountDisplay` / `formatCompactFromRaw` instead.
 */
/** Basis points → percent for display (10_000 bps = 100%). E.g. `3000` → `"30.00%"`. */
export function formatBpsAsPercent(bps: number, fractionDigits = 2): string {
  if (!Number.isFinite(bps)) {
    return "—";
  }
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

export function formatLocaleInteger(value: bigint | number | string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return Math.trunc(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  try {
    const b = typeof value === "bigint" ? value : BigInt(String(value).trim() || "0");
    return b.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(value);
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

function unixSecToValidNumber(sec: bigint): number | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0 || n > 1e15) {
    return null;
  }
  return n;
}

/** Locale date/time for display (see `docs/frontend/design.md` — timestamps). */
export function formatUnixSec(sec: bigint): string {
  const n = unixSecToValidNumber(sec);
  if (n === null) {
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

/** UTC ISO-8601 for display (not raw unix seconds). */
export function formatUnixSecIsoUtc(sec: bigint): string {
  const n = unixSecToValidNumber(sec);
  if (n === null) {
    return "—";
  }
  try {
    return new Date(n * 1000).toISOString();
  } catch {
    return "—";
  }
}
