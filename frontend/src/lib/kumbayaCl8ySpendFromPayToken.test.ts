// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { cl8ySpendWeiFromPayTokenFallback } from "./kumbayaCl8ySpendFromPayToken";

describe("cl8ySpendWeiFromPayTokenFallback", () => {
  it("inverts USDM fallback rate within bounds", () => {
    const min = 100n;
    const max = 10_000n;
    const pay = 980n;
    expect(cl8ySpendWeiFromPayTokenFallback(pay, "usdm", min, max)).toBe(1000n);
  });

  it("clamps to max when pay budget is large", () => {
    expect(cl8ySpendWeiFromPayTokenFallback(1_000_000n, "eth", 0n, 500n)).toBe(500n);
  });
});
