// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  doubWeiToUsdNotionalWad,
  parseDoubUsdWad,
  podiumPrizeUsdWeiForDisplay,
} from "@/lib/doubSpotUsdPrice";

const WAD = 10n ** 18n;

describe("doubSpotUsdPrice", () => {
  it("parses indexed doub_usd_wad", () => {
    expect(parseDoubUsdWad("1000000000000000000")).toBe(WAD);
    expect(parseDoubUsdWad("0")).toBeUndefined();
    expect(parseDoubUsdWad(undefined)).toBeUndefined();
  });

  it("converts DOUB wei to USD-notional wad at $1/DOUB", () => {
    const prize = 56200n * WAD;
    expect(doubWeiToUsdNotionalWad(prize, WAD)).toBe(56200n * WAD);
  });

  it("prefers indexed doub_usd_wad over static fallback for podium display", () => {
    const prize = 1600000000000000000n;
    expect(podiumPrizeUsdWeiForDisplay(prize, WAD)).toBe(1600000000000000000n);
    expect(podiumPrizeUsdWeiForDisplay(prize, undefined)).toBe((prize * 98n) / 100n);
  });
});
