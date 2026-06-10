// SPDX-License-Identifier: AGPL-3.0-only

import { zeroAddress } from "viem";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { BuyItem } from "@/lib/indexerApi";
import { PODIUM_RANK_TROPHY_SRC } from "@/pages/arena/arenaUi";
import { formatSimplePodiumScoreLine } from "@/pages/arena/arenaSimplePodiumScore";
import {
  hasPodiumWinner,
  PODIUM_PLACE_LABELS,
  PODIUM_STAND_VISUAL_ORDER,
  rankingRowsForPodium,
  samePodiumAddress,
  usePodiumScoreClock,
} from "@/pages/arena/arenaSimplePodiumRanking";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";
import { useLastBuyHeadShakeNonce } from "@/pages/arena/useLastBuyHeadShakeNonce";

const ZERO_ADDR = zeroAddress as `0x${string}`;

export type ArenaLastBuyPodiumLeaderboardProps = {
  /** UX podium slot: 0 Last Buy · 1 WarBow · 2 Defended · 3 Time Booster. */
  categoryIndex?: number;
  address?: string;
  decimals: number;
  podiumRow: PodiumReadRow | undefined;
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly BuyItem[] | null;
  podiumNowUnixSec?: number;
  onOpenWalletProfile?: (address: string) => void;
};

export function ArenaLastBuyPodiumLeaderboard({
  categoryIndex = 0,
  address,
  decimals,
  podiumRow,
  podiumPayoutPreview,
  recentBuys = null,
  podiumNowUnixSec,
  onOpenWalletProfile,
}: ArenaLastBuyPodiumLeaderboardProps) {
  const firstPlaceShakeNonce = useLastBuyHeadShakeNonce(
    categoryIndex === 0 ? recentBuys : null,
  );
  const scoreNowUnixSec = usePodiumScoreClock(podiumNowUnixSec);
  const rankingRows = rankingRowsForPodium(
    podiumRow,
    categoryIndex,
    address,
    podiumPayoutPreview,
    decimals,
    scoreNowUnixSec,
    recentBuys,
    onOpenWalletProfile,
  );
  const winners = podiumRow?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const values = podiumRow?.values ?? ["0", "0", "0"];
  const winnerBuySec = podiumRow?.winnerBuySec;

  return (
    <div
      className="arena-simple__last-buy-podiums"
      data-testid="arena-last-buy-podium-leaderboard"
      data-podium-category={categoryIndex}
      aria-label={`Podium ${categoryIndex + 1} standings`}
    >
      {PODIUM_STAND_VISUAL_ORDER.map((placeIndex) => {
        const placeLabel = PODIUM_PLACE_LABELS[placeIndex]!;
        const rank = placeIndex + 1;
        const winner = winners[placeIndex] ?? ZERO_ADDR;
        const winnerReady = hasPodiumWinner(winner);
        const row = rankingRows[placeIndex]!;
        const prizeRaw = podiumPayoutPreview?.[categoryIndex]?.places[placeIndex];
        const prizeLabel =
          prizeRaw !== undefined ? (
            formatCompactFromRaw(prizeRaw, decimals, { sigfigs: 3 })
          ) : podiumPayoutPreview === null ? (
            <span className="muted">—</span>
          ) : (
            <EmptyDataPlaceholder>…</EmptyDataPlaceholder>
          );
        const usdLabel =
          prizeRaw !== undefined
            ? formatCompactFromRaw(
                fallbackPayTokenWeiForCl8y(rawToBigIntForFormat(prizeRaw), "usdm"),
                18,
                { sigfigs: 3 },
              )
            : undefined;
        const scoreLine = formatSimplePodiumScoreLine(categoryIndex, placeIndex, {
          winner,
          winnerReady,
          valueRaw: values[placeIndex] ?? "0",
          nowUnixSec: scoreNowUnixSec,
          winnerBuySec: winnerBuySec?.[placeIndex],
          recentBuys,
        });
        const isViewer = winnerReady && samePodiumAddress(winner, address);
        const standClass = [
          "arena-simple__last-buy-podium",
          rank === 1 ? "arena-simple__last-buy-podium--first" : "",
          rank === 2 ? "arena-simple__last-buy-podium--second" : "",
          rank === 3 ? "arena-simple__last-buy-podium--third" : "",
          isViewer ? "arena-simple__last-buy-podium--you" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <article
            key={placeLabel}
            className={standClass}
            data-testid={`arena-last-buy-podium-${rank}`}
            aria-label={`${placeLabel} place`}
          >
            <div className="arena-simple__last-buy-podium-inner">
            <span className="arena-simple__last-buy-podium-rank" aria-label={`Rank ${rank}`}>
              <img
                key={rank === 1 ? `first-trophy-${firstPlaceShakeNonce}` : `trophy-${rank}`}
                className={
                  rank === 1 && firstPlaceShakeNonce > 0
                    ? "arena-simple__last-buy-podium-rank-icon--shake"
                    : undefined
                }
                src={PODIUM_RANK_TROPHY_SRC[placeIndex] ?? PODIUM_RANK_TROPHY_SRC[2]}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
              />
              <span className="visually-hidden">{rank}</span>
            </span>
            <div className="arena-simple__last-buy-podium-prize" aria-label={`${placeLabel} prize`}>
              <span className="arena-simple__last-buy-podium-prize-main">
                <span>{prizeLabel}</span>
                <small>DOUB</small>
              </span>
              {usdLabel !== undefined && (
                <span
                  className="arena-simple__last-buy-podium-prize-usd"
                  title={SIMPLE_PODIUM_USD_EQUIV_TITLE}
                >
                  {`≈$${usdLabel} USD`}
                </span>
              )}
            </div>
            <span className="arena-simple__last-buy-podium-age muted" aria-label="Time since last buy">
              {scoreLine}
            </span>
            <div className="arena-simple__last-buy-podium-identity">{row.label}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
