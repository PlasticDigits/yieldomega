// SPDX-License-Identifier: AGPL-3.0-only

import { zeroAddress } from "viem";
import { PlayerIdentity } from "@/components/arena";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { isArenaLastBuyWalletSurfaceUnlocked } from "@/lib/arenaPageHelpers";
import {
  clampPlayerLevel,
  FEATURE_UNLOCK_LEVEL,
  shouldShowLevelLock,
  type ArenaFeatureKey,
} from "@/lib/arenaProgression";
import type { BuyItem } from "@/lib/indexerApi";
import { useWalletStats } from "@/hooks/useWalletStats";
import { phaseNarrative } from "@/pages/arena/arenaSimplePhase";
import {
  formatViewerPodiumScoreLine,
  resolveViewerPodiumValueRaw,
} from "@/pages/arena/arenaSimplePodiumScore";
import {
  compactPodiumPrizeNode,
  compactPodiumScoreNode,
  hasPodiumWinner,
  PODIUM_PLACE_LABELS,
  samePodiumAddress,
  usePodiumScoreClock,
} from "@/pages/arena/arenaSimplePodiumRanking";
import { formatPodiumChipCountdown } from "@/pages/arena/formatTimer";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";

const CHIP_COUNTDOWN_LABEL = phaseNarrative("saleActive");
const ZERO_ADDR = zeroAddress as `0x${string}`;

export type ArenaPodiumTimerChipProps = {
  podiumName: string;
  contractIndex: number;
  categoryIndex: number;
  /** When set, chip is locked below this feature level (#299). */
  feature?: ArenaFeatureKey;
  playerLevel?: bigint | number;
  address?: string;
  decimals: number;
  podiumRow: PodiumReadRow | undefined;
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly BuyItem[] | null;
  /** All UX podium rows — used to detect arena activity for Last Buy lock. */
  podiumRows?: readonly PodiumReadRow[] | null;
  activeDefendedStreak?: bigint;
  podiumNowUnixSec?: number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
  onOpenWalletProfile?: (address: string) => void;
  /** When false, the hero timer owns the countdown (Last Buy bay). */
  showCountdown?: boolean;
  /** When false, timer bay owns the feature tutorial trigger (Last Buy bay). */
  showFeatureHelp?: boolean;
  countdownRemainingSec?: number;
  /** Override chip countdown copy (e.g. BUY TO START). */
  countdownDisplay?: string;
  /** E2E hook when timer is expired/settling ([#343](https://gitlab.com/PlasticDigits/yieldomega/-/issues/343)). */
  transitionTestId?: string;
  className?: string;
  testId?: string;
  ariaLabel?: string;
};

export function ArenaPodiumTimerChip({
  podiumName,
  contractIndex,
  categoryIndex,
  feature,
  playerLevel,
  address,
  decimals,
  podiumRow,
  podiumPayoutPreview,
  recentBuys = null,
  podiumRows = null,
  activeDefendedStreak,
  podiumNowUnixSec,
  onFeatureHelp,
  onOpenWalletProfile,
  showCountdown = true,
  showFeatureHelp = true,
  countdownRemainingSec,
  countdownDisplay,
  transitionTestId,
  className,
  testId,
  ariaLabel,
}: ArenaPodiumTimerChipProps) {
  const walletConnected = Boolean(address?.trim());
  const scoreNowUnixSec = usePodiumScoreClock(podiumNowUnixSec);
  const walletStatsQuery = useWalletStats(address);
  const walletHighestScores = walletStatsQuery.data?.highest_scores ?? null;
  const walletCurrentScores = walletStatsQuery.data?.current_scores ?? null;
  const walletStats = walletStatsQuery.data;
  const walletStatsPending =
    Boolean(address?.trim()) &&
    (walletStatsQuery.isLoading || walletStatsQuery.isFetching) &&
    !walletStats;

  const lastBuyWalletUnlocked = isArenaLastBuyWalletSurfaceUnlocked({
    walletConnected,
    walletStats,
    arenaUsers: { recentBuys, podiumRows },
  });

  const requiredLevel = feature !== undefined ? FEATURE_UNLOCK_LEVEL[feature] : 1;
  /** Side-rail only: Last Buy chip locks until connect + indexed buy (hero carousel stays open). */
  const walletSurfaceLocked =
    !walletConnected || walletStatsPending || !lastBuyWalletUnlocked;
  const lastBuyChipLocked = feature === "last_buy" && walletSurfaceLocked;
  const sideRailLocked = feature !== "last_buy" && walletSurfaceLocked;
  const viewerLevel =
    walletConnected && playerLevel !== undefined ? clampPlayerLevel(playerLevel) : undefined;
  const showProgressionLock =
    feature !== undefined &&
    feature !== "last_buy" &&
    !sideRailLocked &&
    shouldShowLevelLock(viewerLevel, requiredLevel);
  const chipLocked = lastBuyChipLocked || sideRailLocked || showProgressionLock;
  const chipVisuallyUnlocked = !chipLocked;

  const viewerValueRaw = resolveViewerPodiumValueRaw(categoryIndex, podiumRow, address, {
    activeDefendedStreak,
    recentBuys,
    walletHighestScores,
    walletCurrentScores,
  });
  const winners = podiumRow?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const viewerIsPlacing = winners.some(
    (winner) => hasPodiumWinner(winner) && samePodiumAddress(winner, address),
  );
  const showViewerStandingRow = walletConnected && Boolean(address?.trim()) && !viewerIsPlacing;
  const viewerScoreLine = formatViewerPodiumScoreLine(categoryIndex, viewerValueRaw, {
    nowUnixSec: scoreNowUnixSec,
    walletConnected,
    compact: true,
  });

  const helpButton =
    showFeatureHelp && onFeatureHelp && feature !== undefined ? (
      <button
        type="button"
        className="arena-timer-chips__help"
        aria-label={`Open ${podiumName} tutorial`}
        onClick={() => onFeatureHelp(feature)}
      >
        ?
      </button>
    ) : null;

  const chipContents = (
    <>
      <p
        className="arena-timer-chips__title"
        data-testid={`arena-timer-chip-title-${contractIndex}`}
      >
        {podiumName}
      </p>
      <div className="arena-timer-chips__head">
        <span className="arena-timer-chips__lock">
          {chipVisuallyUnlocked
            ? podiumRow?.epoch !== undefined
              ? `EPOCH ${podiumRow.epoch}`
              : "EPOCH —"
            : `L${requiredLevel}`}
        </span>
        <div className="arena-timer-chips__aside">
          {showCountdown ? (
            <span
              className="arena-timer-chips__chip"
              data-testid={transitionTestId ?? `arena-timer-chip-${contractIndex}`}
            >
              <span className="arena-timer-chips__label">{CHIP_COUNTDOWN_LABEL}</span>
              <span className="arena-timer-chips__value">
                {countdownDisplay !== undefined
                  ? countdownDisplay
                  : countdownRemainingSec !== undefined
                    ? formatPodiumChipCountdown(countdownRemainingSec)
                    : "—"}
              </span>
            </span>
          ) : (
            <span className="arena-timer-chips__chip arena-timer-chips__chip--hero-owned" aria-hidden="true" />
          )}
          {chipVisuallyUnlocked ? helpButton : null}
        </div>
      </div>

      <div className="arena-timer-chips__body">
        <ol className="arena-timer-chips__places" aria-label={`${podiumName} leaders`}>
          {PODIUM_PLACE_LABELS.map((placeLabel, placeIndex) => {
            const winner = winners[placeIndex] ?? ZERO_ADDR;
            const winnerReady = hasPodiumWinner(winner);
            const prizeRaw = podiumPayoutPreview?.[contractIndex]?.places[placeIndex];
            const valueRaw = podiumRow?.values?.[placeIndex] ?? "0";
            const winnerBuySec = podiumRow?.winnerBuySec?.[placeIndex];
            const isViewer = winnerReady && samePodiumAddress(winner, address);
            return (
              <li
                key={`${contractIndex}-${placeIndex}`}
                className={[
                  "arena-timer-chips__place",
                  isViewer ? "arena-timer-chips__place--you" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid={`arena-timer-chip-place-${contractIndex}-${placeIndex + 1}`}
              >
                <span className="arena-timer-chips__place-rank">{placeLabel}</span>
                {compactPodiumPrizeNode(prizeRaw, podiumPayoutPreview, decimals, placeLabel)}
                {compactPodiumScoreNode(categoryIndex, placeIndex, {
                  winner,
                  winnerReady,
                  valueRaw,
                  nowUnixSec: scoreNowUnixSec,
                  winnerBuySec,
                  recentBuys,
                  placeLabel,
                })}
                <PlayerIdentity
                  address={winner}
                  tailHexDigits={6}
                  size={14}
                  className="arena-timer-chips__place-identity"
                  labelClassName={
                    isViewer ? "arena-timer-chips__place-identity-label--you" : undefined
                  }
                  onOpenProfile={onOpenWalletProfile}
                />
              </li>
            );
          })}
          {showViewerStandingRow ? (
            <li
              key={`${contractIndex}-viewer`}
              className="arena-timer-chips__place arena-timer-chips__place--you"
              data-testid={`arena-timer-chip-viewer-${contractIndex}`}
            >
              <span className="arena-timer-chips__place-rank">YOU</span>
              <span className="arena-timer-chips__place-prize">
                <span className="arena-timer-chips__place-prize-amount muted" aria-hidden="true">
                  —
                </span>
              </span>
              <span
                className="arena-timer-chips__place-score muted"
                aria-label="Your score"
                data-testid={`arena-timer-chip-score-${contractIndex}`}
              >
                {viewerScoreLine}
              </span>
              <PlayerIdentity
                address={address!}
                tailHexDigits={6}
                size={14}
                className="arena-timer-chips__place-identity"
                labelClassName="arena-timer-chips__place-identity-label--you"
                onOpenProfile={onOpenWalletProfile}
              />
            </li>
          ) : null}
        </ol>
      </div>
    </>
  );

  const gateClassName = [
    "arena-timer-chips__gate",
    chipVisuallyUnlocked ? "arena-timer-chips__gate--unlocked" : "arena-timer-chips__gate--locked",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const gateTestId = testId ?? `arena-timer-chip-gate-${contractIndex}`;

  if (chipLocked && feature !== undefined) {
    const lockTitle =
      feature === "last_buy" && !walletConnected ? "Connect wallet" : undefined;
    const lockDetail =
      feature === "last_buy" && !walletConnected
        ? "Connect wallet to buy CHARM."
        : undefined;
    return (
      <LockedUntilLevel
        requiredLevel={requiredLevel}
        variant="compact"
        className={`${gateClassName} arena-timer-chips__gate--locked`}
        testId={gateTestId}
        overlayTestId={`arena-timer-chip-lock-${contractIndex}`}
        title={lockTitle}
        detail={lockDetail}
      >
        {chipContents}
      </LockedUntilLevel>
    );
  }

  return (
    <div className={gateClassName} data-testid={gateTestId} aria-label={ariaLabel}>
      {chipContents}
    </div>
  );
}
