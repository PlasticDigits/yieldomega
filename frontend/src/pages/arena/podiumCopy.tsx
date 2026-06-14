// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable react-refresh/only-export-components -- shared arena podium copy helpers */

import { FEATURE_UNLOCK_LEVEL, type ArenaFeatureKey } from "@/lib/arenaProgression";

/** UX label order. Contract reads use {@link PODIUM_CONTRACT_CATEGORY_INDEX}. */
export const PODIUM_LABELS = ["Last Buy", "WarBow", "Defended Streak", "Time Booster"] as const;

/** Matches `ArenaPodiumTimerConfig.getProductionDefaults` (GitLab #271). */
export type PodiumTimerTableRow = {
  extensionSec: number;
  initialTimerSec: number;
  timerCapSec: number;
  resetBelowRemainingSec: number;
  resetToRemainingSec: number;
};

/** UX slot order: Last Buy, WarBow, Defended Streak, Time Booster. */
export const PODIUM_TIMER_BY_UX_SLOT: readonly [
  PodiumTimerTableRow,
  PodiumTimerTableRow,
  PodiumTimerTableRow,
  PodiumTimerTableRow,
] = [
  {
    extensionSec: 120,
    initialTimerSec: 86_400,
    timerCapSec: 345_600,
    resetBelowRemainingSec: 780,
    resetToRemainingSec: 900,
  },
  {
    extensionSec: 300,
    initialTimerSec: 172_800,
    timerCapSec: 691_200,
    resetBelowRemainingSec: 3300,
    resetToRemainingSec: 3600,
  },
  {
    extensionSec: 90,
    initialTimerSec: 64_800,
    timerCapSec: 259_200,
    resetBelowRemainingSec: 510,
    resetToRemainingSec: 600,
  },
  {
    extensionSec: 60,
    initialTimerSec: 43_200,
    timerCapSec: 172_800,
    resetBelowRemainingSec: 240,
    resetToRemainingSec: 300,
  },
];

/** Last Buy remaining threshold for Defended Streak scoring (`DEFENDED_STREAK_WINDOW_SEC`). */
export const DEFENDED_STREAK_SCORE_WINDOW_SEC = 900;

const WARBOW_BASE_BUY_BP = 250;
const WARBOW_TIMER_RESET_BONUS_BP = 500;
const WARBOW_CLUTCH_BONUS_BP = 150;
const WARBOW_CLUTCH_REMAINING_SEC = 30;

/** Human-readable duration for podium help copy (display only). */
export function formatPodiumDuration(sec: number): string {
  if (sec >= 86_400 && sec % 86_400 === 0) {
    const days = sec / 86_400;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (sec >= 3600 && sec % 3600 === 0) {
    const hours = sec / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (sec >= 60) {
    const minutes = sec / 60;
    if (Number.isInteger(minutes)) {
      return minutes === 1 ? "1 minute" : `${minutes} minutes`;
    }
    return `${minutes} minutes`;
  }
  return sec === 1 ? "1 second" : `${sec} seconds`;
}

export function podiumTimerHelpLine(row: PodiumTimerTableRow): string {
  return `+${formatPodiumDuration(row.extensionSec)} per buy (max ${formatPodiumDuration(row.timerCapSec)}). Below ${formatPodiumDuration(row.resetBelowRemainingSec)} remaining, resets to ${formatPodiumDuration(row.resetToRemainingSec)}.`;
}

const PODIUM_PRIZE_LINES: readonly string[] = [
  "Top 3 most recent buyers win when this timer hits zero.",
  "Top Battle Points (BP) win when this timer hits zero.",
  "Highest defended-streak count wins when this timer hits zero.",
  "Most total Last Buy time added wins when this timer hits zero.",
];

const PODIUM_SCORING_LINES: readonly string[] = [
  "Score: recency — 1st is the latest buyer; shown as seconds since each buyer's last qualifying buy.",
  `Score: BP from buys (${WARBOW_BASE_BUY_BP} base, +${WARBOW_TIMER_RESET_BONUS_BP} on Last Buy hard reset, +${WARBOW_CLUTCH_BONUS_BP} clutch when Last Buy is under ${WARBOW_CLUTCH_REMAINING_SEC} s before your buy) plus steals, guards, and flags. Buy bonuses read the Last Buy timer; this timer sets prize payout only.`,
  `Score: consecutive buys while the Last Buy timer is under ${formatPodiumDuration(DEFENDED_STREAK_SCORE_WINDOW_SEC)} and your buy adds time (+1 per streak step). Scoring reads the Last Buy timer; this timer sets prize payout only.`,
  "Score: sum of seconds actually added to the Last Buy timer on your buys. Scoring reads the Last Buy timer; this timer sets prize payout only.",
];

/** Maps each {@link PODIUM_LABELS} slot to `TimeArena.podium(category)` index. */
export const PODIUM_CONTRACT_CATEGORY_INDEX: readonly number[] = [0, 3, 2, 1];

const PODIUM_FEATURE_BY_UX_INDEX: Record<number, ArenaFeatureKey> = {
  0: "last_buy",
  1: "warbow",
  2: "defended_streak",
  3: "time_booster",
};

/** UX slot index → feature key for tutorial modals and podium help buttons. */
export function podiumFeatureForUxIndex(uxIndex: number): ArenaFeatureKey {
  return PODIUM_FEATURE_BY_UX_INDEX[uxIndex]!;
}

const PODIUM_EPOCH_ROLL_LINE =
  "When a timer hits zero, anyone can roll that category's epoch and pay the top 3 (4:2:1 split).";

const WARBOW_EPOCH_ROLL_LINE =
  "When this timer hits zero, anyone can roll the epoch; WarBow prizes are paid via admin finalize (4:2:1 split).";

/** How buyer level gates which podium timers a wallet's buy extends (#299). */
export function podiumBuyExtensionFooter(feature: ArenaFeatureKey): string {
  const unlockLevel = FEATURE_UNLOCK_LEVEL[feature];
  switch (feature) {
    case "last_buy":
      return `From Level ${unlockLevel}, your buys extend this timer and count on this podium. Other podium timers extend only after you unlock those mechanics (Level ${FEATURE_UNLOCK_LEVEL.time_booster} Time Booster, Level ${FEATURE_UNLOCK_LEVEL.defended_streak} Defended Streak, Level ${FEATURE_UNLOCK_LEVEL.warbow} WarBow). ${PODIUM_EPOCH_ROLL_LINE}`;
    case "time_booster":
      return `From Level ${unlockLevel}, your buys extend the Time Booster timer and score here. Last Buy extends from Level ${FEATURE_UNLOCK_LEVEL.last_buy}; higher podiums need higher levels. ${PODIUM_EPOCH_ROLL_LINE}`;
    case "defended_streak":
      return `From Level ${unlockLevel}, your buys extend the Defended Streak timer and build streak score. Lower-level buys still extend Last Buy only. ${PODIUM_EPOCH_ROLL_LINE}`;
    case "warbow":
      return `From Level ${unlockLevel}, your buys extend the WarBow timer and earn BP. Lower-level buys extend fewer podium timers. ${WARBOW_EPOCH_ROLL_LINE}`;
    default:
      return PODIUM_EPOCH_ROLL_LINE;
  }
}

/** Tutorial modal copy for podium mechanics (timer chips + unlock modals). */
export function podiumFeatureMechanicCopy(feature: ArenaFeatureKey): { title: string; body: string[] } | null {
  const uxIndex = Object.entries(PODIUM_FEATURE_BY_UX_INDEX).find(([, key]) => key === feature)?.[0];
  if (uxIndex === undefined) {
    return null;
  }
  const i = Number(uxIndex);
  const timer = PODIUM_TIMER_BY_UX_SLOT[i]!;
  const label = PODIUM_LABELS[i]!;
  return {
    title: `${label} podium`,
    body: [
      PODIUM_PRIZE_LINES[i]!,
      podiumTimerHelpLine(timer),
      PODIUM_SCORING_LINES[i]!,
      podiumBuyExtensionFooter(feature),
    ],
  };
}
