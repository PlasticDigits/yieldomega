// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  abbreviateDecimalString,
  formatAmountTriple,
  formatUnixSecIsoUtc,
  parseBigIntString,
} from "./formatAmount";

describe("parseBigIntString", () => {
  it("parses decimal strings", () => {
    expect(parseBigIntString("0")).toBe(0n);
    expect(parseBigIntString("1953145177291660455")).toBe(1953145177291660455n);
  });
  it("returns 0 on bad input", () => {
    expect(parseBigIntString("")).toBe(0n);
    expect(parseBigIntString("abc")).toBe(0n);
  });
});

describe("abbreviateDecimalString", () => {
  it("leaves small integers without suffix", () => {
    expect(abbreviateDecimalString("1.953145177291660455")).toBe("1.953145177291660455");
    expect(abbreviateDecimalString("999")).toBe("999");
  });
  it("uses k for thousands", () => {
    expect(abbreviateDecimalString("1000")).toBe("1k");
    expect(abbreviateDecimalString("1234.56")).toBe("1.23456k");
  });
  it("uses m, b, t", () => {
    expect(abbreviateDecimalString("1000000")).toBe("1m");
    expect(abbreviateDecimalString("2500000")).toBe("2.5m");
    expect(abbreviateDecimalString("3000000000")).toBe("3b");
  });
});

describe("formatUnixSecIsoUtc", () => {
  it("formats valid unix seconds as UTC ISO", () => {
    expect(formatUnixSecIsoUtc(1700000000n)).toBe("2023-11-14T22:13:20.000Z");
  });
  it("returns em dash out of range", () => {
    expect(formatUnixSecIsoUtc(-1n)).toBe("—");
    expect(formatUnixSecIsoUtc(10n ** 16n)).toBe("—");
  });
});

describe("formatAmountTriple", () => {
  it("formats wei with 18 decimals", () => {
    const t = formatAmountTriple(1953145177291660455n, 18);
    expect(t.raw).toBe("1953145177291660455");
    expect(t.decimal).toBe("1.953145177291660455");
    expect(t.abbrev).toBe("1.95");
  });
  it("formats integer-like values with decimals 0", () => {
    const t = formatAmountTriple(1774436529n, 0);
    expect(t.decimal).toBe("1774436529");
    expect(t.abbrev).toBe("1.77b");
  });
});
