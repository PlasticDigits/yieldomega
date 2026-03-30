// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { podiumCategorySlices, podiumPlacementShares, RESERVE_FEE_ROUTING_BPS } from "./timeCurvePodiumMath";

describe("timeCurvePodiumMath", () => {
  it("fee bps sum to 10_000", () => {
    const s =
      RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity +
      RESERVE_FEE_ROUTING_BPS.cl8yBuyAndBurn +
      RESERVE_FEE_ROUTING_BPS.podiumPool +
      RESERVE_FEE_ROUTING_BPS.team +
      RESERVE_FEE_ROUTING_BPS.rabbitTreasury;
    expect(s).toBe(10_000);
  });

  it("472 split on slice=7 yields 4,2,1", () => {
    expect(podiumPlacementShares(7n)).toEqual([4n, 2n, 1n]);
  });

  it("category slices partition pool", () => {
    const [a, b, c, d] = podiumCategorySlices(100n);
    expect(a + b + c + d).toBe(100n);
    expect(a).toBe(50n);
    expect(b).toBe(20n);
    expect(c).toBe(10n);
    expect(d).toBe(20n);
  });
});
