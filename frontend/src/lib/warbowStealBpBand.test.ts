// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { isWarbowStealVictimBpInBand, WARBOW_STEAL_VICTIM_MAX_MULT, WARBOW_STEAL_VICTIM_MIN_MULT } from "./warbowStealBpBand";

describe("warbowStealBpBand", () => {
  it("exports bracket multiples matching TimeCurve literals", () => {
    expect(WARBOW_STEAL_VICTIM_MIN_MULT).toBe(2n);
    expect(WARBOW_STEAL_VICTIM_MAX_MULT).toBe(10n);
  });

  it("matches inclusive 2×–10× uint256 semantics", () => {
    expect(isWarbowStealVictimBpInBand(250n, 500n)).toBe(true);
    expect(isWarbowStealVictimBpInBand(250n, 2500n)).toBe(true);
    expect(isWarbowStealVictimBpInBand(250n, 499n)).toBe(false);
    expect(isWarbowStealVictimBpInBand(250n, 2501n)).toBe(false);
    expect(isWarbowStealVictimBpInBand(0n, 500n)).toBe(false);
  });
});
