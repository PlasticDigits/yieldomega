// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatWarbowViewerBattlePointsDisplay,
  roundNonNegativeBigIntToSignificantDigits,
} from "./arenaPageHelpers";

describe("roundNonNegativeBigIntToSignificantDigits", () => {
  it("returns the value unchanged when digit length is within sigfigs", () => {
    expect(roundNonNegativeBigIntToSignificantDigits(12345n, 5)).toBe(12345n);
    expect(roundNonNegativeBigIntToSignificantDigits(99999n, 5)).toBe(99999n);
  });

  it("rounds half-up on the first dropped digit", () => {
    expect(roundNonNegativeBigIntToSignificantDigits(123456n, 5)).toBe(123460n);
    expect(roundNonNegativeBigIntToSignificantDigits(123454n, 5)).toBe(123450n);
  });

  it("carries when rounding pushes coef past the original width", () => {
    expect(roundNonNegativeBigIntToSignificantDigits(9995n, 3)).toBe(10000n);
  });

  it("rejects negative values", () => {
    expect(() => roundNonNegativeBigIntToSignificantDigits(-1n, 3)).toThrow(RangeError);
  });
});

describe("formatWarbowViewerBattlePointsDisplay", () => {
  it("returns an em dash when BP is undefined", () => {
    expect(formatWarbowViewerBattlePointsDisplay(undefined)).toBe("—");
  });

  it("locale-groups the rounded integer", () => {
    const s = formatWarbowViewerBattlePointsDisplay(123456n);
    expect(s).toMatch(/123,?460/);
  });
});
