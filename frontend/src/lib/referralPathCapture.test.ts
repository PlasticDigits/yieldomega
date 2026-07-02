// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  extractReferralCodeFromPathname,
  isReferralPlayPathname,
} from "./referralPathCapture";

describe("extractReferralCodeFromPathname", () => {
  it("accepts a valid top-level referral slug", () => {
    expect(extractReferralCodeFromPathname("/luck777")).toBe("luck777");
    expect(extractReferralCodeFromPathname("/alphabet999")).toBe("alphabet999");
  });

  it("rejects too-short codes", () => {
    expect(extractReferralCodeFromPathname("/ab")).toBeNull();
  });

  it("accepts a code under legacy /arena when not a product sub-route", () => {
    expect(extractReferralCodeFromPathname("/arena/abc12")).toBe("abc12");
    expect(extractReferralCodeFromPathname("/arena/test1")).toBe("test1");
  });

  it("returns null for arena, protocol, and audit", () => {
    expect(extractReferralCodeFromPathname("/arena/arena")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/protocol")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/audit")).toBeNull();
    expect(extractReferralCodeFromPathname("/audit")).toBeNull();
  });

  it("returns null when the slug mirrors a reserved top-level segment", () => {
    expect(extractReferralCodeFromPathname("/home")).toBeNull();
    expect(extractReferralCodeFromPathname("/referrals")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/home")).toBeNull();
    expect(extractReferralCodeFromPathname("/arena/referrals")).toBeNull();
  });

  it("returns null for longer paths (no path capture yet)", () => {
    expect(extractReferralCodeFromPathname("/a/b/c")).toBeNull();
  });
});

describe("isReferralPlayPathname", () => {
  it("treats index and referral slugs as play routes", () => {
    expect(isReferralPlayPathname("/")).toBe(true);
    expect(isReferralPlayPathname("/abc12")).toBe(true);
    expect(isReferralPlayPathname("/arena/abc12")).toBe(true);
  });

  it("excludes audit, referrals, and unknown multi-segment paths", () => {
    expect(isReferralPlayPathname("/audit")).toBe(false);
    expect(isReferralPlayPathname("/referrals")).toBe(false);
    expect(isReferralPlayPathname("/definitely-not-a-route")).toBe(false);
    expect(isReferralPlayPathname("/kumbaya")).toBe(false);
  });
});
