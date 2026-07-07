// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  warbowSecondsUntilNextUtcDay,
  warbowUtcDayId,
} from "./warbowUtcDayReset";
import { WARBOW_SECONDS_PER_DAY } from "./arenaWarbowConstants";

const DAY = Number(WARBOW_SECONDS_PER_DAY);

describe("warbowUtcDayReset", () => {
  it("matches onchain floor division for UTC day id", () => {
    expect(warbowUtcDayId(0, DAY)).toBe(0n);
    expect(warbowUtcDayId(DAY - 1, DAY)).toBe(0n);
    expect(warbowUtcDayId(DAY, DAY)).toBe(1n);
    expect(warbowUtcDayId(DAY * 2 + 123, DAY)).toBe(2n);
  });

  it("counts down to the next UTC-day boundary", () => {
    expect(warbowSecondsUntilNextUtcDay(0, DAY)).toBe(DAY);
    expect(warbowSecondsUntilNextUtcDay(DAY - 1, DAY)).toBe(1);
    expect(warbowSecondsUntilNextUtcDay(DAY, DAY)).toBe(DAY);
    expect(warbowSecondsUntilNextUtcDay(DAY + 3600, DAY)).toBe(DAY - 3600);
  });
});
