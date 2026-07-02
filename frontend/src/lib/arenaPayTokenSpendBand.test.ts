// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/timeArenaMath";
import {
  doubSpendWeiFromCredPayTarget,
  estimateKumbayaPayTokenInFromDoubSpend,
  payTokenWeiAtSliderPermille,
  payTokenWeiForDoubSpend,
  payTokenWeiFromCachedQuoteRate,
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
      payTokenDecimals: 6,
    });
    expect(band?.minPayWei).toBe((10n * WAD * 98n) / (100n * 10n ** 12n));
    expect(band?.maxPayWei).toBe((100n * WAD * 98n) / (100n * 10n ** 12n));
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

  it("derives slider permille from DOUB spend, not stale quoter output", () => {
    const band = {
      minPayWei: 100n,
      maxPayWei: 200n,
      tokenDecimals: 18,
    };
    const spendWei = 55n * WAD;
    const linearPay = payTokenWeiForDoubSpend({
      spendWei,
      cl8ySpendBounds: doubBounds,
      payTokenSpendBand: band,
    });
    expect(linearPay).toBe(150n);
    expect(sliderPermilleForPayTokenWei(band, linearPay)).toBe(5000);
    // Live quoter at the same DOUB spend can differ; slider must track band permille.
    expect(sliderPermilleForPayTokenWei(band, 999n)).not.toBe(5000);
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

  it("uses band-linear YOU PAY for ETH while a spend band is active", () => {
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
    const base = {
      payWith: "eth" as const,
      isArenaV2: true,
      spendWei: 55n * WAD,
      cl8ySpendBounds: doubBounds,
      payTokenSpendBand: band,
      quotedPayInWei: 999n,
      quotedForAmountOutWei: 55n * WAD,
      requiredCredBurnWei: undefined,
      credPerCharmWad: undefined,
      pricePerCharmWad: undefined,
      charmBounds: undefined,
    };
    expect(
      resolveArenaPayTokenDisplayWei({ ...base, quoteLoading: true }),
    ).toBe(150n);
    expect(
      resolveArenaPayTokenDisplayWei({ ...base, quoteLoading: false }),
    ).toBe(150n);
  });

  it("scales USDM YOU PAY from cached quoter rate even when spend band exists", () => {
    const band = {
      minPayWei: 100n,
      maxPayWei: 200n,
      tokenDecimals: 6,
    };
    const quotedPay = 999n;
    const quotedOut = 55n * WAD;
    const halfOut = 27n * WAD + 5n * 10n ** 17n;
    expect(
      resolveArenaPayTokenDisplayWei({
        payWith: "usdm",
        isArenaV2: true,
        spendWei: halfOut,
        cl8ySpendBounds: doubBounds,
        payTokenSpendBand: band,
        quotedPayInWei: quotedPay,
        quotedForAmountOutWei: quotedOut,
        quoteLoading: true,
        requiredCredBurnWei: undefined,
        credPerCharmWad: undefined,
        pricePerCharmWad: undefined,
        charmBounds: undefined,
      }),
    ).toBe((quotedPay * halfOut) / quotedOut);
  });

  it("prefers live quoter output when spend band is still loading", () => {
    const quotedPay = 999n;
    const quotedOut = 55n * WAD;
    const halfOut = 27n * WAD + 5n * 10n ** 17n;
    expect(
      resolveArenaPayTokenDisplayWei({
        payWith: "usdm",
        isArenaV2: true,
        spendWei: halfOut,
        cl8ySpendBounds: doubBounds,
        payTokenSpendBand: null,
        quotedPayInWei: quotedPay,
        quotedForAmountOutWei: quotedOut,
        quoteLoading: true,
        requiredCredBurnWei: undefined,
        credPerCharmWad: undefined,
        pricePerCharmWad: undefined,
        charmBounds: undefined,
      }),
    ).toBe((quotedPay * halfOut) / quotedOut);
    expect(
      resolveArenaPayTokenDisplayWei({
        payWith: "usdm",
        isArenaV2: true,
        spendWei: 55n * WAD,
        cl8ySpendBounds: doubBounds,
        payTokenSpendBand: null,
        quotedPayInWei: quotedPay,
        quotedForAmountOutWei: quotedOut,
        quoteLoading: false,
        requiredCredBurnWei: undefined,
        credPerCharmWad: undefined,
        pricePerCharmWad: undefined,
        charmBounds: undefined,
      }),
    ).toBe(quotedPay);
  });

  it("scales cached USDM quote rate along DOUB spend", () => {
    const payIn = 98n * 10n ** 6n;
    const amountOut = 10n * WAD;
    const spend = 50n * WAD;
    expect(
      payTokenWeiFromCachedQuoteRate({
        spendWei: spend,
        cl8ySpendBounds: doubBounds,
        quotedPayInWei: payIn,
        quotedForAmountOutWei: amountOut,
      }),
    ).toBe(490n * 10n ** 6n);
  });

  it("estimates USDM from DOUB when quoter band is unavailable", () => {
    expect(estimateKumbayaPayTokenInFromDoubSpend("usdm", true, 100n * WAD)).toBe(98n * 10n ** 6n);
  });
});
