// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  formatPodiumChipTimerDisplay,
  formatPodiumHeroTimerDisplay,
  PODIUM_TIMER_AWAITING_FIRST_BUY,
  podiumCountdownSec,
} from "@/pages/arena/arenaPodiumTimerDisplay";

describe("arenaPodiumTimerDisplay", () => {
  it("returns undefined countdown when unarmed", () => {
    expect(podiumCountdownSec(false, 9_000, 1_000)).toBeUndefined();
  });

  it("shows BUY TO START copy when unarmed", () => {
    expect(formatPodiumChipTimerDisplay(false, undefined)).toBe(PODIUM_TIMER_AWAITING_FIRST_BUY);
    expect(formatPodiumHeroTimerDisplay(false, undefined)).toBe(PODIUM_TIMER_AWAITING_FIRST_BUY);
  });

  it("formats armed countdown", () => {
    expect(formatPodiumChipTimerDisplay(true, 125)).toBe("00:02:05");
    expect(formatPodiumHeroTimerDisplay(true, 90_061)).toBe("01:01:01:01");
  });
});
