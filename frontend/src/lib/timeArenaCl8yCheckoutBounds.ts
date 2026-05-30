// SPDX-License-Identifier: AGPL-3.0-only

import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";

export type Cl8yCheckoutBoundsGate =
  | { kind: "loading" }
  | { kind: "ready" }
  | {
      kind: "insufficient_cl8y";
      minSpendWei: bigint;
      walletBalanceWei: bigint;
    };

/** Derive Simple/Arena CL8Y checkout gate from live min/max buy reads and wallet balance. */
export function resolveCl8yCheckoutBoundsGate(input: {
  minBuyWei: bigint | undefined;
  maxBuyWei: bigint | undefined;
  walletBalanceWei: bigint | undefined;
  payWith: PayWithAsset;
}): Cl8yCheckoutBoundsGate {
  const { minBuyWei, maxBuyWei, walletBalanceWei, payWith } = input;
  if (minBuyWei === undefined || maxBuyWei === undefined) {
    return { kind: "loading" };
  }
  if (payWith !== "cl8y") {
    return { kind: "ready" };
  }
  if (walletBalanceWei === undefined) {
    return { kind: "loading" };
  }
  const minS = minCl8ySpendBroadcastHeadroom(minBuyWei);
  const walletBal = walletBalanceWei;
  let maxS = maxBuyWei;
  if (walletBal < maxS) {
    maxS = walletBal;
  }
  if (minS > maxS) {
    return {
      kind: "insufficient_cl8y",
      minSpendWei: minS,
      walletBalanceWei: walletBal,
    };
  }
  return { kind: "ready" };
}
