// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { dualWallClockLines, formatDoubHuman } from "./presaleVestingFormat";

describe("presaleVestingFormat", () => {
  it("formats DOUB wei without noisy trailing zeros", () => {
    expect(formatDoubHuman(1_800n * 10n ** 18n)).toBe("1800");
    expect(formatDoubHuman(1n)).toBe("0.000000000000000001");
  });

  it("dualWallClockLines returns distinct UTC string", () => {
    const z = dualWallClockLines(1_700_000_000n);
    expect(z.utc).toContain("GMT");
    expect(z.local.length).toBeGreaterThan(10);
  });
});
