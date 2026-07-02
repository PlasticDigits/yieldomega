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
