// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  elapsedChartAxisMaxSeconds,
  formatElapsedHms,
  visibleSaleTimeWindow,
} from "./timeCurveSaleWindow";

describe("elapsedChartAxisMaxSeconds", () => {
  it("uses 3× elapsed with a 1s floor so now is at one-third of the axis", () => {
    expect(elapsedChartAxisMaxSeconds(0)).toBe(1);
    expect(elapsedChartAxisMaxSeconds(100)).toBe(300);
    const max = elapsedChartAxisMaxSeconds(90);
    expect(90 / max).toBeCloseTo(1 / 3, 6);
  });
});

describe("formatElapsedHms", () => {
  it("formats seconds as HH:MM:SS", () => {
    expect(formatElapsedHms(0)).toBe("00:00:00");
    expect(formatElapsedHms(59)).toBe("00:00:59");
    expect(formatElapsedHms(3600)).toBe("01:00:00");
    expect(formatElapsedHms(3661)).toBe("01:01:01");
  });
});

describe("visibleSaleTimeWindow", () => {
  it("places now at one-third of the visible span when unclamped", () => {
    const saleStart = 1_000_000;
    const deadline = saleStart + 900;
    const now = saleStart + 300;
    const { left, right } = visibleSaleTimeWindow(saleStart, deadline, now);
    expect(right - left).toBe(900);
    const pos = (now - left) / (right - left);
    expect(pos).toBeCloseTo(1 / 3, 6);
  });

  it("clamps to the sale window when now is past deadline (chart domain stays valid)", () => {
    const saleStart = 2_000_000;
    const deadline = saleStart + 600;
    const nowPast = deadline + 120;
    const { left, right } = visibleSaleTimeWindow(saleStart, deadline, nowPast);
    expect(left).toBeGreaterThanOrEqual(saleStart);
    expect(right).toBeLessThanOrEqual(deadline);
    expect(nowPast >= left && nowPast <= right).toBe(false);
  });
});
