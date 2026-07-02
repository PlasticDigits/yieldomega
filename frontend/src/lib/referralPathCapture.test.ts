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
    expect(extractReferralCodeFromPathname("/arena/abc12")).toBe("abc12");
    expect(extractReferralCodeFromPathname("/arena/test1")).toBe("test1");
  });

  it("returns null for arena, protocol, and audit", () => {
    expect(extractReferralCodeFromPathname("/arena/arena")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/protocol")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/audit")).toBeNull();
  });

  it("returns null when the slug mirrors a reserved top-level segment", () => {
    expect(extractReferralCodeFromPathname("/arena/home")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/referrals")).toBeNull();
  });

  it("returns null for longer paths (no path capture yet)", () => {
    expect(extractReferralCodeFromPathname("/a/b/c")).toBeNull();
  });
});
