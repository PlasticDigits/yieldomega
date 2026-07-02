// SPDX-License-Identifier: AGPL-3.0-only

import { parseUnits } from "viem";
import { describe, expect, it } from "vitest";
import {
  ARENA_PAY_SPEND_INPUT_ETH_SLIDER_FRACTION_DIGITS,
  ARENA_PAY_SPEND_INPUT_SLIDER_FRACTION_DIGITS,
  arenaPaySpendInputCompactFractionDigits,
  formatArenaPaySpendInputDisplay,
  truncateDecimalStringToFractionPlaces,
} from "@/lib/timeArenaPaySpendInputFormat";

const sampleDoubWei = parseUnits("30058.76590539423027", 18);

describe("truncateDecimalStringToFractionPlaces", () => {
  it("truncates toward zero without rounding up", () => {
    expect(truncateDecimalStringToFractionPlaces("30058.76590539423027", 2)).toBe("30058.76");
    expect(truncateDecimalStringToFractionPlaces("1000.199", 2)).toBe("1000.19");
    expect(truncateDecimalStringToFractionPlaces("0.123456", 2)).toBe("0.12");
  });

  it("keeps shorter fractional tails and whole numbers unchanged", () => {
    expect(truncateDecimalStringToFractionPlaces("1000.1", 2)).toBe("1000.1");
    expect(truncateDecimalStringToFractionPlaces("1000", 2)).toBe("1000");
  });
});

describe("formatArenaPaySpendInputDisplay", () => {
  it("compacts non-ETH pay assets to two decimals for slider/default display", () => {
    expect(
      formatArenaPaySpendInputDisplay(sampleDoubWei, 18, "cl8y", {
        compactFractionDigits: ARENA_PAY_SPEND_INPUT_SLIDER_FRACTION_DIGITS,
      }),
    ).toBe("30058.76");
    expect(
      formatArenaPaySpendInputDisplay(sampleDoubWei, 18, "usdm", {
        compactFractionDigits: 2,
      }),
    ).toBe("30058.76");
    expect(
      formatArenaPaySpendInputDisplay(100n * 10n ** 18n, 18, "cred", {
        compactFractionDigits: 2,
      }),
    ).toBe("100");
  });

  it("truncates ETH to ten decimals for slider/default display", () => {
    const wei = 594302566429745n;
    expect(
      formatArenaPaySpendInputDisplay(wei, 18, "eth", {
        compactFractionDigits: ARENA_PAY_SPEND_INPUT_ETH_SLIDER_FRACTION_DIGITS,
      }),
    ).toBe("0.0005943025");
    expect(arenaPaySpendInputCompactFractionDigits("eth")).toBe(10);
    expect(arenaPaySpendInputCompactFractionDigits("usdm")).toBe(2);
  });

  it("preserves full precision for ETH when compact is omitted", () => {
    const wei = 123456789012345678n;
    expect(formatArenaPaySpendInputDisplay(wei, 18, "eth")).toBe("0.123456789012345678");
  });

  it("returns full formatUnits output when compact is omitted", () => {
    expect(formatArenaPaySpendInputDisplay(sampleDoubWei, 18, "cl8y")).toBe(
      "30058.76590539423027",
    );
  });
});
