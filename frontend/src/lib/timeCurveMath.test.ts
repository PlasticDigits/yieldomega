// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { currentMinBuyAt, WAD } from "./timeCurveMath";

/** ln(1.25) in WAD — matches contracts/test/TimeMath.t.sol */
const GROWTH_RATE_25PCT = 223_143_551_314_209_700n;
const ONE_DAY = 86400n;

describe("currentMinBuyAt", () => {
  it("matches zero elapsed", () => {
    expect(currentMinBuyAt(WAD, GROWTH_RATE_25PCT, 0n)).toBe(WAD);
  });

  it("approximates 25% after one day (within 0.01% relative)", () => {
    const mb = currentMinBuyAt(WAD, GROWTH_RATE_25PCT, ONE_DAY);
    const target = 1.25 * Number(WAD);
    const rel = Math.abs(Number(mb) - target) / target;
    expect(rel).toBeLessThan(1e-4);
  });

  it("approximates two days multiplier 1.25^2", () => {
    const mb = currentMinBuyAt(WAD, GROWTH_RATE_25PCT, 2n * ONE_DAY);
    const target = 1.5625 * Number(WAD);
    const rel = Math.abs(Number(mb) - target) / target;
    expect(rel).toBeLessThan(1e-4);
  });
});
