// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  WARBOW_BPS_DENOMINATOR,
  WARBOW_STEAL_DRAIN_BPS,
  warbowRevengeDrainBp,
} from "./warbowRevengeRowPreview";

describe("warbowRevengeDrainBp", () => {
  it("exposes the onchain constants verbatim (GitLab #236)", () => {
    expect(WARBOW_STEAL_DRAIN_BPS).toBe(1000n);
    expect(WARBOW_BPS_DENOMINATOR).toBe(10000n);
  });

  it("returns 0 for non-positive stealer BP", () => {
    expect(warbowRevengeDrainBp(0n)).toBe(0n);
    expect(warbowRevengeDrainBp(-1n)).toBe(0n);
    expect(warbowRevengeDrainBp(-100n)).toBe(0n);
  });

  it("returns 0 below the floor threshold (stealerBp < 10)", () => {
    // stealerBp * 1000 / 10000 floors to 0 for 1..9.
    expect(warbowRevengeDrainBp(1n)).toBe(0n);
    expect(warbowRevengeDrainBp(5n)).toBe(0n);
    expect(warbowRevengeDrainBp(9n)).toBe(0n);
  });

  it("returns 1 BP starting at stealerBp = 10 (the smallest non-zero drain)", () => {
    expect(warbowRevengeDrainBp(10n)).toBe(1n);
    expect(warbowRevengeDrainBp(19n)).toBe(1n);
  });

  it("rounds floor for arbitrary inputs (matches solidity integer division)", () => {
    expect(warbowRevengeDrainBp(100n)).toBe(10n);
    expect(warbowRevengeDrainBp(999n)).toBe(99n);
    expect(warbowRevengeDrainBp(1_000n)).toBe(100n);
    expect(warbowRevengeDrainBp(12_345n)).toBe(1_234n);
  });

  it("handles large BP values without precision loss (BigInt)", () => {
    // Real WarBow leaderboard rows commonly sit at 10k-60k BP.
    expect(warbowRevengeDrainBp(12_400n)).toBe(1_240n);
    expect(warbowRevengeDrainBp(54_321n)).toBe(5_432n);

    // Stress test at 1B+ BP (extreme but proves no overflow risk via BigInt path).
    expect(warbowRevengeDrainBp(1_000_000_000n)).toBe(100_000_000n);
  });

  it("is consistent with the literal onchain formula (regression guard)", () => {
    // Independent re-derivation: drain === stealerBp / 10 because 1000 / 10000 === 1/10.
    for (const sbp of [10n, 13n, 250n, 999n, 1_000n, 7_777n, 100_000n]) {
      const expected = sbp / 10n;
      expect(warbowRevengeDrainBp(sbp)).toBe(expected);
    }
  });
});
