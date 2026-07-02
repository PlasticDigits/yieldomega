// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/timeArenaMath";
import {
  doubSpendWeiFromCredPayTarget,
  estimateKumbayaPayTokenInFromDoubSpend,
  payTokenWeiAtSliderPermille,
  payTokenWeiForDoubSpend,
  resolveArenaPayTokenDisplayWei,
  resolveArenaPayTokenSpendBand,
  sliderPermilleForPayTokenWei,
} from "@/lib/arenaPayTokenSpendBand";

const doubBounds = { minS: 10n * WAD, maxS: 100n * WAD };

describe("resolveArenaPayTokenSpendBand", () => {
  it("uses DOUB bounds for direct spend", () => {
    expect(
      resolveArenaPayTokenSpendBand({
        payWith: "doub",
        isArenaV2: true,
        cl8ySpendBounds: doubBounds,
        decimals: 18,
        payTokenDecimals: 18,
      }),
    ).toEqual({
      minPayWei: 10n * WAD,
      maxPayWei: 100n * WAD,
      tokenDecimals: 18,
    });
  });

  it("uses kumbaya band quotes for ETH and caps max by wallet", () => {
    expect(
      resolveArenaPayTokenSpendBand({
        payWith: "eth",
        isArenaV2: true,
        cl8ySpendBounds: doubBounds,
        decimals: 18,
        payTokenDecimals: 18,
        quotedBandMinPayInWei: 1n,
        quotedBandMaxPayInWei: 10n,
        walletPayBalanceWei: 4n,
      }),
    ).toEqual({
      minPayWei: 1n,
      maxPayWei: 4n,
      tokenDecimals: 18,
    });
  });

  it("falls back to static ETH/USDM estimates when band quotes are still loading", () => {
    const band = resolveArenaPayTokenSpendBand({
      payWith: "usdm",
      isArenaV2: true,
      cl8ySpendBounds: doubBounds,
      decimals: 18,
      payTokenDecimals: 18,
    });
    expect(band?.minPayWei).toBe((10n * WAD * 98n) / 100n);
    expect(band?.maxPayWei).toBe((100n * WAD * 98n) / 100n);
  });

  it("derives CRED min/max from charm burn at DOUB band edges", () => {
    const band = resolveArenaPayTokenSpendBand({
      payWith: "cred",
      isArenaV2: true,
      cl8ySpendBounds: doubBounds,
      decimals: 18,
      payTokenDecimals: 18,
      credPerCharmWad: 100n * WAD,
      pricePerCharmWad: WAD,
      charmBounds: [1n * WAD, 100n * WAD],
      walletPayBalanceWei: 5000n * WAD,
    });
    expect(band?.minPayWei).toBe(1000n * WAD);
    expect(band?.maxPayWei).toBe(5000n * WAD);
  });
});

describe("pay token slider helpers", () => {
  const band = { minPayWei: 10n, maxPayWei: 110n, tokenDecimals: 18 };

  it("maps permille to pay token wei along the active band", () => {
    expect(payTokenWeiAtSliderPermille(band, 5000n)).toBe(60n);
    expect(sliderPermilleForPayTokenWei(band, 60n)).toBe(5000);
  });

  it("maps CRED pay targets back to DOUB spend", () => {
    const spend = doubSpendWeiFromCredPayTarget({
      targetCredWei: 200n * WAD,
      credPerCharmWad: 100n * WAD,
      pricePerCharmWad: WAD,
      minCharmWad: 1n * WAD,
      maxCharmWad: 10n * WAD,
      minSpendWei: 10n * WAD,
      maxSpendWei: 100n * WAD,
    });
    expect(spend).toBe(10n * WAD);
  });

  it("prefers live quoter output but uses linear preview while quote is loading", () => {
    const band = {
      minPayWei: 100n,
      maxPayWei: 200n,
      tokenDecimals: 18,
    };
    const linearMid = payTokenWeiForDoubSpend({
      spendWei: 55n * WAD,
      cl8ySpendBounds: doubBounds,
      payTokenSpendBand: band,
    });
    expect(linearMid).toBe(150n);
    expect(
      resolveArenaPayTokenDisplayWei({
        payWith: "usdm",
        isArenaV2: true,
        spendWei: 55n * WAD,
        cl8ySpendBounds: doubBounds,
        payTokenSpendBand: band,
        quotedPayInWei: 999n,
        quoteLoading: true,
        requiredCredBurnWei: undefined,
        credPerCharmWad: undefined,
        pricePerCharmWad: undefined,
        charmBounds: undefined,
      }),
    ).toBe(150n);
    expect(
      resolveArenaPayTokenDisplayWei({
        payWith: "usdm",
        isArenaV2: true,
        spendWei: 55n * WAD,
        cl8ySpendBounds: doubBounds,
        payTokenSpendBand: band,
        quotedPayInWei: 999n,
        quoteLoading: false,
        requiredCredBurnWei: undefined,
        credPerCharmWad: undefined,
        pricePerCharmWad: undefined,
        charmBounds: undefined,
      }),
    ).toBe(999n);
  });

  it("estimates USDM from DOUB when quoter band is unavailable", () => {
    expect(estimateKumbayaPayTokenInFromDoubSpend("usdm", true, 100n * WAD)).toBe(98n * WAD);
  });
});
