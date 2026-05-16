// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAddress, zeroAddress } from "viem";
import { AddressInline } from "@/components/AddressInline";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { BuyItem } from "@/lib/indexerApi";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import type { PodiumReadRow } from "./usePodiumReads";
import { formatSimplePodiumScoreLine } from "./timeCurveSimplePodiumScore";
import { PodiumRankingList, type RankingRow } from "./timecurveUi";

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
  "/art/icons/timecurve-podium-last-buy.png",
  "/art/icons/timecurve-podium-warbow.png",
  "/art/icons/timecurve-podium-defended-streak.png",
  "/art/icons/timecurve-podium-time-booster.png",
] as const;

const SIMPLE_PODIUM_TONE_CLASS = [
  "timecurve-simple__podium-card--last-buy",
  "timecurve-simple__podium-card--warbow",
  "timecurve-simple__podium-card--defended",
  "timecurve-simple__podium-card--booster",
] as const;

export type TimeCurveSimplePodiumSectionProps = {
  podiumRows: PodiumReadRow[];
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
  podiumPayoutPreview: TimeCurveSimplePodiumSectionProps["podiumPayoutPreview"],
  decimals: number,
  podiumNowUnixSec: number,
  recentBuys: TimeCurveSimplePodiumSectionProps["recentBuys"],
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
        <EmptyDataPlaceholder>Prize not projected yet</EmptyDataPlaceholder>
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
      key: `simple-podium-${categoryIndex}-${placeIndex}-${winner}`,
      rank: placeIndex + 1,
      label: (
        <AddressInline
          address={winner}
          tailHexDigits={6}
          fallback="—"
          size={18}
          className="timecurve-simple__podium-address"
        />
      ),
      value: (
        <span className="timecurve-simple__podium-prize" aria-label={`${placeLabel} prize`}>
          <span className="timecurve-simple__podium-prize-main">
            <span>{prizeLabel}</span>
            <small>CL8Y</small>
          </span>
          {usdLabel !== undefined && (
            <span
              className="timecurve-simple__podium-prize-usd"
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

function usePodiumBurstNonce(winnersSig: string): number {
  const prev = useRef("");
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current && prev.current !== winnersSig) {
      setN((c) => c + 1);
    }
    prev.current = winnersSig;
  }, [winnersSig]);
  return n;
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
}: {
  label: string;
  categoryIndex: number;
  help: ReactNode;
  artSrc: string;
  toneClass: string;
  row: PodiumReadRow | undefined;
  address: string | undefined;
  podiumPayoutPreview: TimeCurveSimplePodiumSectionProps["podiumPayoutPreview"];
  decimals: number;
  podiumNowUnixSec: number;
  recentBuys: TimeCurveSimplePodiumSectionProps["recentBuys"];
}) {
  const winnersSig = row?.winners.join(":") ?? "";
  const burstNonce = usePodiumBurstNonce(winnersSig);
  const rankingRows = rankingRowsForPodium(
    row,
    categoryIndex,
    address,
    podiumPayoutPreview,
    decimals,
    podiumNowUnixSec,
    recentBuys,
  );

  return (
    <div className={["podium-block", "timecurve-simple__podium-card", toneClass].join(" ")}>
      <div className="timecurve-simple__podium-card-head">
        <span className="timecurve-simple__podium-art" aria-hidden="true">
          <img src={artSrc} alt="" width={140} height={140} loading="lazy" decoding="async" />
        </span>
        <div>
          <h3>{label}</h3>
          <p className="muted">{help}</p>
        </div>
      </div>
      <PodiumRankingList
        rows={rankingRows}
        emptyText="No onchain winners yet."
        burstNonce={burstNonce}
      />
    </div>
  );
}

export function TimeCurveSimplePodiumSection({
  podiumRows,
  podiumLoading,
  podiumPayoutPreview,
  decimals,
  address,
  podiumNowUnixSec,
  recentBuys = null,
}: TimeCurveSimplePodiumSectionProps) {
  const scoreNowUnixSec = usePodiumScoreClock(podiumNowUnixSec);

  return (
    <PageSection
      className="timecurve-simple__podium-panel"
      dataTestId="timecurve-simple-podiums"
      badgeLabel="Prize podiums"
      badgeTone="warning"
      spotlight
      cutout={{
        src: "/art/cutouts/bunny-podium-win.png",
        width: 156,
        height: 223,
        className: "panel-cutout panel-cutout--simple-podium cutout-decoration--float",
      }}
    >
      {podiumLoading && (
        <StatusMessage variant="loading">Loading the four onchain podium categories…</StatusMessage>
      )}
      <div className="podium-preview timecurve-simple__podium-grid">
        {PODIUM_LABELS.map((label, categoryIndex) => (
          <SimplePodiumCard
            key={label}
            label={label}
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
          />
        ))}
      </div>
    </PageSection>
  );
}
