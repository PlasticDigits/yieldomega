// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UI / slider **minimum** gross CL8Y spend (wei) with headroom above the
 * onchain `currentMinBuyAmount` so a transaction that lands a few blocks late
 * still clears the curve minimum after per-block ticks (product rule: treat
 * effective floor as **onchain_min / 0.99** → `ceil(onchain_min × 100 / 99)` in
 * integer wei). At typical launch values this lands on **1e18** when the
 * contract read is **0.99e18**.
 */
export function minCl8ySpendBroadcastHeadroom(onchainMinWei: bigint): bigint {
  if (onchainMinWei <= 0n) {
    return onchainMinWei;
  }
  return (onchainMinWei * 100n + 98n) / 99n;
}
