// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  aggregateReferralLeaderboardGlobalTotalsFromItems,
  parseReferralLeaderboardGlobalTotals,
  referralLeaderboardPageHasGlobalTotals,
} from "@/lib/referralLeaderboardGlobals";
import type { ReferralReferrerLeaderboardPage } from "@/lib/indexerApi";

describe("referralLeaderboardGlobals", () => {
  it("detects schema ≥ 1.25.0 global summary fields", () => {
    const page: ReferralReferrerLeaderboardPage = {
      items: [],
      limit: 20,
      offset: 0,
      next_offset: null,
      total: 2,
      total_codes_registered: "2",
      total_referred_buys: "5",
      total_referrer_charm_wad: "9000",
    };
    expect(referralLeaderboardPageHasGlobalTotals(page)).toBe(true);
    expect(parseReferralLeaderboardGlobalTotals(page)).toEqual({
      totalCodesRegistered: 2n,
      totalBuys: 5n,
      totalCharmWad: 9000n,
      totalReferrers: 2,
    });
  });

  it("returns null for legacy pages missing global totals", () => {
    const page: ReferralReferrerLeaderboardPage = {
      items: [
        {
          rank: 1,
          referrer: "0x1",
          total_referrer_charm_wad: "100",
          referred_buy_count: "1",
          codes_registered_count: "1",
        },
      ],
      limit: 20,
      offset: 0,
      next_offset: null,
    };
    expect(referralLeaderboardPageHasGlobalTotals(page)).toBe(false);
    expect(parseReferralLeaderboardGlobalTotals(page)).toBeNull();
  });

  it("aggregates globals from all leaderboard rows", () => {
    const totals = aggregateReferralLeaderboardGlobalTotalsFromItems([
      {
        rank: 1,
        referrer: "0x1",
        total_referrer_charm_wad: "300",
        referred_buy_count: "2",
        codes_registered_count: "1",
      },
      {
        rank: 2,
        referrer: "0x2",
        total_referrer_charm_wad: "100",
        referred_buy_count: "1",
        codes_registered_count: "1",
      },
    ]);
    expect(totals).toEqual({
      totalCodesRegistered: 2n,
      totalBuys: 3n,
      totalCharmWad: 400n,
      totalReferrers: 2,
    });
  });
});
