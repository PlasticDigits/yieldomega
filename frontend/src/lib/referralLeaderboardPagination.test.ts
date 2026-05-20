// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  REFERRAL_LEADERBOARD_PAGE_SIZE,
  referralLeaderboardOffsetForPage,
  referralLeaderboardPageIndex,
  referralLeaderboardTotalPages,
  referralLeaderboardVisiblePages,
} from "@/lib/referralLeaderboardPagination";

describe("referralLeaderboardPagination", () => {
  it("maps offset/limit to 1-based page index", () => {
    expect(referralLeaderboardPageIndex(0, REFERRAL_LEADERBOARD_PAGE_SIZE)).toBe(1);
    expect(referralLeaderboardPageIndex(20, REFERRAL_LEADERBOARD_PAGE_SIZE)).toBe(2);
  });

  it("maps page index back to offset", () => {
    expect(referralLeaderboardOffsetForPage(3, 20)).toBe(40);
    expect(referralLeaderboardOffsetForPage(1, 20)).toBe(0);
  });

  it("computes total pages from referrer count", () => {
    expect(referralLeaderboardTotalPages(0, 20)).toBe(0);
    expect(referralLeaderboardTotalPages(1, 20)).toBe(1);
    expect(referralLeaderboardTotalPages(20, 20)).toBe(1);
    expect(referralLeaderboardTotalPages(21, 20)).toBe(2);
  });

  it("builds a windowed page list with ellipsis gaps", () => {
    expect(referralLeaderboardVisiblePages(1, 1)).toEqual([1]);
    expect(referralLeaderboardVisiblePages(5, 10)).toEqual([1, null, 3, 4, 5, 6, 7, null, 10]);
  });
});
