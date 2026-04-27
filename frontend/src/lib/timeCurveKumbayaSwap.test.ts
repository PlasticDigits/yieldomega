// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { swapDeadlineUnixSecFromChainTimestamp } from "@/lib/timeCurveKumbayaSwap";

describe("swapDeadlineUnixSecFromChainTimestamp", () => {
  it("adds buffer to floored chain seconds", () => {
    expect(swapDeadlineUnixSecFromChainTimestamp(1_700_000_000, 600)).toBe(1_700_000_600n);
  });

  it("floors fractional chain timestamps", () => {
    expect(swapDeadlineUnixSecFromChainTimestamp(1_700_000_000.9, 60)).toBe(1_700_000_060n);
  });

  it("rejects non-finite chain time", () => {
    expect(() => swapDeadlineUnixSecFromChainTimestamp(Number.NaN)).toThrow(/non-negative finite/);
    expect(() => swapDeadlineUnixSecFromChainTimestamp(-1)).toThrow(/non-negative finite/);
  });
});
