// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable react-refresh/only-export-components -- podium ranking helpers export hooks and layout constants */

import { useEffect, useState, type ReactNode } from "react";
import { isAddress, zeroAddress } from "viem";
import { PlayerIdentity } from "@/components/arena";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { BuyItem } from "@/lib/indexerApi";
import { formatSimplePodiumScoreLine } from "./arenaSimplePodiumScore";
import type { RankingRow } from "./arenaUi";
import type { PodiumPayoutPreview, PodiumReadRow } from "./usePodiumReads";

export const PODIUM_PLACE_LABELS = ["1st", "2nd", "3rd"] as const;

/** Podium stand layout: 2nd, 1st, 3rd left-to-right (1st tallest in center). */
export const PODIUM_STAND_VISUAL_ORDER = [1, 0, 2] as const;
const ZERO_ADDR = zeroAddress as `0x${string}`;

/** Onchain category index → UX podium row slot (Last Buy · WarBow · Defended · Time Booster). */
export const PODIUM_CONTRACT_TO_UX_CATEGORY: Record<number, number> = {
  1: 3,
  2: 2,
  3: 1,
};

export function usePodiumScoreClock(externalNowUnixSec: number | undefined): number {
  const [liveUnixSec, setLiveUnixSec] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLiveUnixSec(Math.floor(Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return liveUnixSec ?? externalNowUnixSec ?? Math.floor(Date.now() / 1000);
}

export function samePodiumAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function hasPodiumWinner(address: string | undefined): boolean {
  const raw = address?.trim();
  return Boolean(raw && isAddress(raw as `0x${string}`) && raw.toLowerCase() !== ZERO_ADDR);
}

export function rankingRowsForPodium(
  row: PodiumReadRow | undefined,
  categoryIndex: number,
  viewerAddress: string | undefined,
  podiumPayoutPreview: PodiumPayoutPreview | null | undefined,
  decimals: number,
  podiumNowUnixSec: number,
  recentBuys: readonly BuyItem[] | null | undefined,
  onOpenWalletProfile: ((address: string) => void) | undefined,
  opts?: { includeUsdPrize?: boolean },
): RankingRow[] {
  const includeUsdPrize = opts?.includeUsdPrize !== false;
  const winners = row?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const values = row?.values ?? ["0", "0", "0"];

  return PODIUM_PLACE_LABELS.map((placeLabel, placeIndex) => {
    const winner = winners[placeIndex] ?? ZERO_ADDR;
    const winnerReady = hasPodiumWinner(winner);
    const prizeRaw = podiumPayoutPreview?.[categoryIndex]?.places[placeIndex];
    const prizeLabel =
      prizeRaw !== undefined ? (
        formatCompactFromRaw(prizeRaw, decimals, { sigfigs: 3 })
      ) : podiumPayoutPreview === null ? (
        <span className="muted">Prizes unavailable</span>
      ) : (
        <EmptyDataPlaceholder>Prizes loading</EmptyDataPlaceholder>
      );
    const usdLabel =
      includeUsdPrize && prizeRaw !== undefined
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
            winnerBuySec: row?.winnerBuySec?.[placeIndex],
            recentBuys,
          })}
        </span>
      ),
      highlight: winnerReady && samePodiumAddress(winner, viewerAddress),
    };
  });
}

export function compactPodiumScoreNode(
  categoryIndex: number,
  placeIndex: number,
  opts: {
    winner: string;
    winnerReady: boolean;
    valueRaw: string;
    nowUnixSec: number;
    winnerBuySec?: string | null;
    recentBuys?: readonly BuyItem[] | null;
    placeLabel: string;
  },
): ReactNode {
  const scoreLine = formatSimplePodiumScoreLine(categoryIndex, placeIndex, {
    winner: opts.winner,
    winnerReady: opts.winnerReady,
    valueRaw: opts.valueRaw,
    nowUnixSec: opts.nowUnixSec,
    winnerBuySec: opts.winnerBuySec,
    recentBuys: opts.recentBuys,
    compact: true,
  });

  return (
    <span className="arena-timer-chips__place-score muted" aria-label={`${opts.placeLabel} score`}>
      {scoreLine}
    </span>
  );
}

export function compactPodiumPrizeNode(
  prizeRaw: string | undefined,
  podiumPayoutPreview: PodiumPayoutPreview | null | undefined,
  decimals: number,
  placeLabel: string,
): ReactNode {
  const prizeLabel =
    prizeRaw !== undefined ? (
      formatCompactFromRaw(prizeRaw, decimals, { sigfigs: 3 })
    ) : podiumPayoutPreview === null ? (
      <span className="muted">—</span>
    ) : (
      <EmptyDataPlaceholder>…</EmptyDataPlaceholder>
    );

  return (
    <span className="arena-timer-chips__place-prize">
      <span
        className="arena-timer-chips__place-prize-amount"
        aria-label={`${placeLabel} prize amount`}
      >
        {prizeLabel}
      </span>
      <span className="arena-timer-chips__place-prize-unit" aria-hidden="true">
        DOUB
      </span>
    </span>
  );
}
