// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { finalizeCharmSpendForBuy, reconcileSpendWeiToCl8yBounds } from "@/lib/timeCurveBuyAmount";
import { WAD } from "@/lib/timeCurveMath";

describe("reconcileSpendWeiToCl8yBounds", () => {
  it("keeps permille when max shrinks (e.g. CL8Y balance after a buy)", () => {
    const prevBounds = { minS: 10n * WAD, maxS: 110n * WAD };
    const nextBounds = { minS: 10n * WAD, maxS: 60n * WAD };
    const prevSpend = 80n * WAD;
    const out = reconcileSpendWeiToCl8yBounds({
      prevSpendWei: prevSpend,
      nextBounds,
      prevBounds,
    });
    expect(out).toBe(45n * WAD);
  });

  it("initial zero spend stays midpoint", () => {
    const next = { minS: 0n, maxS: 100n };
    expect(
      reconcileSpendWeiToCl8yBounds({ prevSpendWei: 0n, nextBounds: next, prevBounds: null }),
    ).toBe(50n);
  });
});

describe("finalizeCharmSpendForBuy", () => {
  it("floors charm from spend then clamps to min band", () => {
    const price = WAD;
    const { charmWad, spendWei } = finalizeCharmSpendForBuy(5n * WAD - 1n, price, 5n * WAD, 10n * WAD);
    expect(charmWad).toBe(5n * WAD);
    expect(spendWei).toBe(5n * WAD);
  });

  it("clamps high spend to max charm", () => {
    const price = WAD;
    const { charmWad, spendWei } = finalizeCharmSpendForBuy(100n * WAD, price, 1n * WAD, 10n * WAD);
    expect(charmWad).toBe(10n * WAD);
    expect(spendWei).toBe(10n * WAD);
  });
});
