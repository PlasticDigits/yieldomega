// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import { resolveCl8yCheckoutBoundsGate } from "@/lib/timeArenaCl8yCheckoutBounds";

describe("resolveCl8yCheckoutBoundsGate", () => {
  const minBuy = 10n ** 18n;
  const minSpend = minCl8ySpendBroadcastHeadroom(minBuy);
  const maxBuy = 50n * 10n ** 18n;

  it("returns loading while min/max buy reads are pending", () => {
    expect(
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: undefined,
        maxBuyWei: maxBuy,
        walletBalanceWei: 0n,
        payWith: "cl8y",
      }),
    ).toEqual({ kind: "loading" });
  });

  it("returns loading while CL8Y wallet balance is pending", () => {
    expect(
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: minBuy,
        maxBuyWei: maxBuy,
        walletBalanceWei: undefined,
        payWith: "cl8y",
      }),
    ).toEqual({ kind: "loading" });
  });

  it("returns ready for ETH/USDM even when CL8Y balance is below min buy", () => {
    expect(
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: minBuy,
        maxBuyWei: maxBuy,
        walletBalanceWei: 1n,
        payWith: "eth",
      }),
    ).toEqual({ kind: "ready" });
  });

  it("returns insufficient_cl8y when CL8Y balance is below the live min spend", () => {
    expect(
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: minBuy,
        maxBuyWei: maxBuy,
        walletBalanceWei: minSpend / 2n,
        payWith: "cl8y",
      }),
    ).toEqual({
      kind: "insufficient_cl8y",
      minSpendWei: minSpend,
      walletBalanceWei: minSpend / 2n,
    });
  });

  it("returns ready when CL8Y balance covers at least the min spend", () => {
    expect(
      resolveCl8yCheckoutBoundsGate({
        minBuyWei: minBuy,
        maxBuyWei: maxBuy,
        walletBalanceWei: minSpend,
        payWith: "cl8y",
      }),
    ).toEqual({ kind: "ready" });
  });
});
