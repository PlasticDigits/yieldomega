// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { shouldShowPendingPill } from "./referralStorage";

describe("shouldShowPendingPill — GitLab #205 referrals footer pill gate", () => {
  it("returns true when on /referrals with a non-empty code", () => {
    expect(shouldShowPendingPill("/referrals", "swarmyo")).toBe(true);
    expect(shouldShowPendingPill("/referrals", "yieldomegamaddev")).toBe(true);
    expect(shouldShowPendingPill("/referrals", "abc")).toBe(true);
  });

  it("returns false when not on /referrals even with a valid code", () => {
    expect(shouldShowPendingPill("/", "swarmyo")).toBe(false);
    expect(shouldShowPendingPill("/timecurve", "swarmyo")).toBe(false);
    expect(shouldShowPendingPill("/timecurve/arena", "swarmyo")).toBe(false);
    expect(shouldShowPendingPill("/referrals/", "swarmyo")).toBe(false);
    expect(shouldShowPendingPill("/referrals/something", "swarmyo")).toBe(false);
  });

  it("returns false when there is no pending code", () => {
    expect(shouldShowPendingPill("/referrals", null)).toBe(false);
    expect(shouldShowPendingPill("/referrals", "")).toBe(false);
    expect(shouldShowPendingPill("/referrals", "   ")).toBe(false);
    expect(shouldShowPendingPill("/referrals", "\t\n")).toBe(false);
  });

  it("returns false for both gates failing", () => {
    expect(shouldShowPendingPill("/", null)).toBe(false);
    expect(shouldShowPendingPill("/timecurve", "")).toBe(false);
  });
});
