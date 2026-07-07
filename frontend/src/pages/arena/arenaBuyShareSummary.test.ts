// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import {
  buildArenaBuyShareSummary,
  formatShareTimerSeconds,
} from "@/pages/arena/arenaBuyShareSummary";

const indexedBuy: BuyItem = {
  block_number: "100",
  tx_hash: "0xabc1234567890123456789012345678901234567890123456789012345678901234",
  log_index: 1,
  block_timestamp: "1700000000",
  buyer: "0xdddddddddddddddddddddddddddddddddddddddd",
  amount: "5500",
  charm_wad: "5515000000000000000",
  price_per_charm_wad: "0",
  new_deadline: "1700001120",
  total_raised_after: "0",
  buy_index: "42",
  actual_seconds_added: "120",
  bp_base_buy: "250",
  bp_timer_reset_bonus: "500",
};

describe("formatShareTimerSeconds (#365)", () => {
  it("formats sub-minute and minute+second timers", () => {
    expect(formatShareTimerSeconds(45)).toBe("+45s");
    expect(formatShareTimerSeconds(120)).toBe("+2m");
    expect(formatShareTimerSeconds(134)).toBe("+2m 14s");
  });
});

describe("buildArenaBuyShareSummary (#365)", () => {
  it("collapses preview effect lines into grouped rows with headline", () => {
    const summary = buildArenaBuyShareSummary({
      previewLines: ["+12xp", "+120s", "+250 BP Base", "Last Buyer"],
    });
    expect(summary).not.toBeNull();
    expect(summary!.rows.length).toBeLessThanOrEqual(7);
    expect(summary!.headline).toContain("+2m");
    expect(summary!.headline).toContain("Last Buyer");
    expect(summary!.pending).toBe(true);
    expect(summary!.shareText).toContain("Yield Omega");
  });

  it("upgrades to indexer-confirmed values when indexed buy is supplied", () => {
    const preview = ["+3xp", "+999s", "Last Buyer"];
    const summary = buildArenaBuyShareSummary({
      previewLines: preview,
      indexedBuy,
      playerLevel: 5,
    });
    expect(summary!.pending).toBe(false);
    expect(summary!.txHash).toBe(indexedBuy.tx_hash);
    expect(summary!.headline).toContain("+2m");
    expect(summary!.headline).not.toContain("+999s");
    expect(summary!.rows.some((row) => row.tone === "warbow")).toBe(true);
  });

  it("omits empty sections and caps row count", () => {
    const summary = buildArenaBuyShareSummary({
      previewLines: ["Last Buyer"],
    });
    expect(summary!.rows).toHaveLength(1);
    expect(summary!.rows[0]?.tone).toBe("rank");
  });

  it("returns null when no effect lines exist", () => {
    expect(buildArenaBuyShareSummary({ previewLines: [] })).toBeNull();
  });
});
