// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { ArenaSessionSummary } from "@/lib/indexerApi";
import { hasWywaSummaryActivity } from "./whileYouWereAwayActivity";

const emptySummary = (): ArenaSessionSummary => ({
  since_ms: "1700000000000",
  elapsed_ms: "60000",
  total_buys: "0",
  unique_players: "0",
  podium_updates: "0",
  podium_epochs_ended: [],
  wallet_summary: null,
});

describe("hasWywaSummaryActivity (#338 sad paths)", () => {
  it("returns true when total_buys is positive", () => {
    expect(hasWywaSummaryActivity({ ...emptySummary(), total_buys: "3" })).toBe(true);
  });

  it("returns true when podium_updates is positive", () => {
    expect(hasWywaSummaryActivity({ ...emptySummary(), podium_updates: "1" })).toBe(true);
  });

  it("returns true when podium_epochs_ended is non-empty", () => {
    expect(
      hasWywaSummaryActivity({
        ...emptySummary(),
        podium_epochs_ended: [
          {
            podium: "last_buy",
            category: 0,
            epoch: "1",
            pool_paid_doub_wad: "0",
            winners: [],
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false for zero activity and empty epoch finals", () => {
    expect(hasWywaSummaryActivity(emptySummary())).toBe(false);
  });

  it("returns false for malformed numeric strings and empty epoch finals", () => {
    expect(
      hasWywaSummaryActivity({
        ...emptySummary(),
        total_buys: "not-a-number",
        podium_updates: "",
      }),
    ).toBe(false);
  });
});
