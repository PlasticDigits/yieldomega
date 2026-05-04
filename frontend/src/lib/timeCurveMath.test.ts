// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  capElapsedForSalePricing,
  CHARM_MAX_BASE_WAD,
  CHARM_MIN_BASE_WAD,
  currentMinBuyAt,
  displayMinGrossSpendWad,
  linearPriceWad,
  maxCharmWadAt,
  maxCharmWadAtFloat,
  maxGrossSpendAtFloat,
  minCharmWadAt,
  minCharmWadAtFloat,
  minGrossSpendAtFloat,
  MAX_SALE_ELAPSED_SEC,
  WAD,
} from "./timeCurveMath";

/** ln(1.2) in WAD — matches contracts/test/TimeMath.t.sol */
const GROWTH_RATE_20PCT = 182_321_556_793_954_592n;
const ONE_DAY = 86400n;

describe("capElapsedForSalePricing / MAX_SALE_ELAPSED_SEC (GitLab #124)", () => {
  it("caps bigint elapsed at the onchain 300-day wall", () => {
    const over = MAX_SALE_ELAPSED_SEC + 86400n * 7n;
    expect(capElapsedForSalePricing(over)).toBe(MAX_SALE_ELAPSED_SEC);
  });

  it("linearPriceWad plateaus after the cap (matches saturated elapsed)", () => {
    const base = WAD;
    const daily = 10n ** 16n;
    const atCap = linearPriceWad(base, daily, MAX_SALE_ELAPSED_SEC);
    const beyond = linearPriceWad(base, daily, MAX_SALE_ELAPSED_SEC + 86400n * 60n);
    expect(beyond).toBe(atCap);
  });
});

describe("displayMinGrossSpendWad", () => {
  it("maps contract min through CHARM_MIN_BASE so nominal min is 1/10 max gross at same elapsed", () => {
    const initial = WAD;
    const growth = 0n;
    const base = WAD;
    const daily = 0n;
    const elapsed = 50_000;
    const cMin = minGrossSpendAtFloat(initial, growth, base, daily, elapsed);
    const cMax = maxGrossSpendAtFloat(initial, growth, base, daily, elapsed);
    const dMin = displayMinGrossSpendWad(cMin);
    expect(cMax / dMin).toBe(10n);
    expect(dMin * CHARM_MIN_BASE_WAD).toBe(cMin * WAD);
  });
});

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

  it("plateaus after MAX_SALE_ELAPSED_SEC wall clock (GitLab #124)", () => {
    const a = currentMinBuyAt(WAD, GROWTH_RATE_20PCT, MAX_SALE_ELAPSED_SEC);
    const b = currentMinBuyAt(WAD, GROWTH_RATE_20PCT, MAX_SALE_ELAPSED_SEC + ONE_DAY);
    expect(a).toBe(b);
  });
});

describe("CHARM bounds mirror vs TimeCurve._charmBounds (ref === 0)", () => {
  it("minCharmWadAt returns CHARM_MIN_BASE_WAD when ref is zero", () => {
    expect(minCharmWadAt(0n, GROWTH_RATE_20PCT, ONE_DAY)).toBe(CHARM_MIN_BASE_WAD);
  });

  it("maxCharmWadAt returns CHARM_MAX_BASE_WAD when ref is zero", () => {
    expect(maxCharmWadAt(0n, GROWTH_RATE_20PCT, ONE_DAY)).toBe(CHARM_MAX_BASE_WAD);
  });

  it("minCharmWadAtFloat returns CHARM_MIN_BASE_WAD when ref is zero", () => {
    expect(minCharmWadAtFloat(0n, GROWTH_RATE_20PCT, 86_400)).toBe(CHARM_MIN_BASE_WAD);
  });

  it("maxCharmWadAtFloat returns CHARM_MAX_BASE_WAD when ref is zero", () => {
    expect(maxCharmWadAtFloat(0n, GROWTH_RATE_20PCT, 86_400)).toBe(CHARM_MAX_BASE_WAD);
  });
});
