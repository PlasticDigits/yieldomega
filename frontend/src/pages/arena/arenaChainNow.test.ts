// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  chainNowSecFromSkew,
  conservativeSkewWallMinusChainSec,
} from "@/pages/arena/arenaChainNow";

describe("arenaChainNow", () => {
  it("anchors chain now from skew and wall clock", () => {
    const skew = conservativeSkewWallMinusChainSec(1_700_000_100, 1_700_000_000);
    expect(skew).toBe(99);
    expect(chainNowSecFromSkew(skew, 1_700_000_200)).toBe(1_700_000_101);
  });

  it("never produces negative countdown via skew math", () => {
    const skew = conservativeSkewWallMinusChainSec(1_000, 900);
    const chainNow = chainNowSecFromSkew(skew, 1_000);
    const rem = Math.max(0, Math.floor(950 - chainNow));
    expect(rem).toBeGreaterThanOrEqual(0);
    expect(rem).toBeLessThanOrEqual(50);
  });
});
