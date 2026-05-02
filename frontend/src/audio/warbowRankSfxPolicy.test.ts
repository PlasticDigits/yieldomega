// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  shouldPlayWarbowRankStinger,
  WARBOW_RANK_SFX_UNSET,
  type WarbowRankSfxPrior,
} from "./warbowRankSfxPolicy";

describe("warbowRankSfxPolicy", () => {
  it("never fires on unset → first sample", () => {
    expect(shouldPlayWarbowRankStinger(WARBOW_RANK_SFX_UNSET, null)).toBe(false);
    expect(shouldPlayWarbowRankStinger(WARBOW_RANK_SFX_UNSET, 12)).toBe(false);
  });

  it("fires when numeric rank improves (lower index)", () => {
    expect(shouldPlayWarbowRankStinger(5, 3)).toBe(true);
    expect(shouldPlayWarbowRankStinger(3, 3)).toBe(false);
    expect(shouldPlayWarbowRankStinger(3, 4)).toBe(false);
  });

  it("silent for non‑podium rank drift (10 → 4)", () => {
    expect(shouldPlayWarbowRankStinger(10, 4)).toBe(false);
    expect(shouldPlayWarbowRankStinger(14, 5)).toBe(false);
  });

  it("fires on first observable top‑3 placement from unranked or deep", () => {
    expect(shouldPlayWarbowRankStinger(null, 3)).toBe(true);
    expect(shouldPlayWarbowRankStinger(null, 2)).toBe(true);
    expect(shouldPlayWarbowRankStinger(10, 2)).toBe(true);
    expect(shouldPlayWarbowRankStinger(2, 1)).toBe(true); // improves + still podium
    expect(shouldPlayWarbowRankStinger(null, 8)).toBe(false);
  });

  it("drops from board do not imply stinger when cur is null", () => {
    const prev = 5 as Extract<WarbowRankSfxPrior, number>;
    expect(shouldPlayWarbowRankStinger(prev, null)).toBe(false);
  });
});
