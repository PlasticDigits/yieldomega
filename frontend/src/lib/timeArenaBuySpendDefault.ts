// SPDX-License-Identifier: AGPL-3.0-only

import type { CredCheckoutBoundsGate } from "@/lib/arenaCredBurn";
import type { Cl8yCheckoutBoundsGate } from "@/lib/timeArenaCl8yCheckoutBounds";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import type { SaleSessionPhase } from "@/pages/arena/arenaSimplePhase";

/** When true, the buy amount field + slider should snap to the minimum spend band. */
export function isArenaBuySpendDefaultMin(input: {
  phase: SaleSessionPhase;
  walletConnected: boolean;
  chainMismatch: boolean;
  cl8ySpendBounds: { minS: bigint; maxS: bigint } | null;
  payWith: PayWithAsset;
  cl8yCheckoutBoundsGate: Cl8yCheckoutBoundsGate;
  credCheckoutBoundsGate: CredCheckoutBoundsGate;
  payUsesKumbaya: boolean;
  kumbayaRoutingBlocker: string | null;
  swapQuoteFailed: boolean;
}): boolean {
  if (input.phase !== "saleActive") return true;
  if (!input.walletConnected) return true;
  if (input.chainMismatch) return true;
  if (input.cl8ySpendBounds === null) return true;
  if ((input.payWith === "cl8y" || input.payWith === "doub") && input.cl8yCheckoutBoundsGate.kind === "insufficient_cl8y") {
    return true;
  }
  if (input.payWith === "cred" && input.credCheckoutBoundsGate.kind === "insufficient_cred") {
    return true;
  }
  if (input.payUsesKumbaya && input.kumbayaRoutingBlocker !== null) return true;
  if (input.payUsesKumbaya && input.swapQuoteFailed) return true;
  return false;
}
