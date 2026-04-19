// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { podiumCategorySlices, podiumPlacementShares, RESERVE_FEE_ROUTING_BPS } from "./timeCurvePodiumMath";

describe("timeCurvePodiumMath", () => {
  it("fee bps sum to 10_000", () => {
    const s =
      RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity +
      RESERVE_FEE_ROUTING_BPS.cl8yBurned +
      RESERVE_FEE_ROUTING_BPS.podiumPool +
      RESERVE_FEE_ROUTING_BPS.team +
      RESERVE_FEE_ROUTING_BPS.rabbitTreasury;
    expect(s).toBe(10_000);
  });

  it("472 split on slice=7 yields 4,2,1", () => {
    expect(podiumPlacementShares(7n)).toEqual([4n, 2n, 1n]);
  });

  it("category slices partition pool (Last, WarBow, Defended, Time order)", () => {
    const [last, war, def, time] = podiumCategorySlices(100n);
    expect(last + war + def + time).toBe(100n);
    expect(last).toBe(40n);
    expect(war).toBe(25n);
    expect(def).toBe(20n);
    expect(time).toBe(15n);
  });
});
