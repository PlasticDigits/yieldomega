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
 * Plain decimal string with `sigfigs` significant figures.
 * Unlike {@link formatCompactDecimalString}, never inserts `k` / `m` / `b` / `t` suffixes
 * (intended for hero rate tiles and similar “full” magnitudes below ~1e15).
 */
export function formatPlainDecimalSigfigsString(decimalStr: string, sigfigs: number): string {
  const sf = Math.max(1, Math.floor(sigfigs));
  const trimmed = decimalStr.trim();
  if (trimmed === "" || trimmed === "-") {
    return trimmed;
  }
  const neg = trimmed.startsWith("-");
  const body = neg ? trimmed.slice(1) : trimmed;
  const n = Number(body);
  if (!Number.isFinite(n)) {
    const out = formatCompactHugeDecimalString(body, sf);
    return neg ? `-${out}` : out;
  }
  if (n === 0) {
    return "0";
  }
  const av = Math.abs(n);
  if (av >= SCIENTIFIC_THRESHOLD) {
    const sci = normalizeScientificString(av.toPrecision(sf));
    return neg ? `-${sci}` : sci;
  }
  const coef = trimFloatString(av.toPrecision(sf));
  return neg ? `-${coef}` : coef;
}

function unsignedDecimalFromTruncatedCoef(
  coefStr: string,
  exp: number,
  sf: number,
  preserveTrailingSigfigZeros?: boolean,
): string {
  const coeff = BigInt(coefStr);
  const scale = sf - 1;
  const power = exp - scale;
  if (power >= 0) {
    return (coeff * 10n ** BigInt(power)).toString();
  }
  const den = 10n ** BigInt(-power);
  const intPart = coeff / den;
  const rem = coeff % den;
  const denLen = Number(-power);
  const fracRaw = rem.toString().padStart(denLen, "0");
  const joined = intPart === 0n ? `0.${fracRaw}` : `${intPart}.${fracRaw}`;
  return preserveTrailingSigfigZeros ? joined : trimFloatString(joined);
}

function absPlainDecimalMagnitudeGeSciThreshold(absUnsignedPlain: string): boolean {
  const [ip] = absUnsignedPlain.split(".");
  const intDigits = ip.replace(/^0+/, "") || "0";
  if (intDigits === "0") {
    return false;
  }
  try {
    return BigInt(intDigits) >= 10n ** 15n;
  } catch {
    return intDigits.length > 16;
  }
}

export type TruncatePlainDecimalSigfigsOptions = {
  /**
   * When true, keep trailing fractional zeros so the string always shows exactly `sigfigs`
   * significant digits (for example `1.01000` at six figures from a short `formatUnits` tail).
   * Default false trims insignificant trailing zeros (existing compact labels).
   */
  preserveTrailingSigfigZeros?: boolean;
};

/**
 * Plain decimal string with `sigfigs` significant figures by **truncating** extra digits (toward zero),
 * never rounding up. Uses exact digit logic on `[-]digits[.digits]` inputs (for example {@link formatUnits} output).
 */
export function truncatePlainDecimalSigfigsString(
  decimalStr: string,
  sigfigs: number,
  options?: TruncatePlainDecimalSigfigsOptions,
): string {
  const preserveTrailingSigfigZeros = options?.preserveTrailingSigfigZeros === true;
  const sf = Math.max(1, Math.floor(sigfigs));
  const trimmed = decimalStr.trim();
  if (trimmed === "" || trimmed === "-") {
    return trimmed;
  }
  const neg = trimmed.startsWith("-");
  const body = neg ? trimmed.slice(1) : trimmed;
  const plainDec = /^(\d+)\.(\d+)$/.exec(body);
  if (!plainDec) {
    return formatPlainDecimalSigfigsString(decimalStr, sigfigs);
  }
  const intStr = plainDec[1];
  const fracStr = plainDec[2];
  const intLen = intStr.length;

  let firstNz = -1;
  for (let i = 0; i < intStr.length; i++) {
    if (intStr[i] !== "0") {
      firstNz = i;
      break;
    }
  }
  if (firstNz < 0) {
    for (let j = 0; j < fracStr.length; j++) {
      if (fracStr[j] !== "0") {
        firstNz = intLen + j;
        break;
      }
    }
  }
  if (firstNz < 0) {
    return "0";
  }

  const digitAt = (pos: number): string => {
    if (pos < intLen) {
      return intStr[pos] ?? "0";
    }
    return fracStr[pos - intLen] ?? "0";
  };

  let coefDigits = "";
  for (let k = 0; k < sf; k++) {
    coefDigits += digitAt(firstNz + k);
  }

  const exp = intLen - 1 - firstNz;
  let unsignedOut = unsignedDecimalFromTruncatedCoef(
    coefDigits,
    exp,
    sf,
    preserveTrailingSigfigZeros,
  );
  if (absPlainDecimalMagnitudeGeSciThreshold(unsignedOut)) {
    const c0 = coefDigits[0];
    const crest = coefDigits.slice(1);
    const sci = normalizeScientificString(`${c0}.${crest}e+${exp}`);
    unsignedOut = sci.replace(/e\+/i, "e");
  }
  return neg ? `-${unsignedOut}` : unsignedOut;
}

/** Coerce RPC / multicall values (sometimes serialized as decimal strings) for {@link formatUnits}. */
export function rawToBigIntForFormat(raw: bigint | string | number): bigint {
  if (typeof raw === "bigint") {
    return raw;
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return 0n;
    }
    return BigInt(raw);
  }
  const s = String(raw).trim();
  if (!s) {
    return 0n;
  }
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/**
 * `formatUnits(raw, decimals)` then {@link formatCompactDecimalString}.
 */
export function formatCompactFromRaw(
  raw: bigint | string | number,
  decimals: number,
  options?: FormatCompactOptions,
): string {
  return formatCompactDecimalString(formatUnits(rawToBigIntForFormat(raw), decimals), options);
}
