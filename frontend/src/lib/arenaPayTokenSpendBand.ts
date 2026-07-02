// SPDX-License-Identifier: AGPL-3.0-only

import { credBurnForCharmWad } from "@/lib/arenaCredBurn";
import { isDirectArenaSpendPay, payUsesKumbayaRoute } from "@/lib/arenaPayAsset";
import { finalizeCharmSpendForBuy } from "@/lib/timeArenaBuyAmount";
import { WAD } from "@/lib/timeArenaMath";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import { cl8ySpendWeiFromPayTokenFallback } from "@/lib/kumbayaCl8ySpendFromPayToken";

export type PayTokenSpendBand = {
  minPayWei: bigint;
  maxPayWei: bigint;
  tokenDecimals: number;
};

function clampBigint(x: bigint, lo: bigint, hi: bigint): bigint {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

function capMaxPayWei(maxPayWei: bigint, walletBalanceWei: bigint | undefined): bigint {
  if (walletBalanceWei === undefined) return maxPayWei;
  return walletBalanceWei < maxPayWei ? walletBalanceWei : maxPayWei;
}

function credPayWeiForDoubSpend(input: {
  spendWei: bigint;
  pricePerCharmWad: bigint;
  minCharmWad: bigint;
  maxCharmWad: bigint;
  credPerCharmWad: bigint;
}): bigint | null {
  try {
    const { charmWad } = finalizeCharmSpendForBuy(
      input.spendWei,
      input.pricePerCharmWad,
      input.minCharmWad,
      input.maxCharmWad,
    );
    return credBurnForCharmWad(charmWad, input.credPerCharmWad);
  } catch {
    return null;
  }
}

/** YOU PAY min/max band in the active pay token (not DOUB) for slider + defaults. */
export function resolveArenaPayTokenSpendBand(input: {
  payWith: PayWithAsset;
  isArenaV2: boolean;
  cl8ySpendBounds: { minS: bigint; maxS: bigint } | null;
  decimals: number;
  payTokenDecimals: number;
  quotedBandMinPayInWei?: bigint;
  quotedBandMaxPayInWei?: bigint;
  walletPayBalanceWei?: bigint;
  credPerCharmWad?: bigint;
  pricePerCharmWad?: bigint;
  charmBounds?: readonly [bigint, bigint];
}): PayTokenSpendBand | null {
  const { cl8ySpendBounds, payWith, isArenaV2 } = input;
  if (!cl8ySpendBounds) return null;
  const { minS, maxS } = cl8ySpendBounds;

  if (isDirectArenaSpendPay(payWith, isArenaV2)) {
    return {
      minPayWei: minS,
      maxPayWei: maxS,
      tokenDecimals: input.decimals,
    };
  }

  if (payWith === "cred") {
    if (
      input.credPerCharmWad === undefined ||
      input.pricePerCharmWad === undefined ||
      input.charmBounds === undefined
    ) {
      return null;
    }
    const [minCharmWad, maxCharmWad] = input.charmBounds;
    const minPayWei = credPayWeiForDoubSpend({
      spendWei: minS,
      pricePerCharmWad: input.pricePerCharmWad,
      minCharmWad,
      maxCharmWad,
      credPerCharmWad: input.credPerCharmWad,
    });
    const maxPayWeiRaw = credPayWeiForDoubSpend({
      spendWei: maxS,
      pricePerCharmWad: input.pricePerCharmWad,
      minCharmWad,
      maxCharmWad,
      credPerCharmWad: input.credPerCharmWad,
    });
    if (minPayWei === null || maxPayWeiRaw === null || maxPayWeiRaw < minPayWei) {
      return null;
    }
    const maxPayWei = capMaxPayWei(maxPayWeiRaw, input.walletPayBalanceWei);
    if (maxPayWei < minPayWei) return null;
    return { minPayWei, maxPayWei, tokenDecimals: 18 };
  }

  if (payUsesKumbayaRoute(payWith, isArenaV2)) {
    if (input.quotedBandMinPayInWei !== undefined && input.quotedBandMaxPayInWei !== undefined) {
      const minPayWei = input.quotedBandMinPayInWei;
      let maxPayWei = input.quotedBandMaxPayInWei;
      if (maxPayWei < minPayWei) return null;
      maxPayWei = capMaxPayWei(maxPayWei, input.walletPayBalanceWei);
      if (maxPayWei < minPayWei) return null;
      return {
        minPayWei,
        maxPayWei,
        tokenDecimals: payWith === "cl8y" ? 18 : input.payTokenDecimals,
      };
    }
    const minEst = estimateKumbayaPayTokenInFromDoubSpend(payWith, isArenaV2, minS);
    const maxEst = estimateKumbayaPayTokenInFromDoubSpend(payWith, isArenaV2, maxS);
    if (minEst === null || maxEst === null || maxEst < minEst) {
      return null;
    }
    let maxPayWei = capMaxPayWei(maxEst, input.walletPayBalanceWei);
    if (maxPayWei < minEst) return null;
    return {
      minPayWei: minEst,
      maxPayWei,
      tokenDecimals: payWith === "cl8y" ? 18 : input.payTokenDecimals,
    };
  }

  return null;
}

export function payTokenWeiAtSliderPermille(band: PayTokenSpendBand, permille: bigint): bigint {
  const p = clampBigint(permille, 0n, 10000n);
  const span = band.maxPayWei - band.minPayWei;
  return band.minPayWei + (span * p) / 10000n;
}

/** Map DOUB spend position to pay-token wei using the active band (same permille as slider). */
export function payTokenWeiForDoubSpend(input: {
  spendWei: bigint;
  cl8ySpendBounds: { minS: bigint; maxS: bigint };
  payTokenSpendBand: PayTokenSpendBand;
}): bigint {
  const { minS, maxS } = input.cl8ySpendBounds;
  const span = maxS - minS;
  if (span <= 0n) return input.payTokenSpendBand.minPayWei;
  const sw = clampBigint(input.spendWei, minS, maxS);
  const permille = ((sw - minS) * 10000n) / span;
  return payTokenWeiAtSliderPermille(input.payTokenSpendBand, permille);
}

/**
 * Static inverse of {@link cl8ySpendWeiFromPayTokenFallback} for ETH/USDM preview
 * when the onchain Kumbaya quoter is still loading (not indexer-backed).
 */
export function estimateKumbayaPayTokenInFromDoubSpend(
  payWith: PayWithAsset,
  isArenaV2: boolean,
  doubSpendWei: bigint,
): bigint | null {
  if (!payUsesKumbayaRoute(payWith, isArenaV2) || doubSpendWei <= 0n) return null;
  if (payWith === "eth") {
    return (doubSpendWei * 419n) / 1_000_000n;
  }
  if (payWith === "usdm") {
    return (doubSpendWei * 98n) / 100n;
  }
  if (payWith === "cl8y") {
    return doubSpendWei;
  }
  return null;
}

export function resolveArenaPayTokenDisplayWei(input: {
  payWith: PayWithAsset;
  isArenaV2: boolean;
  spendWei: bigint;
  cl8ySpendBounds: { minS: bigint; maxS: bigint };
  payTokenSpendBand: PayTokenSpendBand | null;
  quotedPayInWei: bigint | undefined;
  quoteLoading: boolean;
  requiredCredBurnWei: bigint | undefined;
  credPerCharmWad: bigint | undefined;
  pricePerCharmWad: bigint | undefined;
  charmBounds: readonly [bigint, bigint] | undefined;
}): bigint | undefined {
  const { payWith, isArenaV2, cl8ySpendBounds } = input;
  const spend = clampBigint(input.spendWei, cl8ySpendBounds.minS, cl8ySpendBounds.maxS);

  if (isDirectArenaSpendPay(payWith, isArenaV2)) {
    return spend;
  }

  if (payWith === "cred") {
    if (input.requiredCredBurnWei !== undefined) {
      return input.requiredCredBurnWei;
    }
    if (
      input.credPerCharmWad !== undefined &&
      input.pricePerCharmWad !== undefined &&
      input.charmBounds !== undefined
    ) {
      const [minCharmWad, maxCharmWad] = input.charmBounds;
      return credPayWeiForDoubSpend({
        spendWei: spend,
        pricePerCharmWad: input.pricePerCharmWad,
        minCharmWad,
        maxCharmWad,
        credPerCharmWad: input.credPerCharmWad,
      }) ?? undefined;
    }
    return undefined;
  }

  const linearPay = input.payTokenSpendBand
    ? payTokenWeiForDoubSpend({
        spendWei: spend,
        cl8ySpendBounds,
        payTokenSpendBand: input.payTokenSpendBand,
      })
    : estimateKumbayaPayTokenInFromDoubSpend(payWith, isArenaV2, spend);

  if (input.quotedPayInWei !== undefined && !input.quoteLoading) {
    return input.quotedPayInWei;
  }
  return linearPay ?? undefined;
}

export function sliderPermilleForPayTokenWei(band: PayTokenSpendBand, payWei: bigint): number {
  const span = band.maxPayWei - band.minPayWei;
  if (span <= 0n) return 0;
  const clamped = clampBigint(payWei, band.minPayWei, band.maxPayWei);
  return Number(((clamped - band.minPayWei) * 10000n) / span);
}

export function doubSpendWeiFromCredPayTarget(input: {
  targetCredWei: bigint;
  credPerCharmWad: bigint;
  pricePerCharmWad: bigint;
  minCharmWad: bigint;
  maxCharmWad: bigint;
  minSpendWei: bigint;
  maxSpendWei: bigint;
}): bigint {
  if (input.credPerCharmWad <= 0n || input.pricePerCharmWad <= 0n) {
    return input.minSpendWei;
  }
  let charmWad = (input.targetCredWei * WAD) / input.credPerCharmWad;
  if (charmWad < input.minCharmWad) charmWad = input.minCharmWad;
  if (charmWad > input.maxCharmWad) charmWad = input.maxCharmWad;
  const spendWei = (charmWad * input.pricePerCharmWad) / WAD;
  return clampBigint(spendWei, input.minSpendWei, input.maxSpendWei);
}

export function doubSpendWeiFromPayTokenSliderTarget(input: {
  payWith: PayWithAsset;
  isArenaV2: boolean;
  targetPayWei: bigint;
  minSpendWei: bigint;
  maxSpendWei: bigint;
  credPerCharmWad?: bigint;
  pricePerCharmWad?: bigint;
  charmBounds?: readonly [bigint, bigint];
}): bigint {
  const { payWith, isArenaV2, targetPayWei, minSpendWei, maxSpendWei } = input;
  if (isDirectArenaSpendPay(payWith, isArenaV2)) {
    return clampBigint(targetPayWei, minSpendWei, maxSpendWei);
  }
  if (payWith === "cred") {
    if (
      input.credPerCharmWad === undefined ||
      input.pricePerCharmWad === undefined ||
      input.charmBounds === undefined
    ) {
      return minSpendWei;
    }
    const [minCharmWad, maxCharmWad] = input.charmBounds;
    return doubSpendWeiFromCredPayTarget({
      targetCredWei: targetPayWei,
      credPerCharmWad: input.credPerCharmWad,
      pricePerCharmWad: input.pricePerCharmWad,
      minCharmWad,
      maxCharmWad,
      minSpendWei,
      maxSpendWei,
    });
  }
  if (payWith === "eth" || payWith === "usdm") {
    return cl8ySpendWeiFromPayTokenFallback(targetPayWei, payWith, minSpendWei, maxSpendWei);
  }
  if (maxSpendWei <= minSpendWei) return minSpendWei;
  return minSpendWei;
}
