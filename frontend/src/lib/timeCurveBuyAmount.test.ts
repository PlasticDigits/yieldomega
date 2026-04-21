// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { finalizeCharmSpendForBuy } from "@/lib/timeCurveBuyAmount";
import { WAD } from "@/lib/timeCurveMath";

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
