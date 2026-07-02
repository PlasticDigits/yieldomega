// SPDX-License-Identifier: AGPL-3.0-only

import type { PayWithAsset } from "@/lib/kumbayaRoutes";

/** Wallet → TimeArena direct pull (DOUB on v2, CL8Y on legacy). */
export function isDirectArenaSpendPay(payWith: PayWithAsset, isArenaV2: boolean): boolean {
  return isArenaV2 ? payWith === "doub" : payWith === "cl8y";
}

/** Kumbaya buy-router path (ETH/USDM; reserve CL8Y on v2). */
export function payUsesKumbayaRoute(payWith: PayWithAsset, isArenaV2: boolean): boolean {
  return payWith === "eth" || payWith === "usdm" || (isArenaV2 && payWith === "cl8y");
}

export function defaultArenaPayWith(isArenaV2: boolean): PayWithAsset {
  return isArenaV2 ? "doub" : "cl8y";
}

/** Primary spend label for direct-pull mode in the buy panel. */
export function directArenaSpendLabel(isArenaV2: boolean): string {
  return isArenaV2 ? "DOUB" : "CL8Y";
}

/** Onchain USDm uses 6 decimals on MegaETH; DOUB/CL8Y/ETH use 18. */
export const USDM_PAY_TOKEN_DECIMALS = 6;

/** Fallback when `decimals()` has not resolved yet — avoids USDM wei shown with 18 decimals. */
export function defaultPayTokenDecimals(payWith: PayWithAsset): number {
  return payWith === "usdm" ? USDM_PAY_TOKEN_DECIMALS : 18;
}

/** `10^(18 - 6)` — static USDM fallback rates map DOUB wei to USDM smallest units. */
export const USDM_FROM_DOUB_DECIMAL_SCALE = 10n ** 12n;
