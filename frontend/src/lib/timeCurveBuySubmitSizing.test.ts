// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  CHARM_SUBMIT_UPPER_SLACK_BPS,
  effectiveMaxCharmWadForSubmit,
  reconcileFreshBuySizingFromReads,
} from "@/lib/timeCurveBuySubmitSizing";
import { WAD } from "@/lib/timeCurveMath";

describe("effectiveMaxCharmWadForSubmit", () => {
  it("floors to 99.5% of onchain max", () => {
    const max = 1000n * WAD;
    const eff = effectiveMaxCharmWadForSubmit(max);
    expect(eff).toBe((max * (10000n - CHARM_SUBMIT_UPPER_SLACK_BPS)) / 10000n);
    expect(eff < max).toBe(true);
  });
});

describe("reconcileFreshBuySizingFromReads", () => {
  it("clamps implied charm down to slack max when spend targets old envelope", () => {
    const price = WAD;
    const minS = 1n * WAD;
    const maxS = 100n * WAD;
    const minC = 1n * WAD;
    const maxC = 10n * WAD;
    const maxEff = effectiveMaxCharmWadForSubmit(maxC);
    const r = reconcileFreshBuySizingFromReads({
      spendWeiIntent: 100n * WAD,
      minSpendWei: minS,
      maxSpendWei: maxS,
      pricePerCharmWad: price,
      minCharmWad: minC,
      maxCharmWad: maxC,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.charmWad).toBe(maxEff);
      expect(r.charmWad <= maxC).toBe(true);
      expect(r.spendWei).toBe((r.charmWad * price) / WAD);
    }
  });

  it("fails when slack max falls below min charm", () => {
    const r = reconcileFreshBuySizingFromReads({
      spendWeiIntent: 5n * WAD,
      minSpendWei: 1n * WAD,
      maxSpendWei: 100n * WAD,
      pricePerCharmWad: WAD,
      minCharmWad: 999n * WAD,
      maxCharmWad: 999n * WAD + 1n,
    });
    expect(r.ok).toBe(false);
  });
});
