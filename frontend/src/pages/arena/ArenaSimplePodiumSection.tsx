// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type ReactNode } from "react";
import { zeroAddress } from "viem";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { clampPlayerLevel } from "@/lib/arenaProgression";
import type { BuyItem } from "@/lib/indexerApi";
import { rankingRowsForPodium, usePodiumScoreClock } from "./arenaSimplePodiumRanking";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import type { PodiumPayoutPreview, PodiumReadRow } from "./usePodiumReads";
import { PodiumRankingList } from "./arenaUi";

const ZERO_ADDR = zeroAddress as `0x${string}`;

const SIMPLE_PODIUM_ART = [
  "/art/icons/arena-podium-last-buy.png?v=glass2",
  "/art/icons/arena-podium-warbow.png?v=glass2",
  "/art/icons/arena-podium-defended-streak.png?v=glass2",
  "/art/icons/arena-podium-time-booster.png?v=glass2",
] as const;

const SIMPLE_PODIUM_TONE_CLASS = [
  "arena-simple__podium-card--last-buy",
  "arena-simple__podium-card--warbow",
  "arena-simple__podium-card--defended",
  "arena-simple__podium-card--booster",
] as const;

/** UX slot indices in player unlock order (L1 → L4). */
const SIMPLE_PODIUM_DISPLAY_ORDER = [0, 3, 2, 1] as const;

const SIMPLE_PODIUM_REQUIRED_LEVEL = [1, 4, 3, 2] as const;

export type ArenaSimplePodiumSectionProps = {
  podiumRows: readonly PodiumReadRow[];
  podiumLoading: boolean;
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  decimals: number;
  address: string | undefined;
  /** Newest-first buy head (same order as indexer last-buy prediction); used only for Last Buy score ages. */
  recentBuys?: BuyItem[] | null;
  /**
   * Optional wall-clock unix seconds from the parent (e.g. Simple `tickerWallNowSec`) for the
   * first paint / SSR. On the client, the podium runs its own 1s clock so score lines still tick
   * even if the parent does not re-render every second.
   */
  podiumNowUnixSec?: number;
  /** Connected wallet Arena level; gates secondary podium surfaces (#299). */
  playerLevel?: bigint | number;
  /** Opens wallet profile modal on participant address click (#258). */
  onOpenWalletProfile?: (address: string) => void;
};

function useChangedRankBurst(winnersSig: string): { rank: number; nonce: number } | undefined {
  const previousWinners = useRef<readonly string[] | null>(null);
  const [burst, setBurst] = useState<{ rank: number; nonce: number }>();

  useEffect(() => {
    const current = winnersSig.split(":").map((winner) => winner.toLowerCase());
    const previous = previousWinners.current;
    if (previous) {
      const changedIndex = current.findIndex((winner, index) => winner !== previous[index]);
      if (changedIndex !== -1) {
        setBurst((prevBurst) => ({
          rank: changedIndex + 1,
          nonce: (prevBurst?.nonce ?? 0) + 1,
        }));
      }
    }
    previousWinners.current = current;
  }, [winnersSig]);

  return burst;
}

function SimplePodiumCard({
  label,
  categoryIndex,
  help,
  artSrc,
  toneClass,
  row,
  address,
  podiumPayoutPreview,
  decimals,
  podiumNowUnixSec,
  recentBuys,
  walletConnected,
  viewerLevel,
  requiredLevel,
  onOpenWalletProfile,
}: {
  label: string;
  categoryIndex: number;
  help: ReactNode;
  artSrc: string;
  toneClass: string;
  row: PodiumReadRow | undefined;
  address: string | undefined;
  podiumPayoutPreview: ArenaSimplePodiumSectionProps["podiumPayoutPreview"];
  decimals: number;
  podiumNowUnixSec: number;
  recentBuys: ArenaSimplePodiumSectionProps["recentBuys"];
  walletConnected: boolean;
  viewerLevel: number | undefined;
  requiredLevel: number;
  onOpenWalletProfile: ArenaSimplePodiumSectionProps["onOpenWalletProfile"];
}) {
  const winners = row?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const winnersSig = winners.join(":");
  const rankBurst = useChangedRankBurst(winnersSig);
  const rankingRows = rankingRowsForPodium(
    row,
    categoryIndex,
    address,
    podiumPayoutPreview,
    decimals,
    podiumNowUnixSec,
    recentBuys,
    onOpenWalletProfile,
  );
  const locked =
    categoryIndex !== 0 &&
    (!walletConnected || (viewerLevel !== undefined && viewerLevel < requiredLevel));
  const lockedForConnection = locked && !walletConnected;

  const cardClassName = [
    "podium-block",
    "arena-simple__podium-card",
    "glass-panel",
    "glass-panel--gold",
    locked ? "arena-simple__podium-card--locked" : "",
    toneClass,
  ]
    .filter(Boolean)
    .join(" ");
  const cardContents = (
    <>
      <div className="arena-simple__podium-card-head">
        <span className="arena-simple__podium-art" aria-hidden="true">
          <img src={artSrc} alt="" width={140} height={140} loading="lazy" decoding="async" />
        </span>
        <div>
          <h3>{label}</h3>
          {row?.epoch !== undefined && (
            <p className="muted arena-simple__podium-epoch" data-testid={`arena-podium-epoch-${categoryIndex}`}>
              Epoch <strong>{row.epoch}</strong>
            </p>
          )}
          <p className="muted">{help}</p>
        </div>
      </div>
      <PodiumRankingList
        rows={rankingRows}
        emptyText="No onchain winners yet."
        rankBurst={rankBurst}
      />
    </>
  );

  if (locked) {
    return (
      <LockedUntilLevel
        requiredLevel={requiredLevel}
        className={cardClassName}
        overlayTestId={`arena-podium-lock-${categoryIndex}`}
        title={lockedForConnection ? "Connect wallet" : undefined}
        detail={
          lockedForConnection
            ? "Connect wallet to buy CHARM."
            : "Buy CHARM to level up this wallet and activate this podium."
        }
      >
        {cardContents}
      </LockedUntilLevel>
    );
  }

  return <div className={cardClassName}>{cardContents}</div>;
}

export function ArenaSimplePodiumSection({
  podiumRows,
  podiumLoading,
  podiumPayoutPreview,
  decimals,
  address,
  podiumNowUnixSec,
  playerLevel,
  recentBuys = null,
  onOpenWalletProfile,
}: ArenaSimplePodiumSectionProps) {
  const scoreNowUnixSec = usePodiumScoreClock(podiumNowUnixSec);
  const walletConnected = Boolean(address);
  const viewerLevel = walletConnected ? clampPlayerLevel(playerLevel ?? 1) : undefined;

  return (
    <>
      {podiumLoading && (
        <StatusMessage variant="loading">Loading the four onchain podium categories…</StatusMessage>
      )}
      <div
        className="podium-preview arena-simple__podium-grid"
        data-testid="arena-simple-podiums"
      >
        {SIMPLE_PODIUM_DISPLAY_ORDER.map((categoryIndex) => (
          <SimplePodiumCard
            key={PODIUM_LABELS[categoryIndex]}
            label={PODIUM_LABELS[categoryIndex]}
            categoryIndex={categoryIndex}
            help={PODIUM_HELP[categoryIndex]}
            artSrc={SIMPLE_PODIUM_ART[categoryIndex]}
            toneClass={SIMPLE_PODIUM_TONE_CLASS[categoryIndex]}
            row={podiumRows[categoryIndex]}
            address={address}
            podiumPayoutPreview={podiumPayoutPreview}
            decimals={decimals}
            podiumNowUnixSec={scoreNowUnixSec}
            recentBuys={recentBuys}
            walletConnected={walletConnected}
            viewerLevel={viewerLevel}
            requiredLevel={SIMPLE_PODIUM_REQUIRED_LEVEL[categoryIndex]}
            onOpenWalletProfile={onOpenWalletProfile}
          />
        ))}
      </div>
    </>
  );
}
