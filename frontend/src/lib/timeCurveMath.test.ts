// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { currentMinBuyAt, WAD } from "./timeCurveMath";

/** ln(1.2) in WAD — matches contracts/test/TimeMath.t.sol */
const GROWTH_RATE_20PCT = 182_321_556_793_954_592n;
const ONE_DAY = 86400n;

describe("currentMinBuyAt", () => {
  it("matches zero elapsed", () => {
    expect(currentMinBuyAt(WAD, GROWTH_RATE_20PCT, 0n)).toBe(WAD);
  });

  it("approximates 20% after one day (within 0.01% relative)", () => {
    const mb = currentMinBuyAt(WAD, GROWTH_RATE_20PCT, ONE_DAY);
    const target = 1.2 * Number(WAD);
    const rel = Math.abs(Number(mb) - target) / target;
    expect(rel).toBeLessThan(1e-4);
  });

  it("approximates two days multiplier 1.2^2", () => {
    const mb = currentMinBuyAt(WAD, GROWTH_RATE_20PCT, 2n * ONE_DAY);
    const target = 1.44 * Number(WAD);
    const rel = Math.abs(Number(mb) - target) / target;
    expect(rel).toBeLessThan(1e-4);
  });
});
