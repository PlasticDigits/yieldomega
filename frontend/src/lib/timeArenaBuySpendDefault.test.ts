// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { isArenaBuySpendDefaultMin } from "@/lib/timeArenaBuySpendDefault";

const bounds = { minS: 1n, maxS: 100n };

function base(overrides: Partial<Parameters<typeof isArenaBuySpendDefaultMin>[0]> = {}) {
  return isArenaBuySpendDefaultMin({
    phase: "saleActive",
    walletConnected: true,
    chainMismatch: false,
    cl8ySpendBounds: bounds,
    payWith: "cl8y",
    cl8yCheckoutBoundsGate: { kind: "ready" },
    credCheckoutBoundsGate: { kind: "ready" },
    payUsesKumbaya: false,
    kumbayaRoutingBlocker: null,
    swapQuoteFailed: false,
    ...overrides,
  });
}

describe("isArenaBuySpendDefaultMin", () => {
  it("defaults when sale is inactive or wallet cannot buy", () => {
    expect(base({ phase: "loading" })).toBe(true);
    expect(base({ walletConnected: false })).toBe(true);
    expect(base({ chainMismatch: true })).toBe(true);
    expect(base({ cl8ySpendBounds: null })).toBe(true);
  });

  it("defaults when the active pay asset cannot complete checkout", () => {
    expect(
      base({
        cl8yCheckoutBoundsGate: {
          kind: "insufficient_cl8y",
          minSpendWei: 10n,
          walletBalanceWei: 1n,
        },
      }),
    ).toBe(true);
    expect(
      base({
        payWith: "cred",
        credCheckoutBoundsGate: {
          kind: "insufficient_cred",
          requiredCredWei: 10n,
          walletBalanceWei: 1n,
        },
      }),
    ).toBe(true);
    expect(
      base({
        payWith: "eth",
        payUsesKumbaya: true,
        kumbayaRoutingBlocker: "No route",
      }),
    ).toBe(true);
    expect(
      base({
        payWith: "eth",
        payUsesKumbaya: true,
        swapQuoteFailed: true,
      }),
    ).toBe(true);
  });

  it("keeps user sizing when checkout is ready", () => {
    expect(base()).toBe(false);
    expect(base({ payWith: "eth", payUsesKumbaya: true })).toBe(false);
  });
});
