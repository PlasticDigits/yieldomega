// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import type { BuyItem } from "@/lib/indexerApi";
import {
  ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE,
  arenaBuyEffectToastId,
  buildArenaBuyEffectToastEntries,
  findViewerBuyAtHead,
  mergeArenaBuyEffectToasts,
  replaceArenaBuyEffectToastBatch,
  resolveArenaBuyEffectToastLines,
} from "./arenaBuyEffectToastLines";
import { formatBuyProjectedXpLine } from "./arenaBuyProjectedEffects";

const VIEWER = "0xdddddddddddddddddddddddddddddddddddddddd";

const indexedBuy: BuyItem = {
  block_number: "100",
  tx_hash: "0xabc",
  log_index: 1,
  block_timestamp: "1700000000",
  buyer: VIEWER,
  amount: "5500",
  charm_wad: "5515000000000000000",
  price_per_charm_wad: "0",
  new_deadline: "1700001000",
  total_raised_after: "0",
  buy_index: "42",
  actual_seconds_added: "120",
};

describe("arenaBuyEffectToastLines", () => {
  it("prefers indexed buy rows over preview snapshots", () => {
    const preview = ["+1xp", "+999s", "Last Buyer"];
    const lines = resolveArenaBuyEffectToastLines({
      previewLines: preview,
      indexedBuy,
      playerLevel: 5,
    });
    expect(lines[0]).toBe(formatBuyProjectedXpLine(5515000000000000000n));
    expect(lines).toContain("+120s");
    expect(lines).not.toContain("+999s");
  });

  it("falls back to preview lines when no indexed buy is available", () => {
    const preview = ["+3xp", "+45s", "Last Buyer"];
    expect(
      resolveArenaBuyEffectToastLines({
        previewLines: preview,
      }),
    ).toEqual(preview);
  });

  it("finds the viewer buy at indexer head", () => {
    expect(findViewerBuyAtHead([indexedBuy], VIEWER)).toEqual(indexedBuy);
    expect(findViewerBuyAtHead([indexedBuy], "0x1111111111111111111111111111111111111111")).toBeUndefined();
  });

  it("caps visible toast queue length", () => {
    const batch = buildArenaBuyEffectToastEntries(["+1xp", "+2xp", "+3xp"], "batch");
    const merged = mergeArenaBuyEffectToasts(
      [{ id: "a", line: "old" }],
      batch,
      ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE,
    );
    expect(merged).toHaveLength(ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE);
    expect(merged[merged.length - 1]?.line).toBe("+3xp");
  });

  it("builds stable toast ids from indexed buy rows", () => {
    expect(arenaBuyEffectToastId(indexedBuy)).toBe("0xabc-1");
  });

  it("replaces a preview batch when indexer confirms buy effects", () => {
    const batchId = "batch-1";
    const preview = buildArenaBuyEffectToastEntries(["+3xp", "+999s"], batchId);
    const actual = replaceArenaBuyEffectToastBatch(preview, batchId, ["+5xp", "+120s"]);
    expect(actual).toHaveLength(2);
    expect(actual.map((toast) => toast.line)).toEqual(["+5xp", "+120s"]);
    expect(actual.every((toast) => toast.id.startsWith(`${batchId}-`))).toBe(true);
  });
});
