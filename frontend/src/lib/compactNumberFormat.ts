// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";

/** Beyond `t` (10¹² scale) use `e+` scientific notation. */
const SCIENTIFIC_THRESHOLD = 1e15;

export type FormatCompactOptions = {
  /** Significant figures (default 3). */
  sigfigs?: number;
};

function trimFloatString(s: string): string {
  if (!s.includes(".") && !s.toLowerCase().includes("e")) {
    return s;
  }
  if (s.toLowerCase().includes("e")) {
    return s.replace(/\.0+e/i, "e").replace(/(\.\d*?)0+e/i, "$1e");
  }
  return s.replace(/\.?0+$/, "").replace(/\.$/, "");
}

/**
 * Format a positive magnitude (already absolute) using JS number semantics.
 */
function formatAbsNumber(av: number, sigfigs: number): string {
  if (av === 0) {
    return "0";
  }
  if (av >= SCIENTIFIC_THRESHOLD) {
    return normalizeScientificString(av.toPrecision(sigfigs));
  }
  if (av < 1e3) {
    return trimFloatString(av.toPrecision(sigfigs));
  }
  let divisor = 1e3;
  let suffix = "k";
  if (av >= 1e12) {
    divisor = 1e12;
    suffix = "t";
  } else if (av >= 1e9) {
    divisor = 1e9;
    suffix = "b";
  } else if (av >= 1e6) {
    divisor = 1e6;
    suffix = "m";
  }
  const scaled = av / divisor;
  const p = scaled.toPrecision(sigfigs);
  if (p.includes("e") || p.includes("E")) {
    return normalizeScientificString(av.toPrecision(sigfigs));
  }
  return `${trimFloatString(p)}${suffix}`;
}

/**
 * Normalize `toPrecision` output to use a lowercase `e` and `e+` for non-negative exponents.
 */
export function normalizeScientificString(s: string): string {
  const t = s.trim().replace(/E/g, "e");
  const m = t.match(/^(-?)(\d+(?:\.\d+)?)e([+-])(\d+)$/i);
  if (!m) {
    return t;
  }
  const [, sign, coef, es, expStr] = m;
  const exp = Number(`${es === "-" ? "-" : ""}${expStr}`);
  if (exp >= 0) {
    return `${sign}${coef}e+${exp}`;
  }
  return `${sign}${coef}e${exp}`;
}

/**
 * When `Number(decimal)` overflows, build `e+` form from integer digit string (positive only).
 */
function formatHugePositiveIntegerString(intDigits: string, sigfigs: number): string {
  const d = intDigits.replace(/^0+/, "") || "0";
  if (d === "0") {
    return "0";
  }
  const exp = d.length - 1;
  const take = d.slice(0, Math.min(sigfigs, d.length));
  const coef = take.length === 1 ? take : `${take[0]}.${take.slice(1)}`;
  return `${coef}e+${exp}`;
}

/**
 * Fallback for decimal strings that do not fit in `Number` (overflow / lossy).
 */
function formatCompactHugeDecimalString(body: string, sigfigs: number): string {
  const [ip, fp = ""] = body.split(".");
  const intDigits = ip.replace(/^0+/, "") || "0";
  if (intDigits !== "0") {
    return formatHugePositiveIntegerString(intDigits, sigfigs);
  }
  const fd = fp.replace(/0+$/, "");
  if (!fd || /^0*$/.test(fd)) {
    return "0";
  }
  const first = fd.match(/^[0-9]+/)?.[0] ?? "";
  if (!first) {
    return "0";
  }
  const rest = fd.slice(first.length);
  const expNeg = first.length;
  let take = (first + rest).slice(0, sigfigs);
  if (take.length < sigfigs) {
    take = take.padEnd(sigfigs, "0");
  }
  const coef = take.length === 1 ? take : `${take[0]}.${take.slice(1)}`;
  return `${coef}e-${expNeg}`;
}

/**
 * Human-readable compact amount: `k` / `m` / `b` / `t` then `e+` (or `e-`) with configurable significant figures.
 */
export function formatCompactDecimalString(
  decimalStr: string,
  options?: FormatCompactOptions,
): string {
  const sigfigs = Math.max(1, options?.sigfigs ?? 3);
  const trimmed = decimalStr.trim();
  if (trimmed === "" || trimmed === "-") {
    return trimmed;
  }
  const neg = trimmed.startsWith("-");
  const body = neg ? trimmed.slice(1) : trimmed;
  const n = Number(body);
  if (!Number.isFinite(n)) {
    const out = formatCompactHugeDecimalString(body, sigfigs);
    return neg ? `-${out}` : out;
  }
  if (n === 0) {
    return "0";
  }
  const av = Math.abs(n);
  const out = formatAbsNumber(av, sigfigs);
  return neg ? `-${out}` : out;
}

/**
 * `formatUnits(raw, decimals)` then {@link formatCompactDecimalString}.
 */
export function formatCompactFromRaw(
  raw: bigint,
  decimals: number,
  options?: FormatCompactOptions,
): string {
  return formatCompactDecimalString(formatUnits(raw, decimals), options);
}
