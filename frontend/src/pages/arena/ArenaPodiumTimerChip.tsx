// SPDX-License-Identifier: AGPL-3.0-only

import { zeroAddress } from "viem";
import { PlayerIdentity } from "@/components/arena";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import {
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
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
  /** When set, chip is locked below this feature level (#299). Omit for always-unlocked (Last Buy). */
  feature?: ArenaFeatureKey;
  playerLevel?: bigint | number;
  address?: string;
  decimals: number;
  podiumRow: PodiumReadRow | undefined;
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly BuyItem[] | null;
  activeDefendedStreak?: bigint;
  podiumNowUnixSec?: number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
  onOpenWalletProfile?: (address: string) => void;
  /** When false, the hero timer owns the countdown (Last Buy bay). */
  showCountdown?: boolean;
  countdownRemainingSec?: number;
  className?: string;
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
  activeDefendedStreak,
  podiumNowUnixSec,
  onFeatureHelp,
  onOpenWalletProfile,
  showCountdown = true,
  countdownRemainingSec,
  className,
}: ArenaPodiumTimerChipProps) {
  const walletConnected = Boolean(address?.trim());
  const scoreNowUnixSec = usePodiumScoreClock(podiumNowUnixSec);
  const walletStatsQuery = useWalletStats(address);
  const walletHighestScores = walletStatsQuery.data?.highest_scores ?? null;

  const unlocked =
    feature === undefined ||
    (playerLevel !== undefined && isFeatureUnlocked(playerLevel, feature));
  const requiredLevel = feature !== undefined ? FEATURE_UNLOCK_LEVEL[feature] : 1;

  const viewerValueRaw = resolveViewerPodiumValueRaw(categoryIndex, podiumRow, address, {
    activeDefendedStreak,
    recentBuys,
    walletHighestScores,
  });
  const viewerScoreLine = formatViewerPodiumScoreLine(categoryIndex, viewerValueRaw, {
    nowUnixSec: scoreNowUnixSec,
    walletConnected,
  });
  const winners = podiumRow?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];

  const helpButton =
    onFeatureHelp && feature !== undefined ? (
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
        {showCountdown ? (
          <span className="arena-timer-chips__chip" data-testid={`arena-timer-chip-${contractIndex}`}>
            <span className="arena-timer-chips__label">{CHIP_COUNTDOWN_LABEL}</span>
            <span className="arena-timer-chips__value">
              {countdownRemainingSec !== undefined
                ? formatPodiumChipCountdown(countdownRemainingSec)
                : "—"}
            </span>
          </span>
        ) : (
          <span className="arena-timer-chips__chip arena-timer-chips__chip--hero-owned" aria-hidden="true" />
        )}
        <span className="arena-timer-chips__lock">
          {unlocked
            ? podiumRow?.epoch !== undefined
              ? `EPOCH ${podiumRow.epoch}`
              : "EPOCH —"
            : `L${requiredLevel}`}
        </span>
        {unlocked ? helpButton : null}
      </div>

      <div className="arena-timer-chips__body">
        <p
          className="arena-timer-chips__viewer-score muted"
          data-testid={`arena-timer-chip-score-${contractIndex}`}
        >
          Your score: <strong>{viewerScoreLine}</strong>
        </p>
        <ol className="arena-timer-chips__places" aria-label={`${podiumName} leaders`}>
          {PODIUM_PLACE_LABELS.map((placeLabel, placeIndex) => {
            const winner = winners[placeIndex] ?? ZERO_ADDR;
            const winnerReady = hasPodiumWinner(winner);
            const prizeRaw = podiumPayoutPreview?.[categoryIndex]?.places[placeIndex];
            const valueRaw = podiumRow?.values?.[placeIndex] ?? "0";
            const winnerBuySec = podiumRow?.winnerBuySec?.[placeIndex];
            return (
              <li
                key={`${contractIndex}-${placeIndex}`}
                className="arena-timer-chips__place"
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
                  onOpenProfile={onOpenWalletProfile}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );

  const gateClassName = [
    "arena-timer-chips__gate",
    unlocked ? "arena-timer-chips__gate--unlocked" : "arena-timer-chips__gate--locked",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!unlocked && feature !== undefined) {
    return (
      <LockedUntilLevel
        requiredLevel={requiredLevel}
        variant="compact"
        className={`${gateClassName} arena-timer-chips__gate--locked`}
        testId={`arena-timer-chip-gate-${contractIndex}`}
        overlayTestId={`arena-timer-chip-lock-${contractIndex}`}
      >
        {chipContents}
      </LockedUntilLevel>
    );
  }

  return (
    <div className={gateClassName} data-testid={`arena-timer-chip-gate-${contractIndex}`}>
      {chipContents}
    </div>
  );
}
