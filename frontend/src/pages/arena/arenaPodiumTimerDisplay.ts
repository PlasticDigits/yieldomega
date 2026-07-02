// SPDX-License-Identifier: AGPL-3.0-only

import {
  formatDdHhMmSsCountdown,
  formatPodiumChipCountdown,
} from "@/pages/arena/formatTimer";

/** Copy when a podium epoch timer is unarmed (GitLab #330). */
export const PODIUM_TIMER_AWAITING_FIRST_BUY = "BUY TO START";

export function isPodiumTimerArmed(
  armed: readonly boolean[] | undefined,
  contractIndex: number,
): boolean | undefined {
  if (armed === undefined) {
    return undefined;
  }
  return armed[contractIndex] ?? false;
}

/** Whole seconds until deadline; `undefined` when unarmed or indexer head missing. */
export function podiumCountdownSec(
  armed: boolean | undefined,
  deadlineSec: number | undefined,
  chainNowSec: number | undefined,
): number | undefined {
  if (armed === false) {
    return undefined;
  }
  if (deadlineSec === undefined || chainNowSec === undefined) {
    return undefined;
  }
  if (!Number.isFinite(deadlineSec) || !Number.isFinite(chainNowSec)) {
    return undefined;
  }
  return Math.max(0, Math.floor(deadlineSec - chainNowSec));
}

export function formatPodiumChipTimerDisplay(
  armed: boolean | undefined,
  countdownSec: number | undefined,
): string {
  if (armed === false) {
    return PODIUM_TIMER_AWAITING_FIRST_BUY;
  }
  if (countdownSec === undefined) {
    return "—";
  }
  return formatPodiumChipCountdown(countdownSec);
}

export function formatPodiumHeroTimerDisplay(
  armed: boolean | undefined,
  countdownSec: number | undefined,
): string {
  if (armed === false) {
    return PODIUM_TIMER_AWAITING_FIRST_BUY;
  }
  if (countdownSec === undefined) {
    return "—";
  }
  return formatDdHhMmSsCountdown(countdownSec);
}
