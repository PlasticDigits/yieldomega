// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { warbowUtcDayResetSec } from "./warbowUtcDayReset";

const DAY = 86_400;

describe("warbowUtcDayResetSec", () => {
  it("counts down to the next UTC midnight using floor division semantics", () => {
    expect(warbowUtcDayResetSec(0, DAY)).toBe(DAY);
    expect(warbowUtcDayResetSec(1, DAY)).toBe(DAY - 1);
    expect(warbowUtcDayResetSec(DAY - 1, DAY)).toBe(1);
    expect(warbowUtcDayResetSec(DAY, DAY)).toBe(DAY);
    expect(warbowUtcDayResetSec(DAY + 3600, DAY)).toBe(DAY - 3600);
  });

  it("uses floor division on chain timestamps", () => {
    expect(warbowUtcDayResetSec(86_399, DAY)).toBe(1);
  });
});
