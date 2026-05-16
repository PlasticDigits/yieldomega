// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { WARBOW_BP_MOVING_EVENT_NAMES } from "@/lib/abis";
import { overlayWarbowLeaderboardBp, overlayWarbowPodiumBpValues } from "./warbowPodiumLive";
import type { PodiumReadRow } from "./usePodiumReads";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const C = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function sampleRows(warbowValues: [string, string, string]): PodiumReadRow[] {
  return [
    { winners: [A, B, C], values: ["1", "2", "3"] },
    { winners: [A, B, C], values: warbowValues },
    { winners: [C, B, A], values: ["4", "3", "2"] },
    { winners: [A, C, B], values: ["300", "240", "60"] },
  ];
}

describe("overlayWarbowPodiumBpValues", () => {
  it("replaces WarBow BP digits when all three on-chain reads succeed", () => {
    const rows = sampleRows(["750", "500", "200"]);
    const next = overlayWarbowPodiumBpValues(rows, [
      { status: "success", result: 812n },
      { status: "success", result: 490n },
      { status: "success", result: 205n },
    ]);
    expect(next[1]?.values).toEqual(["812", "490", "205"]);
    expect(next[0]?.values).toEqual(["1", "2", "3"]);
    expect(next[2]?.values).toEqual(["4", "3", "2"]);
  });

  it("keeps indexer values when any on-chain read is missing or failed", () => {
    const rows = sampleRows(["750", "500", "200"]);
    expect(
      overlayWarbowPodiumBpValues(rows, [
        { status: "success", result: 812n },
        { status: "failure" },
        { status: "success", result: 205n },
      ]),
    ).toBe(rows);
    expect(overlayWarbowPodiumBpValues(rows, undefined)).toBe(rows);
  });
});

describe("overlayWarbowLeaderboardBp", () => {
  it("overlays leaderboard rows when every battlePoints read succeeds", () => {
    const items = [
      { buyer: A, battle_points_after: "750", block_number: "10", tx_hash: "0x1", log_index: 0 },
      { buyer: B, battle_points_after: "500", block_number: "11", tx_hash: "0x2", log_index: 0 },
    ];
    const next = overlayWarbowLeaderboardBp(items, [
      { status: "success", result: 900n },
      { status: "success", result: 480n },
    ]);
    expect(next?.[0]?.battle_points_after).toBe("900");
    expect(next?.[1]?.battle_points_after).toBe("480");
  });

  it("returns original items when overlay reads are incomplete", () => {
    const items = [{ buyer: A, battle_points_after: "750" }];
    expect(overlayWarbowLeaderboardBp(items, [{ status: "failure" }])).toBe(items);
  });
});

describe("WARBOW_BP_MOVING_EVENT_NAMES", () => {
  it("lists every WarBow event that mutates Battle Points (plus Buy watched separately)", () => {
    expect(WARBOW_BP_MOVING_EVENT_NAMES).toEqual([
      "WarBowSteal",
      "WarBowRevenge",
      "WarBowFlagClaimed",
      "WarBowFlagPenalized",
    ]);
  });
});

describe("warbow podium row shape", () => {
  it("preserves zero-address slots while overlaying BP", () => {
    const rows: PodiumReadRow[] = [
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
      { winners: [A, ZERO, ZERO], values: ["750", "0", "0"] },
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
    ];
    const next = overlayWarbowPodiumBpValues(rows, [
      { status: "success", result: 812n },
      { status: "success", result: 0n },
      { status: "success", result: 0n },
    ]);
    expect(next[1]?.values[0]).toBe("812");
    expect(next[1]?.winners[0]).toBe(A);
  });
});
