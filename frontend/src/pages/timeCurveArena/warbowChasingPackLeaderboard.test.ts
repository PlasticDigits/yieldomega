// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { warbowLeaderboardForChasingPackDisplay } from "./warbowChasingPackLeaderboard";

describe("warbowLeaderboardForChasingPackDisplay (GitLab #189)", () => {
  it("returns every indexer row so Chasing pack can show 7+ wallets", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ id: i }));
    expect(warbowLeaderboardForChasingPackDisplay(rows)).toHaveLength(9);
  });

  it("treats null/undefined as empty", () => {
    expect(warbowLeaderboardForChasingPackDisplay(null)).toEqual([]);
    expect(warbowLeaderboardForChasingPackDisplay(undefined)).toEqual([]);
  });
});
