// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { parseLaunchTimestamp, secondsRemainingUntil } from "./launchCountdown";

describe("parseLaunchTimestamp", () => {
  it("returns undefined for missing / empty / non-finite values", () => {
    expect(parseLaunchTimestamp(undefined)).toBeUndefined();
    expect(parseLaunchTimestamp(null)).toBeUndefined();
    expect(parseLaunchTimestamp("")).toBeUndefined();
    expect(parseLaunchTimestamp("   ")).toBeUndefined();
    expect(parseLaunchTimestamp("abc")).toBeUndefined();
    expect(parseLaunchTimestamp("0")).toBeUndefined();
    expect(parseLaunchTimestamp("-1")).toBeUndefined();
    expect(parseLaunchTimestamp("NaN")).toBeUndefined();
  });

  it("parses a positive integer Unix-seconds timestamp", () => {
    expect(parseLaunchTimestamp("1777552200")).toBe(1777552200);
    expect(parseLaunchTimestamp("  1777552200  ")).toBe(1777552200);
  });

  it("floors fractional values", () => {
    expect(parseLaunchTimestamp("1777552200.9")).toBe(1777552200);
  });
});

describe("secondsRemainingUntil", () => {
  it("returns positive seconds when launch is in the future", () => {
    expect(secondsRemainingUntil(2_000_000_100, 2_000_000_000)).toBe(100);
  });

  it("clamps to zero once now is at or past the deadline", () => {
    expect(secondsRemainingUntil(1_000, 1_000)).toBe(0);
    expect(secondsRemainingUntil(1_000, 5_000)).toBe(0);
  });

  it("returns zero when either side is non-finite", () => {
    expect(secondsRemainingUntil(Number.NaN, 1)).toBe(0);
    expect(secondsRemainingUntil(1, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("uses whole-second granularity", () => {
    expect(secondsRemainingUntil(1_000.7, 999.2)).toBe(1);
  });
});
