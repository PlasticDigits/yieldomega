// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { isReferralSlugReservedForRouting } from "./referralPathReserved";

describe("isReferralSlugReservedForRouting", () => {
  it("blocks timecurve product sub-routes", () => {
    expect(isReferralSlugReservedForRouting("arena")).toBe(true);
    expect(isReferralSlugReservedForRouting("protocol")).toBe(true);
  });

  it("blocks mirrored top-level path segments", () => {
    expect(isReferralSlugReservedForRouting("home")).toBe(true);
    expect(isReferralSlugReservedForRouting("referrals")).toBe(true);
    expect(isReferralSlugReservedForRouting("timecurve")).toBe(true);
  });

  it("allows ordinary slugs", () => {
    expect(isReferralSlugReservedForRouting("abc12")).toBe(false);
    expect(isReferralSlugReservedForRouting("luck777")).toBe(false);
  });
});
