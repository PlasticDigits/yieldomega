// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  DEFENDED_STREAK_SCORE_WINDOW_SEC,
  formatPodiumDuration,
  podiumBuyExtensionFooter,
  podiumPayoutPreviewIndex,
  PODIUM_CONTRACT_CATEGORY_INDEX,
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
      extensionSec: 480,
      initialTimerSec: 86_400,
      timerCapSec: 345_600,
      resetBelowRemainingSec: 1320,
      resetToRemainingSec: 1800,
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
    expect(formatPodiumDuration(480)).toBe("8 minutes");
    expect(formatPodiumDuration(780)).toBe("13 minutes");
    expect(formatPodiumDuration(900)).toBe("15 minutes");
    expect(formatPodiumDuration(1320)).toBe("22 minutes");
    expect(formatPodiumDuration(1800)).toBe("30 minutes");
    expect(formatPodiumDuration(86_400)).toBe("1 day");
    expect(formatPodiumDuration(345_600)).toBe("4 days");
  });

  it("includes extension, cap, and reset in timer help line", () => {
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("+2 minutes per buy");
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("max 4 days");
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[0])).toContain("Below 13 minutes remaining, resets to 15 minutes");
    expect(podiumTimerHelpLine(PODIUM_TIMER_BY_UX_SLOT[2])).toBe(
      "+8 minutes per buy (max 4 days). Below 22 minutes remaining, resets to 30 minutes.",
    );
  });

  it("gates last buy timer extension copy on player level", () => {
    const footer = podiumBuyExtensionFooter("last_buy");
    expect(footer).toContain("From Level 1");
    expect(footer).not.toContain("all four podium timers");
    expect(footer).toContain("Level 2 Time Booster");
    expect(footer).toContain("Level 3 Defended Streak");
    expect(footer).toContain("Level 4 WarBow");
  });

  it("maps UX podium slots to onchain prize preview indices", () => {
    expect(PODIUM_CONTRACT_CATEGORY_INDEX).toEqual([0, 3, 2, 1]);
    expect(podiumPayoutPreviewIndex(0)).toBe(0);
    expect(podiumPayoutPreviewIndex(1)).toBe(3);
    expect(podiumPayoutPreviewIndex(2)).toBe(2);
    expect(podiumPayoutPreviewIndex(3)).toBe(1);
  });
});
