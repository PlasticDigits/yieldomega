// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { blockiePaletteForSeed, normalizedBlockieSeed } from "./walletBlockieCanvas";

describe("normalizedBlockieSeed", () => {
  it("lowercases checksummed addresses", () => {
    expect(normalizedBlockieSeed("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01")).toBe(
      "0xabcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it("adds 0x prefix to bare hex", () => {
    expect(normalizedBlockieSeed("abcdef0123456789abcdef0123456789abcdef01")).toBe(
      "0xabcdef0123456789abcdef0123456789abcdef01",
    );
  });
});

describe("blockiePaletteForSeed", () => {
  it("returns the same palette for the same seed", () => {
    const seed = "0x1111111111111111111111111111111111111111";
    expect(blockiePaletteForSeed(seed)).toEqual(blockiePaletteForSeed(seed));
  });

  it("matches palette regardless of address casing", () => {
    const seed = "0x2222222222222222222222222222222222222222";
    expect(blockiePaletteForSeed(normalizedBlockieSeed(seed))).toEqual(
      blockiePaletteForSeed(normalizedBlockieSeed(seed.toUpperCase())),
    );
  });

  it("uses distinct foreground, background, and spot colors", () => {
    const seed = "0x3333333333333333333333333333333333333333";
    const { color, bgcolor, spotcolor } = blockiePaletteForSeed(seed);
    expect(color).toMatch(/^hsl\(/);
    expect(bgcolor).toMatch(/^hsl\(/);
    expect(spotcolor).toMatch(/^hsl\(/);
    expect(new Set([color, bgcolor, spotcolor]).size).toBeGreaterThanOrEqual(2);
  });
});
