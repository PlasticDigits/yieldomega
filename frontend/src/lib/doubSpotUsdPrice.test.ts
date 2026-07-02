// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  doubWeiToUsdNotionalWad,
  parseDoubUsdWad,
  podiumPrizeUsdWeiForDisplay,
} from "@/lib/doubSpotUsdPrice";

const WAD = 10n ** 18n;

describe("doubSpotUsdPrice", () => {
  it("parses indexer doub_usd_wad", () => {
    expect(parseDoubUsdWad("980000000000000000")).toBe(980000000000000000n);
    expect(parseDoubUsdWad("0")).toBeUndefined();
    expect(parseDoubUsdWad(null)).toBeUndefined();
  });

  it("converts DOUB wei to USD-notional wad using spot doub_usd_wad", () => {
    const prize = 56200n * WAD;
    const doubUsd = 980000000000000000n;
    expect(doubWeiToUsdNotionalWad(prize, doubUsd)).toBe(55076000000000000000000n);
  });

  it("omits podium USD when no doub/USD rate is available", () => {
    const prize = 1600000000000000000n;
    expect(podiumPrizeUsdWeiForDisplay(prize, undefined)).toBeUndefined();
    expect(podiumPrizeUsdWeiForDisplay(prize, 980000000000000000n)).toBeGreaterThan(0n);
  });
});
