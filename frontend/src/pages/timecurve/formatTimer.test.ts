// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatLaunchCountdown,
  timerUrgencyClass,
} from "./formatTimer";

describe("formatCountdown", () => {
  it("formats seconds < 1 minute as 00:00:SS", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(7)).toBe("00:00:07");
    expect(formatCountdown(59)).toBe("00:00:59");
  });

  it("clamps negative values to 00:00:00 (chain time can briefly drift past deadline)", () => {
    expect(formatCountdown(-5)).toBe("00:00:00");
  });

  it("does not roll an HH > 23 into a day — that's the caller's job (see formatLaunchCountdown)", () => {
    // 25h 13m 7s — HH stays 25, never wraps.
    expect(formatCountdown(25 * 3600 + 13 * 60 + 7)).toBe("25:13:07");
  });
});

describe("formatLaunchCountdown", () => {
  it("returns days=0 for sub-day durations so callers can hide the chip", () => {
    expect(formatLaunchCountdown(0)).toEqual({ days: 0, clock: "00:00:00" });
    expect(formatLaunchCountdown(3661)).toEqual({ days: 0, clock: "01:01:01" });
    expect(formatLaunchCountdown(86399)).toEqual({ days: 0, clock: "23:59:59" });
  });

  it("splits days from the HH:MM:SS clock so 24h+ never renders as 48:13:07", () => {
    // 1d exactly → days=1, clock=00:00:00.
    expect(formatLaunchCountdown(86400)).toEqual({ days: 1, clock: "00:00:00" });
    // 2d 03:13:07.
    const sec = 2 * 86400 + 3 * 3600 + 13 * 60 + 7;
    expect(formatLaunchCountdown(sec)).toEqual({ days: 2, clock: "03:13:07" });
  });

  it("clamps negative values (timer briefly past chain deadline before refresh)", () => {
    expect(formatLaunchCountdown(-100)).toEqual({ days: 0, clock: "00:00:00" });
  });

  it("is the same split used by both LaunchCountdownPage and TimeCurveSimplePage", () => {
    // Sentinel: keep this round-trip stable so both views render identically.
    const totalSec = 90061; // 1d 01:01:01
    const { days, clock } = formatLaunchCountdown(totalSec);
    expect(days).toBe(1);
    expect(clock).toBe("01:01:01");
  });
});

describe("timerUrgencyClass", () => {
  it("returns empty for undefined / above warning threshold", () => {
    expect(timerUrgencyClass(undefined)).toBe("");
    expect(timerUrgencyClass(3600 + 1)).toBe("");
  });

  it("flags warning between 5 minutes and 1 hour (inclusive)", () => {
    expect(timerUrgencyClass(3600)).toBe("timer-hero--warning");
    expect(timerUrgencyClass(301)).toBe("timer-hero--warning");
  });

  it("flags critical at or below 5 minutes", () => {
    expect(timerUrgencyClass(300)).toBe("timer-hero--critical");
    expect(timerUrgencyClass(0)).toBe("timer-hero--critical");
  });
});
