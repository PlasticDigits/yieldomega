// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeCurveMinSpendHeadroom";

describe("minCl8ySpendBroadcastHeadroom", () => {
  it("maps 0.99e18 onchain min to 1e18", () => {
    const onchain = (99n * 10n ** 16n) as bigint; // 0.99 * 1e18
    expect(minCl8ySpendBroadcastHeadroom(onchain)).toBe(10n ** 18n);
  });

  it("is ceil(onchain * 100 / 99) for non-multiples", () => {
    expect(minCl8ySpendBroadcastHeadroom(1n)).toBe(2n);
    expect(minCl8ySpendBroadcastHeadroom(100n)).toBe(102n);
  });

  it("returns 0 for 0", () => {
    expect(minCl8ySpendBroadcastHeadroom(0n)).toBe(0n);
  });
});
