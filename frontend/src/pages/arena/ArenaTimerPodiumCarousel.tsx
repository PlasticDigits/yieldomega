// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { ArenaLastBuyPodiumLeaderboard } from "@/pages/arena/ArenaLastBuyPodiumLeaderboard";
import {
  TIMER_PODIUM_CAROUSEL_COUNT,
  TIMER_PODIUM_CAROUSEL_SLOTS,
  normalizeTimerPodiumSlideIndex,
} from "@/pages/arena/timerPodiumCarouselSlots";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";

function CarouselCaretIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
      {direction === "prev" ? (
        <path
          d="M10 3 5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M6 3l5 5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export type ArenaTimerPodiumCarouselSurface = "full" | "blur" | "chrome";

export type ArenaTimerPodiumCarouselProps = {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** Countdown hero and other panel chrome locked together with the active slide (#299). */
  panelHeader?: ReactNode;
  address?: string;
  decimals: number;
  podiumRows: readonly PodiumReadRow[];
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly import("@/lib/indexerApi").BuyItem[] | null;
  podiumNowUnixSec?: number;
  locked: boolean;
  lockedForConnection: boolean;
  requiredLevel: number;
  categoryIndex: number;
  onOpenWalletProfile?: (address: string) => void;
  /**
   * `blur` / `chrome` split the carousel for panel-level locks: blurred body vs
   * interactive carets/dots stacked in the same grid cell.
   */
  surface?: ArenaTimerPodiumCarouselSurface;
};

export function ArenaTimerPodiumCarousel({
  activeIndex,
  onActiveIndexChange,
  panelHeader,
  address,
  decimals,
  podiumRows,
  podiumPayoutPreview,
  recentBuys = null,
  podiumNowUnixSec,
  locked,
  lockedForConnection,
  requiredLevel,
  categoryIndex,
  onOpenWalletProfile,
  surface = "full",
}: ArenaTimerPodiumCarouselProps) {
  const normalizedIndex = normalizeTimerPodiumSlideIndex(activeIndex);
  const podiumRow = podiumRows[categoryIndex];

  const goPrev = () => {
    onActiveIndexChange(normalizeTimerPodiumSlideIndex(normalizedIndex - 1));
  };

  const goNext = () => {
    onActiveIndexChange(normalizeTimerPodiumSlideIndex(normalizedIndex + 1));
  };

  const leaderboard = (
    <ArenaLastBuyPodiumLeaderboard
      categoryIndex={categoryIndex}
      address={address}
      decimals={decimals}
      podiumRow={podiumRow}
      podiumPayoutPreview={podiumPayoutPreview}
      recentBuys={recentBuys}
      podiumNowUnixSec={podiumNowUnixSec}
      onOpenWalletProfile={onOpenWalletProfile}
    />
  );

  const panelBody = (
    <div className="arena-simple__timer-podium-carousel-panel">
      {panelHeader}
      {leaderboard}
    </div>
  );

  const prevCaret = (
    <button
      type="button"
      className="arena-simple__timer-podium-carousel-caret"
      data-testid="arena-timer-podium-carousel-prev"
      aria-label="Previous podium"
      onClick={goPrev}
    >
      <CarouselCaretIcon direction="prev" />
    </button>
  );

  const nextCaret = (
    <button
      type="button"
      className="arena-simple__timer-podium-carousel-caret"
      data-testid="arena-timer-podium-carousel-next"
      aria-label="Next podium"
      onClick={goNext}
    >
      <CarouselCaretIcon direction="next" />
    </button>
  );

  const dots = (
    <div
      className="arena-simple__timer-podium-carousel-dots"
      role="tablist"
      aria-label="Podium categories"
    >
      {TIMER_PODIUM_CAROUSEL_SLOTS.map((slot, index) => {
        const isActive = index === normalizedIndex;
        return (
          <button
            key={slot.label}
            type="button"
            role="tab"
            className={[
              "arena-simple__timer-podium-carousel-dot",
              isActive ? "arena-simple__timer-podium-carousel-dot--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={slot.label}
            aria-selected={isActive}
            data-testid={`arena-timer-podium-carousel-dot-${index}`}
            onClick={() => onActiveIndexChange(index)}
          />
        );
      })}
    </div>
  );

  const stageContent =
    locked && surface === "full" ? (
      <LockedUntilLevel
        requiredLevel={requiredLevel}
        className="arena-simple__timer-podium-carousel-lock"
        overlayTestId={`arena-timer-podium-lock-${categoryIndex}`}
        title={lockedForConnection ? "Connect wallet" : undefined}
        detail={
          lockedForConnection
            ? "Connect wallet to buy CHARM."
            : "Buy CHARM to level up this wallet and activate this podium."
        }
      >
        {panelBody}
      </LockedUntilLevel>
    ) : (
      panelBody
    );

  const carouselRow =
    surface === "blur" ? (
      <div className="arena-simple__timer-podium-carousel-row">
        <span className="arena-simple__timer-podium-carousel-caret-gutter" aria-hidden="true" />
        <div className="arena-simple__timer-podium-carousel-stage">{stageContent}</div>
        <span className="arena-simple__timer-podium-carousel-caret-gutter" aria-hidden="true" />
      </div>
    ) : (
      <div className="arena-simple__timer-podium-carousel-row">
        {prevCaret}
        <div
          className={[
            "arena-simple__timer-podium-carousel-stage",
            surface === "chrome" ? "arena-simple__timer-podium-carousel-stage--chrome" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={surface === "chrome" ? true : undefined}
        >
          {surface === "chrome" ? (
            <div className="arena-simple__timer-podium-carousel-chrome-layout">{panelBody}</div>
          ) : (
            stageContent
          )}
        </div>
        {nextCaret}
      </div>
    );

  const carouselBody = (
    <div className="arena-simple__timer-podium-carousel-body">
      {carouselRow}
      {surface === "blur" ? (
        <div className="arena-simple__timer-podium-carousel-dots-rail" aria-hidden="true" />
      ) : (
        dots
      )}
    </div>
  );

  return (
    <div
      className={[
        "arena-simple__timer-podium-carousel",
        locked && surface === "full" ? "arena-simple__timer-podium-carousel--locked" : "",
        surface === "chrome" ? "arena-simple__timer-podium-carousel--chrome" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={surface === "chrome" ? undefined : "arena-timer-podium-carousel"}
      aria-roledescription="carousel"
      aria-label={`${TIMER_PODIUM_CAROUSEL_SLOTS[normalizedIndex]!.label} podium`}
    >
      {carouselBody}
    </div>
  );
}

export { TIMER_PODIUM_CAROUSEL_COUNT };
