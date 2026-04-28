// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  CHARM_SUBMIT_LOWER_HEADROOM_BPS,
  CHARM_SUBMIT_UPPER_SLACK_BPS,
  effectiveMaxCharmWadForSubmit,
  effectiveMinCharmWadForSubmit,
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

describe("effectiveMinCharmWadForSubmit", () => {
  it("raises live min by 50 bps (100.5%) so lower-band drift is less likely at inclusion", () => {
    const min = 1002n * (WAD / 1000n); // 1.002 CHARM
    const eff = effectiveMinCharmWadForSubmit(min);
    expect(eff).toBe((min * (10000n + CHARM_SUBMIT_LOWER_HEADROOM_BPS)) / 10000n);
    expect(eff > min).toBe(true);
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

  it("fails when effective max falls below effective min after both margins", () => {
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

  it("bumps implied charm above raw min when spend targets the lower envelope edge", () => {
    const price = WAD;
    const minS = 1n * WAD;
    const maxS = 100n * WAD;
    const minC = 1n * WAD;
    const maxC = 10n * WAD;
    const minEff = effectiveMinCharmWadForSubmit(minC);
    const r = reconcileFreshBuySizingFromReads({
      spendWeiIntent: 1n * WAD,
      minSpendWei: minS,
      maxSpendWei: maxS,
      pricePerCharmWad: price,
      minCharmWad: minC,
      maxCharmWad: maxC,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.charmWad).toBe(minEff);
      expect(r.charmWad > minC).toBe(true);
      expect(r.spendWei).toBe((r.charmWad * price) / WAD);
    }
  });
});
