// SPDX-License-Identifier: AGPL-3.0-only

import {
  formatPodiumChipTimerDisplay,
  formatPodiumHeroTimerDisplay,
  isPodiumTimerArmed,
  podiumCountdownSec,
} from "@/pages/arena/arenaPodiumTimerDisplay";
import type { ArenaTimersResponse } from "@/lib/indexerApi";

/**
 * Play-route podium timer UX states ([#343](https://gitlab.com/PlasticDigits/yieldomega/-/issues/343)).
 * Wallet `claimable` CRED is handled on {@link ArenaCharmCredCard} — not mixed into podium timers.
 */
export type PodiumTransitionUxState =
  | "syncing"
  | "unarmed"
  | "live"
  | "expired-pending-roll"
  | "settling"
  | "epoch-advanced";

export type DerivePodiumTransitionInput = {
  armed: boolean | undefined;
  deadlineSec: number | undefined;
  chainNowSec: number | undefined;
  timerCapSec?: number | undefined;
  indexedThroughBlock?: string | undefined;
  readBlockNumber?: string | undefined;
  /** Epoch captured when expiry began — detects post-roll bump. */
  latchedEpoch?: string | undefined;
  currentEpoch?: string | undefined;
};

const DEFAULT_TIMER_CAP_SEC = 691_200;

export function hasIndexerIngestLag(
  indexedThroughBlock?: string,
  readBlockNumber?: string,
): boolean {
  if (!indexedThroughBlock || !readBlockNumber) {
    return false;
  }
  try {
    return BigInt(indexedThroughBlock) < BigInt(readBlockNumber);
  } catch {
    return false;
  }
}

/** Malicious or corrupt indexer deadlines degrade to `syncing` instead of huge positive countdowns. */
export function isSuspiciousDeadline(
  deadlineSec: number,
  chainNowSec: number,
  timerCapSec?: number,
): boolean {
  if (!Number.isFinite(deadlineSec) || !Number.isFinite(chainNowSec)) {
    return true;
  }
  const cap =
    timerCapSec !== undefined && Number.isFinite(timerCapSec)
      ? timerCapSec
      : DEFAULT_TIMER_CAP_SEC;
  return deadlineSec - chainNowSec > cap + 3_600;
}

export function derivePodiumTransitionState(
  input: DerivePodiumTransitionInput,
): PodiumTransitionUxState {
  const {
    armed,
    deadlineSec,
    chainNowSec,
    timerCapSec,
    indexedThroughBlock,
    readBlockNumber,
    latchedEpoch,
    currentEpoch,
  } = input;

  if (armed === false) {
    return "unarmed";
  }
  if (
    armed === undefined ||
    chainNowSec === undefined ||
    deadlineSec === undefined ||
    !Number.isFinite(deadlineSec) ||
    !Number.isFinite(chainNowSec)
  ) {
    return "syncing";
  }
  if (isSuspiciousDeadline(deadlineSec, chainNowSec, timerCapSec)) {
    return "syncing";
  }

  const rem = Math.max(0, Math.floor(deadlineSec - chainNowSec));

  if (
    latchedEpoch !== undefined &&
    currentEpoch !== undefined &&
    latchedEpoch !== "" &&
    currentEpoch !== ""
  ) {
    try {
      if (BigInt(currentEpoch) > BigInt(latchedEpoch) && rem > 0) {
        return "epoch-advanced";
      }
    } catch {
      // fall through
    }
  }

  if (rem > 0) {
    return "live";
  }

  if (hasIndexerIngestLag(indexedThroughBlock, readBlockNumber)) {
    return "settling";
  }
  return "expired-pending-roll";
}

export function transitionStateTestId(state: PodiumTransitionUxState): string | undefined {
  switch (state) {
    case "expired-pending-roll":
      return "arena-timer-expired-pending-roll";
    case "settling":
      return "arena-timer-settling";
    case "epoch-advanced":
      return "arena-timer-epoch-advanced";
    default:
      return undefined;
  }
}

export function transitionUxFootCopy(state: PodiumTransitionUxState): string | undefined {
  switch (state) {
    case "expired-pending-roll":
      return "Waiting for settlement — roll the epoch or wait for the next qualifying buy.";
    case "settling":
      return "Settling podium — syncing indexed state…";
    case "epoch-advanced":
      return "New epoch started.";
    case "syncing":
      return "Syncing timer…";
    default:
      return undefined;
  }
}

export function isTransitionBusyState(state: PodiumTransitionUxState): boolean {
  return state === "expired-pending-roll" || state === "settling" || state === "syncing";
}

export type PodiumTransitionMeta = {
  transitionState: PodiumTransitionUxState;
  countdownSec: number | undefined;
  countdownDisplay: string;
  transitionTestId: string | undefined;
  transitionFoot: string | undefined;
  showRollCta: boolean;
};

export function deadlineSecForContractIndex(
  timerData: ArenaTimersResponse | undefined,
  contractIndex: number,
): number | undefined {
  if (!timerData) {
    return undefined;
  }
  const raw =
    contractIndex === 0
      ? timerData.last_buy_deadline_sec
      : timerData.podium_deadlines_sec[contractIndex];
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildPodiumTransitionMeta(input: {
  contractIndex: number;
  timerData: ArenaTimersResponse | undefined;
  chainNowSec: number | undefined;
  latchedEpoch?: string | undefined;
  currentEpoch?: string | undefined;
  heroDisplay?: boolean;
}): PodiumTransitionMeta {
  const { contractIndex, timerData, chainNowSec, latchedEpoch, currentEpoch, heroDisplay } =
    input;
  const armed = isPodiumTimerArmed(timerData?.podium_timer_armed, contractIndex);
  const deadlineSec = deadlineSecForContractIndex(timerData, contractIndex);
  const timerCapSec =
    timerData?.timer_cap_sec !== undefined ? Number(timerData.timer_cap_sec) : undefined;
  const transitionState = derivePodiumTransitionState({
    armed,
    deadlineSec,
    chainNowSec,
    timerCapSec: Number.isFinite(timerCapSec) ? timerCapSec : undefined,
    indexedThroughBlock: timerData?.indexed_through_block,
    readBlockNumber: timerData?.read_block_number,
    latchedEpoch,
    currentEpoch,
  });
  const countdownSec = podiumCountdownSec(armed, deadlineSec, chainNowSec);
  const formatDisplay = heroDisplay ? formatPodiumHeroTimerDisplay : formatPodiumChipTimerDisplay;
  const countdownDisplay = formatDisplay(armed, countdownSec);
  return {
    transitionState,
    countdownSec,
    countdownDisplay,
    transitionTestId: transitionStateTestId(transitionState),
    transitionFoot: transitionUxFootCopy(transitionState),
    showRollCta: transitionState === "expired-pending-roll" && armed === true,
  };
}
