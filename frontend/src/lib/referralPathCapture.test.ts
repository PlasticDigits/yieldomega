// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { extractReferralCodeFromPathname } from "./referralPathCapture";

describe("extractReferralCodeFromPathname", () => {
  it("does not use bare /{code} (no route; would collide with /home and other literals)", () => {
    expect(extractReferralCodeFromPathname("/luck777")).toBeNull();
  });

  it("rejects too-short codes", () => {
    expect(extractReferralCodeFromPathname("/ab")).toBeNull();
  });

  it("accepts a code under /timecurve when not a product sub-route", () => {
    expect(extractReferralCodeFromPathname("/timecurve/abc12")).toBe("abc12");
  });

  it("returns null for arena and protocol", () => {
    expect(extractReferralCodeFromPathname("/timecurve/arena")).toBeNull();
    expect(extractReferralCodeFromPathname("/timecurve/protocol")).toBeNull();
  });

  it("returns null when the slug mirrors a reserved top-level segment", () => {
    expect(extractReferralCodeFromPathname("/timecurve/home")).toBeNull();
    expect(extractReferralCodeFromPathname("/timecurve/referrals")).toBeNull();
  });

  it("returns null for longer paths (no path capture yet)", () => {
    expect(extractReferralCodeFromPathname("/a/b/c")).toBeNull();
  });
});
