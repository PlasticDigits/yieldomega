// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  DEFENDED_STREAK_SCORE_WINDOW_SEC,
  formatPodiumDuration,
  podiumBuyExtensionFooter,
  PODIUM_TIMER_BY_UX_SLOT,
  podiumTimerHelpLine,
} from "./podiumCopy";

describe("podiumCopy", () => {
  it("matches ArenaPodiumTimerConfig production defaults", () => {
    expect(PODIUM_TIMER_BY_UX_SLOT[0]).toEqual({
      extensionSec: 120,
      initialTimerSec: 86_400,
      timerCapSec: 345_600,
      resetBelowRemainingSec: 780,
      resetToRemainingSec: 900,
    });
    expect(PODIUM_TIMER_BY_UX_SLOT[1]).toEqual({
      extensionSec: 300,
      initialTimerSec: 172_800,
      timerCapSec: 691_200,
      resetBelowRemainingSec: 3300,
      resetToRemainingSec: 3600,
    });
    expect(PODIUM_TIMER_BY_UX_SLOT[2]).toEqual({
      extensionSec: 90,
      initialTimerSec: 64_800,
      timerCapSec: 259_200,
      resetBelowRemainingSec: 510,
      resetToRemainingSec: 600,
    });
    expect(PODIUM_TIMER_BY_UX_SLOT[3]).toEqual({
      extensionSec: 60,
      initialTimerSec: 43_200,
      timerCapSec: 172_800,
      resetBelowRemainingSec: 240,
      resetToRemainingSec: 300,
    });
    expect(DEFENDED_STREAK_SCORE_WINDOW_SEC).toBe(900);
  });

  it("formats canonical timer bands for help copy", () => {
    expect(formatPodiumDuration(120)).toBe("2 minutes");
    expect(formatPodiumDuration(90)).toBe("1.5 minutes");
    expect(formatPodiumDuration(780)).toBe("13 minutes");
    expect(formatPodiumDuration(900)).toBe("15 minutes");
    expect(formatPodiumDuration(86_400)).toBe("1 day");
    expect(formatPodiumDuration(345_600)).toBe("4 days");
  });

  it("includes extension, cap, and reset in timer help line", () => {
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("+2 minutes per buy");
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("max 4 days");
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("Below 13 minutes remaining, resets to 15 minutes");
  });

  it("gates last buy timer extension copy on player level", () => {
    const footer = podiumBuyExtensionFooter("last_buy");
    expect(footer).toContain("From Level 1");
    expect(footer).not.toContain("all four podium timers");
    expect(footer).toContain("Level 2 Time Booster");
    expect(footer).toContain("Level 3 Defended Streak");
    expect(footer).toContain("Level 4 WarBow");
  });
});
