// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAddress, zeroAddress } from "viem";
import { PlayerIdentity } from "@/components/arena";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { clampPlayerLevel } from "@/lib/arenaProgression";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { BuyItem } from "@/lib/indexerApi";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import type { PodiumReadRow } from "./usePodiumReads";
import { formatSimplePodiumScoreLine } from "./arenaSimplePodiumScore";
import { PodiumRankingList, type RankingRow } from "./arenaUi";

const PODIUM_PLACE_LABELS = ["1st", "2nd", "3rd"] as const;
const ZERO_ADDR = zeroAddress as `0x${string}`;

/**
 * Drives per-second score text (e.g. Last Buy “seconds ago”) without relying on the parent
 * page to re-render on the same cadence.
 */
function usePodiumScoreClock(externalNowUnixSec: number | undefined): number {
  const [liveUnixSec, setLiveUnixSec] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLiveUnixSec(Math.floor(Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return liveUnixSec ?? externalNowUnixSec ?? Math.floor(Date.now() / 1000);
}

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
  podiumPayoutPreview?: readonly { places: readonly [string, string, string] }[];
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

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function hasWinner(address: string | undefined): boolean {
  const raw = address?.trim();
  return Boolean(raw && isAddress(raw as `0x${string}`) && raw.toLowerCase() !== ZERO_ADDR);
}

function rankingRowsForPodium(
  row: PodiumReadRow | undefined,
  categoryIndex: number,
  viewerAddress: string | undefined,
  podiumPayoutPreview: ArenaSimplePodiumSectionProps["podiumPayoutPreview"],
  decimals: number,
  podiumNowUnixSec: number,
  recentBuys: ArenaSimplePodiumSectionProps["recentBuys"],
  onOpenWalletProfile: ArenaSimplePodiumSectionProps["onOpenWalletProfile"],
): RankingRow[] {
  const winners = row?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const values = row?.values ?? ["0", "0", "0"];

  return PODIUM_PLACE_LABELS.map((placeLabel, placeIndex) => {
    const winner = winners[placeIndex] ?? ZERO_ADDR;
    const winnerReady = hasWinner(winner);
    const prizeRaw = podiumPayoutPreview?.[categoryIndex]?.places[placeIndex];
    const prizeLabel =
      prizeRaw !== undefined ? (
        formatCompactFromRaw(prizeRaw, decimals, { sigfigs: 3 })
      ) : (
        <EmptyDataPlaceholder>Prizes loading</EmptyDataPlaceholder>
      );
    const usdLabel =
      prizeRaw !== undefined
        ? formatCompactFromRaw(
            fallbackPayTokenWeiForCl8y(rawToBigIntForFormat(prizeRaw), "usdm"),
            18,
            { sigfigs: 3 },
          )
        : undefined;

    return {
      key: `simple-podium-${categoryIndex}-${placeIndex}`,
      rank: placeIndex + 1,
      label: (
        <PlayerIdentity
          address={winner}
          tailHexDigits={6}
          size={18}
          className="arena-simple__podium-address"
          onOpenProfile={onOpenWalletProfile}
        />
      ),
      value: (
        <span
          className="arena-simple__podium-prize yga-podium-prize"
          aria-label={`${placeLabel} prize`}
        >
          <span className="arena-simple__podium-prize-main">
            <span>{prizeLabel}</span>
            <small>DOUB</small>
          </span>
          {usdLabel !== undefined && (
            <span
              className="arena-simple__podium-prize-usd"
              title={SIMPLE_PODIUM_USD_EQUIV_TITLE}
            >
              ≈ ${usdLabel} USD
            </span>
          )}
        </span>
      ),
      meta: (
        <span className="muted">
          {formatSimplePodiumScoreLine(categoryIndex, placeIndex, {
            winner,
            winnerReady,
            valueRaw: values[placeIndex] ?? "0",
            nowUnixSec: podiumNowUnixSec,
            recentBuys,
          })}
        </span>
      ),
      highlight: winnerReady && sameAddress(winner, viewerAddress),
    };
  });
}

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
  const locked = viewerLevel !== undefined && viewerLevel < requiredLevel;

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
        detail="Buy CHARM to level up this wallet and activate this podium."
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
  const viewerLevel = address ? clampPlayerLevel(playerLevel ?? 1) : undefined;

  return (
    <PageSection
      className="arena-simple__podium-panel"
      dataTestId="arena-simple-podiums"
      badgeLabel="Prize podiums"
      badgeTone="warning"
      spotlight
    >
      {podiumLoading && (
        <StatusMessage variant="loading">Loading the four onchain podium categories…</StatusMessage>
      )}
      <div className="podium-preview arena-simple__podium-grid">
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
            viewerLevel={viewerLevel}
            requiredLevel={SIMPLE_PODIUM_REQUIRED_LEVEL[categoryIndex]}
            onOpenWalletProfile={onOpenWalletProfile}
          />
        ))}
      </div>
    </PageSection>
  );
}
