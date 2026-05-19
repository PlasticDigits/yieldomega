// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { kumbayaQuoteUsesCompositeSingles } from "./kumbayaQuoter";

describe("kumbayaQuoteUsesCompositeSingles", () => {
  it("uses composite singles only for USDM pay", () => {
    expect(kumbayaQuoteUsesCompositeSingles("usdm")).toBe(true);
    expect(kumbayaQuoteUsesCompositeSingles("eth")).toBe(false);
    expect(kumbayaQuoteUsesCompositeSingles("cl8y")).toBe(false);
  });
});
