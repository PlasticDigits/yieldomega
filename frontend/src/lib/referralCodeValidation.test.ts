// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { validateCodeClientSide } from "./referralCodeValidation";

describe("validateCodeClientSide — GitLab #208 pre-submit referral code validation", () => {
  it("returns empty for whitespace-only input", () => {
    expect(validateCodeClientSide("")).toEqual({ kind: "empty" });
    expect(validateCodeClientSide("   ")).toEqual({ kind: "empty" });
    expect(validateCodeClientSide("\t\n")).toEqual({ kind: "empty" });
  });

  it("returns invalid-length for fewer than 3 characters", () => {
    expect(validateCodeClientSide("a")).toEqual({ kind: "invalid-length" });
    expect(validateCodeClientSide("ab")).toEqual({ kind: "invalid-length" });
  });

  it("returns invalid-length for more than 16 characters", () => {
    expect(validateCodeClientSide("abcdefghijklmnopq")).toEqual({ kind: "invalid-length" });
    expect(validateCodeClientSide("a".repeat(17))).toEqual({ kind: "invalid-length" });
  });

  it("accepts 3-character codes at lower bound", () => {
    expect(validateCodeClientSide("abc")).toEqual({ kind: "ok", normalized: "abc" });
    expect(validateCodeClientSide("123")).toEqual({ kind: "ok", normalized: "123" });
  });

  it("accepts 16-character codes at upper bound", () => {
    expect(validateCodeClientSide("abcdefghijklmnop")).toEqual({ kind: "ok", normalized: "abcdefghijklmnop" });
    expect(validateCodeClientSide("yieldomegamaddev")).toEqual({ kind: "ok", normalized: "yieldomegamaddev" });
  });

  it("returns invalid-charset for special characters", () => {
    expect(validateCodeClientSide("ab-cd")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("ab_cd")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("ab.cd")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("ab cd")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("ab!cd")).toEqual({ kind: "invalid-charset" });
  });

  it("returns invalid-charset for unicode / accented characters", () => {
    expect(validateCodeClientSide("café")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("résumé")).toEqual({ kind: "invalid-charset" });
    expect(validateCodeClientSide("日本語")).toEqual({ kind: "invalid-charset" });
  });

  it("normalizes uppercase to lowercase", () => {
    expect(validateCodeClientSide("ABC")).toEqual({ kind: "ok", normalized: "abc" });
    expect(validateCodeClientSide("YieldOmega")).toEqual({ kind: "ok", normalized: "yieldomega" });
    expect(validateCodeClientSide("MaDdEv")).toEqual({ kind: "ok", normalized: "maddev" });
  });

  it("trims surrounding whitespace before validation", () => {
    expect(validateCodeClientSide("  hello  ")).toEqual({ kind: "ok", normalized: "hello" });
    expect(validateCodeClientSide("\tabc\n")).toEqual({ kind: "ok", normalized: "abc" });
  });

  it("accepts mixed alphanumeric", () => {
    expect(validateCodeClientSide("luck777")).toEqual({ kind: "ok", normalized: "luck777" });
    expect(validateCodeClientSide("test1")).toEqual({ kind: "ok", normalized: "test1" });
    expect(validateCodeClientSide("123abc")).toEqual({ kind: "ok", normalized: "123abc" });
  });
});
