// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import type { WarbowLeaderboardItem } from "@/lib/indexerApi";
import {
  parseWarbowLeaderboardTop,
  warbowFinalizeSlotsFromLeaderboard,
} from "@/lib/warbowLeaderboardFinalizeAutofill";

function row(buyer: string, bp: string): WarbowLeaderboardItem {
  return {
    buyer,
    battle_points_after: bp,
    block_number: "1",
    tx_hash: "0xabc",
    log_index: 0,
  };
}

describe("parseWarbowLeaderboardTop", () => {
  it("keeps order and caps display count", () => {
    const items = [
      row("0x1111111111111111111111111111111111111111", "900"),
      row("0x2222222222222222222222222222222222222222", "800"),
      row("0x3333333333333333333333333333333333333333", "700"),
      row("0x4444444444444444444444444444444444444444", "600"),
      row("0x5555555555555555555555555555555555555555", "500"),
      row("0x6666666666666666666666666666666666666666", "400"),
    ];
    const top = parseWarbowLeaderboardTop(items, 5);
    expect(top).toHaveLength(5);
    expect(top[0]?.battlePoints).toBe(900n);
    expect(top[4]?.battlePoints).toBe(500n);
  });

  it("skips malformed buyers", () => {
    const top = parseWarbowLeaderboardTop([
      row("not-an-address", "100"),
      row("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "50"),
    ]);
    expect(top).toHaveLength(1);
    expect(top[0]?.rank).toBe(1);
  });
});

describe("warbowFinalizeSlotsFromLeaderboard", () => {
  it("fills first three ranks and leaves trailing slots empty", () => {
    const a1 = "0x1111111111111111111111111111111111111111";
    const a2 = "0x2222222222222222222222222222222222222222";
    const ranked = parseWarbowLeaderboardTop([
      row(a1, "3"),
      row(a2, "2"),
    ]);
    expect(warbowFinalizeSlotsFromLeaderboard(ranked)).toEqual([
      getAddress(a1),
      getAddress(a2),
      "",
    ]);
  });
});
