// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { addresses } from "@/lib/addresses";
import { clampPlayerLevel } from "@/lib/arenaProgression";
import {
  formatTimerSectionTitle,
  type SaleSessionPhase,
  type TimerPayoutPreviewState,
} from "@/pages/arena/arenaSimplePhase";
import {
  TIMER_PODIUM_CAROUSEL_SLOTS,
  normalizeTimerPodiumSlideIndex,
} from "@/pages/arena/timerPodiumCarouselSlots";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { PodiumPayoutPreview } from "@/pages/arena/usePodiumReads";

export function isTimerPodiumSlideLocked(
  categoryIndex: number,
  requiredLevel: number,
  walletConnected: boolean,
  viewerLevel: number | undefined,
): boolean {
  if (categoryIndex === 0) return false;
  if (!walletConnected) return true;
  return viewerLevel !== undefined && viewerLevel < requiredLevel;
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
    if (slot.contractIndex === 0 && opts.lastBuyCountdownSec !== undefined) {
      return opts.lastBuyCountdownSec;
    }
    if (!timerData) return undefined;
    const now = Number(timerData.block_timestamp_sec);
    const deadline = Number(timerData.podium_deadlines_sec[slot.contractIndex] ?? 0);
    return Math.max(0, deadline - now);
  }, [opts.lastBuyCountdownSec, opts.phase, slot.contractIndex, timerData]);

  const locked = isTimerPodiumSlideLocked(
    slot.categoryIndex,
    slot.requiredLevel,
    opts.walletConnected,
    viewerLevel,
  );
  const lockedForConnection = locked && !opts.walletConnected;

  return {
    activeIndex,
    slot,
    title,
    countdownSec,
    locked,
    lockedForConnection,
    viewerLevel,
  };
}
