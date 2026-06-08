// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ArenaTimerChips", () => {
  it("renders three secondary podium chips (not Last Buy — hero owns primary countdown)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaTimerChips.tsx"), "utf8");
    expect(src).toContain("Time Booster");
    expect(src).toContain("Defended Streak");
    expect(src).toContain("WarBow");
    expect(src).not.toMatch(/LABELS.*Last Buy/);
    expect(src).toContain("contractIndex: 1");
    expect(src).toContain("contractIndex: 2");
    expect(src).toContain("contractIndex: 3");
  });

  it("does not fall back to wagmi podiumDeadline reads (indexer-first #301)", () => {
    const src = readFileSync(resolve(__dirname, "ArenaTimerChips.tsx"), "utf8");
    expect(src).not.toContain("useReadContracts");
    expect(src).toContain("useArenaTimersQuery");
  });
});
