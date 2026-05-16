// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatCompactDecimalString,
  formatCompactFromRaw,
  formatPlainDecimalSigfigsString,
  normalizeScientificString,
  truncatePlainDecimalSigfigsString,
} from "./compactNumberFormat";

describe("normalizeScientificString", () => {
  it("uses lowercase e and e+ for non-negative exponent", () => {
    expect(normalizeScientificString("1.23E+15")).toBe("1.23e+15");
    expect(normalizeScientificString("1.23e+15")).toBe("1.23e+15");
  });
  it("preserves negative exponent without plus", () => {
    expect(normalizeScientificString("4.00e-5")).toBe("4.00e-5");
  });
});

describe("formatPlainDecimalSigfigsString", () => {
  it("formats six significant figures without k/m compaction", () => {
    expect(formatPlainDecimalSigfigsString("1.011420123456789012", 6)).toBe("1.01142");
    expect(formatPlainDecimalSigfigsString("999.123456", 6)).toBe("999.123");
  });
  it("handles zero and negatives", () => {
    expect(formatPlainDecimalSigfigsString("0", 6)).toBe("0");
    expect(formatPlainDecimalSigfigsString("-1.2345678", 4)).toBe("-1.235");
  });
});

describe("truncatePlainDecimalSigfigsString", () => {
  it("truncates toward zero instead of rounding up", () => {
    expect(truncatePlainDecimalSigfigsString("10.2699", 4)).toBe("10.26");
    expect(truncatePlainDecimalSigfigsString("-10.2699", 4)).toBe("-10.26");
  });
  it("truncates hero-style rates instead of rounding (six figures)", () => {
    expect(truncatePlainDecimalSigfigsString("1.011425", 6)).toBe("1.01142");
    expect(truncatePlainDecimalSigfigsString("1.011425", 6, { preserveTrailingSigfigZeros: true })).toBe(
      "1.01142",
    );
  });
  it("pads trailing zeros to sigfig width when preserveTrailingSigfigZeros is true", () => {
    expect(truncatePlainDecimalSigfigsString("1.01", 6, { preserveTrailingSigfigZeros: true })).toBe(
      "1.01000",
    );
  });
  it("uses scientific form at and above 1e15", () => {
    expect(truncatePlainDecimalSigfigsString("1000000000000000.0", 4)).toBe("1.000e15");
  });
});

describe("formatCompactDecimalString", () => {
  it("formats sub-thousand with sigfigs", () => {
    expect(formatCompactDecimalString("1.953145177291660455")).toBe("1.95");
    expect(formatCompactDecimalString("999")).toBe("999");
    expect(formatCompactDecimalString("12.34", { sigfigs: 2 })).toBe("12");
  });
  it("uses k, m, b, t suffixes", () => {
    expect(formatCompactDecimalString("1500")).toBe("1.5k");
    expect(formatCompactDecimalString("2500000")).toBe("2.5m");
    expect(formatCompactDecimalString("3000000000")).toBe("3b");
    expect(formatCompactDecimalString("4000000000000")).toBe("4t");
  });
  it("uses scientific notation at and above 1e15", () => {
    expect(formatCompactDecimalString("1000000000000000")).toMatch(/^1\.00e\+15$/);
    expect(formatCompactDecimalString("1.23e+20")).toMatch(/e\+/);
  });
  it("handles negative values", () => {
    expect(formatCompactDecimalString("-2500000")).toBe("-2.5m");
  });
  it("handles zero", () => {
    expect(formatCompactDecimalString("0")).toBe("0");
    expect(formatCompactDecimalString("0.0")).toBe("0");
  });
  it("falls back for non-finite Number (huge integer string)", () => {
    const huge = "1" + "0".repeat(400);
    expect(formatCompactDecimalString(huge)).toMatch(/^1\.00e\+/);
  });
});

describe("formatCompactFromRaw", () => {
  it("applies decimals like formatUnits then compact", () => {
    expect(formatCompactFromRaw(10n ** 19n, 18)).toBe("10");
    expect(formatCompactFromRaw(1953145177291660455n, 18)).toBe("1.95");
  });
  it("coerces decimal string inputs (multicall / JSON bigint encoding)", () => {
    expect(formatCompactFromRaw("1953145177291660455", 18)).toBe("1.95");
  });
});
