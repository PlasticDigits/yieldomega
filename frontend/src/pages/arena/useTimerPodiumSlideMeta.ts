// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { addresses } from "@/lib/addresses";
import { clampPlayerLevel, shouldShowPodiumLevelLock } from "@/lib/arenaProgression";
import {
  formatTimerSectionTitle,
  type SaleSessionPhase,
  type TimerPayoutPreviewState,
} from "@/pages/arena/arenaSimplePhase";
import {
  TIMER_PODIUM_CAROUSEL_SLOTS,
  normalizeTimerPodiumSlideIndex,
} from "@/pages/arena/timerPodiumCarouselSlots";
import {
  isPodiumTimerArmed,
  PODIUM_TIMER_AWAITING_FIRST_BUY,
  podiumCountdownSec,
} from "@/pages/arena/arenaPodiumTimerDisplay";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { PodiumPayoutPreview } from "@/pages/arena/usePodiumReads";

export function isTimerPodiumSlideLocked(
  categoryIndex: number,
  requiredLevel: number,
  walletConnected: boolean,
  viewerLevel: number | undefined,
): boolean {
  return shouldShowPodiumLevelLock(walletConnected, viewerLevel, requiredLevel, categoryIndex);
}

export function useTimerPodiumSlideMeta(
  slideIndex: number,
  opts: {
    phase: SaleSessionPhase;
    decimals: number;
    podiumPayoutPreview?: PodiumPayoutPreview | null;
    lastBuyCountdownSec?: number;
    walletConnected: boolean;
    playerLevel?: bigint | number;
  },
) {
  const activeIndex = normalizeTimerPodiumSlideIndex(slideIndex);
  const slot = TIMER_PODIUM_CAROUSEL_SLOTS[activeIndex]!;
  const { data: timerData } = useArenaTimersQuery(addresses.timeArena ?? undefined);

  const viewerLevel = opts.walletConnected
    ? clampPlayerLevel(opts.playerLevel ?? 1)
    : undefined;

  const payoutPreview: TimerPayoutPreviewState =
    opts.podiumPayoutPreview === undefined
      ? "loading"
      : opts.podiumPayoutPreview === null
        ? "unavailable"
        : "ready";

  const title = useMemo(
    () =>
      formatTimerSectionTitle(opts.phase, {
        firstPrizeDoubWad: opts.podiumPayoutPreview?.[slot.categoryIndex]?.places[0],
        decimals: opts.decimals,
        payoutPreview,
      }),
    [opts.decimals, opts.phase, opts.podiumPayoutPreview, payoutPreview, slot.categoryIndex],
  );

  const countdownSec = useMemo(() => {
    if (opts.phase !== "saleActive") {
      return opts.lastBuyCountdownSec;
    }
    if (!timerData) return undefined;
    const armed = isPodiumTimerArmed(timerData.podium_timer_armed, slot.contractIndex);
    if (armed === false) {
      return undefined;
    }
    const now = Number(timerData.block_timestamp_sec);
    if (slot.contractIndex === 0 && opts.lastBuyCountdownSec !== undefined) {
      return opts.lastBuyCountdownSec;
    }
    const deadline = Number(timerData.podium_deadlines_sec[slot.contractIndex] ?? 0);
    return podiumCountdownSec(armed, deadline, now);
  }, [opts.lastBuyCountdownSec, opts.phase, slot.contractIndex, timerData]);

  const locked = isTimerPodiumSlideLocked(
    slot.categoryIndex,
    slot.requiredLevel,
    opts.walletConnected,
    viewerLevel,
  );
  const lockedForConnection = locked && !opts.walletConnected;

  const countdownPlaceholder =
    opts.phase === "saleActive" &&
    isPodiumTimerArmed(timerData?.podium_timer_armed, slot.contractIndex) === false
      ? PODIUM_TIMER_AWAITING_FIRST_BUY
      : undefined;

  return {
    activeIndex,
    slot,
    title,
    countdownSec,
    countdownPlaceholder,
    locked,
    lockedForConnection,
    viewerLevel,
  };
}
