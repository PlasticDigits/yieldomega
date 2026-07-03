// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { addresses } from "@/lib/addresses";
import { clampPlayerLevel, shouldShowPodiumFeatureLock } from "@/lib/arenaProgression";
import {
  formatTimerSectionTitle,
  type SaleSessionPhase,
  type TimerPayoutPreviewState,
} from "@/pages/arena/arenaSimplePhase";
import {
  TIMER_PODIUM_CAROUSEL_SLOTS,
  normalizeTimerPodiumSlideIndex,
} from "@/pages/arena/timerPodiumCarouselSlots";
import { PODIUM_TIMER_AWAITING_FIRST_BUY } from "@/pages/arena/arenaPodiumTimerDisplay";
import {
  buildPodiumTransitionMeta,
  type PodiumTransitionUxState,
} from "@/pages/arena/arenaTransitionState";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";
import { usePodiumEpochLatch } from "@/pages/arena/usePodiumEpochLatch";

export function isTimerPodiumSlideLocked(
  categoryIndex: number,
  requiredLevel: number,
  walletConnected: boolean,
  viewerLevel: number | undefined,
  walletSurfaceUnlocked: boolean,
  walletStatsPending = false,
): boolean {
  return shouldShowPodiumFeatureLock({
    categoryIndex,
    requiredLevel,
    walletConnected,
    viewerLevel,
    walletSurfaceUnlocked,
    walletStatsPending,
  }).locked;
}

export function useTimerPodiumSlideMeta(
  slideIndex: number,
  opts: {
    phase: SaleSessionPhase;
    decimals: number;
    podiumPayoutPreview?: PodiumPayoutPreview | null;
    lastBuyCountdownSec?: number;
    /** Shared skew anchor from `useArenaHeroTimer` ([#343](https://gitlab.com/PlasticDigits/yieldomega/-/issues/343)). */
    chainNowSec?: number;
    walletConnected: boolean;
    playerLevel?: bigint | number;
    podiumRows?: readonly PodiumReadRow[] | undefined;
    walletSurfaceUnlocked: boolean;
    walletStatsPending?: boolean;
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
        firstPrizeDoubWad: opts.podiumPayoutPreview?.[slot.contractIndex]?.places[0],
        decimals: opts.decimals,
        payoutPreview,
      }),
    [opts.decimals, opts.phase, opts.podiumPayoutPreview, payoutPreview, slot.contractIndex],
  );

  const currentEpoch = opts.podiumRows?.[slot.categoryIndex]?.epoch;
  const preliminaryTransitionMeta = useMemo(() => {
    if (opts.phase !== "saleActive") {
      return undefined;
    }
    return buildPodiumTransitionMeta({
      contractIndex: slot.contractIndex,
      timerData: timerData ?? undefined,
      chainNowSec: opts.chainNowSec,
      currentEpoch,
      heroDisplay: true,
    });
  }, [currentEpoch, opts.chainNowSec, opts.phase, slot.contractIndex, timerData]);

  const latchedEpoch = usePodiumEpochLatch(
    preliminaryTransitionMeta?.transitionState ?? "syncing",
    currentEpoch,
  );
  const transitionMeta = useMemo(() => {
    if (opts.phase !== "saleActive") {
      return undefined;
    }
    return buildPodiumTransitionMeta({
      contractIndex: slot.contractIndex,
      timerData: timerData ?? undefined,
      chainNowSec: opts.chainNowSec,
      latchedEpoch,
      currentEpoch,
      heroDisplay: true,
    });
  }, [currentEpoch, latchedEpoch, opts.chainNowSec, opts.phase, slot.contractIndex, timerData]);

  const countdownSec =
    opts.phase !== "saleActive"
      ? opts.lastBuyCountdownSec
      : slot.contractIndex === 0 && opts.lastBuyCountdownSec !== undefined
        ? opts.lastBuyCountdownSec
        : transitionMeta?.countdownSec;

  const lockState = shouldShowPodiumFeatureLock({
    categoryIndex: slot.categoryIndex,
    requiredLevel: slot.requiredLevel,
    walletConnected: opts.walletConnected,
    viewerLevel,
    walletSurfaceUnlocked: opts.walletSurfaceUnlocked,
    walletStatsPending: opts.walletStatsPending,
  });
  const locked = lockState.locked;
  const lockedForConnection = lockState.lockedForConnection;

  const countdownPlaceholder =
    opts.phase === "saleActive" && transitionMeta?.transitionState === "unarmed"
      ? PODIUM_TIMER_AWAITING_FIRST_BUY
      : undefined;

  return {
    activeIndex,
    slot,
    title,
    countdownSec,
    countdownPlaceholder,
    transitionState: transitionMeta?.transitionState,
    transitionFoot: transitionMeta?.transitionFoot,
    transitionTestId: transitionMeta?.transitionTestId,
    showRollCta: transitionMeta?.showRollCta ?? false,
    locked,
    lockedForConnection,
    viewerLevel,
  };
}

export type { PodiumTransitionUxState };
