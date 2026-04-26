// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";

describe("fallbackPayTokenWeiForCl8y", () => {
  it("maps 1e18 CL8Y to 0.98e18 USDM", () => {
    const wad = 10n ** 18n;
    expect(fallbackPayTokenWeiForCl8y(wad, "usdm")).toBe((wad * 98n) / 100n);
  });

  it("maps 1e18 CL8Y to 0.000419e18 ETH", () => {
    const wad = 10n ** 18n;
    expect(fallbackPayTokenWeiForCl8y(wad, "eth")).toBe((wad * 419n) / 1_000_000n);
  });
});
