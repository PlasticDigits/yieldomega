// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { isWarbowStealVictimBpInBand, WARBOW_STEAL_VICTIM_MAX_MULT, WARBOW_STEAL_VICTIM_MIN_MULT } from "./warbowStealBpBand";

describe("warbowStealBpBand", () => {
  it("exports bracket multiples matching TimeArena literals", () => {
    expect(WARBOW_STEAL_VICTIM_MIN_MULT).toBe(1n);
    expect(WARBOW_STEAL_VICTIM_MAX_MULT).toBe(50n);
  });

  it("matches inclusive 1×–50× uint256 semantics", () => {
    expect(isWarbowStealVictimBpInBand(250n, 250n)).toBe(true);
    expect(isWarbowStealVictimBpInBand(250n, 12_500n)).toBe(true);
    expect(isWarbowStealVictimBpInBand(250n, 249n)).toBe(false);
    expect(isWarbowStealVictimBpInBand(250n, 12_501n)).toBe(false);
    expect(isWarbowStealVictimBpInBand(0n, 500n)).toBe(false);
  });
});
