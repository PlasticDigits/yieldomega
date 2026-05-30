// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_DOUB_ROUTING_BPS,
  podiumPlacementShares,
} from "./timeArenaPodiumMath";

describe("timeArenaPodiumMath", () => {
  it("ARENA_DOUB_ROUTING_BPS sums to 100%", () => {
    const sum =
      ARENA_DOUB_ROUTING_BPS.activePodium +
      ARENA_DOUB_ROUTING_BPS.seedPodium +
      ARENA_DOUB_ROUTING_BPS.adminVault;
    expect(sum).toBe(10_000);
  });

  it("podiumPlacementShares splits 4:2:1 within a slice", () => {
    expect(podiumPlacementShares(0n)).toEqual([0n, 0n, 0n]);
    expect(podiumPlacementShares(7n)).toEqual([4n, 2n, 1n]);
    expect(podiumPlacementShares(100n)).toEqual([57n, 28n, 15n]);
  });
});
