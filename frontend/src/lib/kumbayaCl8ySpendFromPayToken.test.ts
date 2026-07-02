// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/timeArenaMath";
import { cl8ySpendWeiFromPayTokenFallback } from "./kumbayaCl8ySpendFromPayToken";

describe("cl8ySpendWeiFromPayTokenFallback", () => {
  it("inverts USDM fallback at onchain wei scale", () => {
    const min = 10n * WAD;
    const max = 100n * WAD;
    const pay = 98n * 10n ** 6n;
    expect(cl8ySpendWeiFromPayTokenFallback(pay, "usdm", min, max)).toBe(100n * WAD);
  });

  it("clamps to max when pay budget is large", () => {
    expect(cl8ySpendWeiFromPayTokenFallback(1_000_000n, "eth", 0n, 500n)).toBe(500n);
  });
});
