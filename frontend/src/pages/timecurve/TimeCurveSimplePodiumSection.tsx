// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import { isAddress, zeroAddress } from "viem";
import { AddressInline } from "@/components/AddressInline";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { SIMPLE_PODIUM_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import { useLastObservedAtForSerializedDep } from "@/lib/useLastObservedAtForSerializedDep";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import type { PodiumReadRow } from "./usePodiumReads";
import { PodiumRankingList, type RankingRow } from "./timecurveUi";

const PODIUM_PLACE_LABELS = ["1st", "2nd", "3rd"] as const;
const ZERO_ADDR = zeroAddress as `0x${string}`;

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
  podiumRefreshing?: boolean;
  podiumPayoutPreview?: readonly { places: readonly [string, string, string] }[];
  decimals: number;
  /** While the sale is live, Last Buy uses indexed buys as a running prediction (`GET /v1/timecurve/podiums`). */
  lastBuyPredictionActive?: boolean;
  address: string | undefined;
};

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function hasWinner(address: string | undefined): boolean {
  const raw = address?.trim();
  return Boolean(raw && isAddress(raw as `0x${string}`) && raw.toLowerCase() !== ZERO_ADDR);
}

function podiumPayoutPreviewSerialized(
  preview: TimeCurveSimplePodiumSectionProps["podiumPayoutPreview"] | undefined,
): string | undefined {
  if (!preview?.length) {
    return undefined;
  }
  return preview.map((row) => row.places.join(":")).join("|");
}

function rankingRowsForPodium(
  row: PodiumReadRow | undefined,
  categoryIndex: number,
  viewerAddress: string | undefined,
  podiumPayoutPreview: TimeCurveSimplePodiumSectionProps["podiumPayoutPreview"],
  decimals: number,
): RankingRow[] {
  const winners = row?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];

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
          fallback="Awaiting wallet"
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
}: {
  label: string;
  categoryIndex: number;
  help: string;
  artSrc: string;
  toneClass: string;
  row: PodiumReadRow | undefined;
  address: string | undefined;
  podiumPayoutPreview: TimeCurveSimplePodiumSectionProps["podiumPayoutPreview"];
  decimals: number;
}) {
  const winnersSig = row?.winners.join(":") ?? "";
  const burstNonce = usePodiumBurstNonce(winnersSig);
  const rankingRows = rankingRowsForPodium(
    row,
    categoryIndex,
    address,
    podiumPayoutPreview,
    decimals,
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
  podiumRefreshing = false,
  podiumPayoutPreview,
  decimals,
  lastBuyPredictionActive = false,
  address,
}: TimeCurveSimplePodiumSectionProps) {
  const previewSerialized = useMemo(
    () => podiumPayoutPreviewSerialized(podiumPayoutPreview),
    [podiumPayoutPreview],
  );
  const podiumPrizeCl8yObservedAtMs = useLastObservedAtForSerializedDep(previewSerialized);
  const podiumUsdFreshness = useRelativeFreshnessLabel(
    previewSerialized === undefined ? undefined : podiumPrizeCl8yObservedAtMs,
  );

  return (
    <PageSection
      title="Live reserve podiums"
      className="timecurve-simple__podium-panel"
      dataTestId="timecurve-simple-podiums"
      badgeLabel="Reserve podiums"
      badgeTone="warning"
      spotlight
      cutout={{
        src: "/art/cutouts/bunny-podium-win.png",
        width: 156,
        height: 223,
        className: "panel-cutout panel-cutout--simple-podium cutout-decoration--float",
      }}
      lede="Four v1 prize races mirrored from the indexer (~1s head poll). Your wallet gets a magenta ring."
      actions={
        <span className="timecurve-simple__podium-refresh" aria-live="polite">
          {podiumRefreshing ? "Refreshing podiums…" : "Indexer-backed snapshot"}
        </span>
      }
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
          />
        ))}
      </div>
      <p className="muted timecurve-simple__podium-footnote">
        {lastBuyPredictionActive
          ? "Last Buy shows a running prediction from indexed purchases until the sale ends"
          : "Last Buy finalizes from the onchain end-sale snapshot"}
        ; other tracks follow live onchain leaderboards. Animations respect reduced motion.
      </p>
      <p
        className="muted timecurve-simple__podium-footnote timecurve-simple__podium-usd-affordance"
        title={SIMPLE_PODIUM_USD_EQUIV_TITLE}
      >
        ≈ USD uses a static CL8Y→USDM display shape (0.98×; not a live oracle).
        {podiumUsdFreshness ? <> Prize CL8Y preview seen {podiumUsdFreshness}.</> : null}
      </p>
    </PageSection>
  );
}
