// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { bgmLinearGainFromPermille, sfxCurveGainFromPermille } from "./audioPreferences";

describe("audioPreferences", () => {
  it("maps default BGM 25% to 0.25 linear gain (issue #68)", () => {
    expect(bgmLinearGainFromPermille(250)).toBeCloseTo(0.25, 5);
    expect(bgmLinearGainFromPermille(1000)).toBe(1);
  });

  it("applies a curve to SFX permille so mid values are gentler", () => {
    expect(sfxCurveGainFromPermille(500)).toBeCloseTo(0.25, 5);
    expect(sfxCurveGainFromPermille(1000)).toBe(1);
  });
});
