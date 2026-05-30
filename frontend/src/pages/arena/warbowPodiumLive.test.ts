// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { WARBOW_BP_MOVING_EVENT_NAMES } from "@/lib/abis";
import {
  mergeWarbowLeaderboardBpFromSortedReads,
  overlayWarbowLeaderboardBp,
  overlayWarbowPodiumBpValues,
} from "./warbowPodiumLive";
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
  it("returns rows unchanged (indexer-primary WarBow BP — GitLab #216)", () => {
    const rows = sampleRows(["750", "500", "200"]);
    expect(overlayWarbowPodiumBpValues(rows, undefined)).toBe(rows);
    expect(overlayWarbowPodiumBpValues(rows, [{ status: "success", result: 812n }])).toBe(rows);
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

describe("mergeWarbowLeaderboardBpFromSortedReads", () => {
  it("maps reads ordered by sorted buyer to indexer display order", () => {
    const items = [
      { buyer: B, battle_points_after: "500", block_number: "11", tx_hash: "0x2", log_index: 0 },
      { buyer: A, battle_points_after: "750", block_number: "10", tx_hash: "0x1", log_index: 0 },
    ];
    const out = mergeWarbowLeaderboardBpFromSortedReads(items, [
      { status: "success", result: 900n },
      { status: "success", result: 480n },
    ]);
    expect(out[0]?.buyer).toBe(B);
    expect(out[0]?.battle_points_after).toBe("480");
    expect(out[1]?.buyer).toBe(A);
    expect(out[1]?.battle_points_after).toBe("900");
  });

  it("keeps indexer rows when a read is missing or failed", () => {
    const items = [
      { buyer: B, battle_points_after: "500", block_number: "11", tx_hash: "0x2", log_index: 0 },
      { buyer: A, battle_points_after: "750", block_number: "10", tx_hash: "0x1", log_index: 0 },
    ];
    expect(
      mergeWarbowLeaderboardBpFromSortedReads(items, [
        { status: "success", result: 900n },
        { status: "failure" },
      ]),
    ).toBe(items);
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
  it("passes through indexer row including zero-address slots", () => {
    const rows: PodiumReadRow[] = [
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
      { winners: [A, ZERO, ZERO], values: ["750", "0", "0"] },
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
      { winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] },
    ];
    expect(overlayWarbowPodiumBpValues(rows, undefined)).toBe(rows);
    expect(rows[1]?.values[0]).toBe("750");
  });
});
