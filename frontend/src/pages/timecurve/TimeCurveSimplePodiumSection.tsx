// SPDX-License-Identifier: AGPL-3.0-only

import { isAddress, zeroAddress } from "viem";
import { AddressInline } from "@/components/AddressInline";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import { formatPodiumLeaderboardValue } from "./podiumFormat";
import type { PodiumReadRow } from "./usePodiumReads";
import { RankingList, type RankingRow } from "./timecurveUi";

const PODIUM_PLACE_LABELS = ["1st", "2nd", "3rd"] as const;
const ZERO_ADDR = zeroAddress as `0x${string}`;

const SIMPLE_PODIUM_ART = [
  "/art/podium_prizes/lastbuy.png",
  "/art/podium_prizes/WARBOW_LADDER.png",
  "/art/podium_prizes/DEFENDEDSTREAK.png",
  "/art/podium_prizes/TIMEBOOSTER.png",
] as const;

export type TimeCurveSimplePodiumSectionProps = {
  podiumRows: PodiumReadRow[];
  podiumLoading: boolean;
  podiumRefreshing?: boolean;
  address: string | undefined;
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
): RankingRow[] {
  const winners = row?.winners ?? [ZERO_ADDR, ZERO_ADDR, ZERO_ADDR];
  const values = row?.values ?? ["0", "0", "0"];

  return PODIUM_PLACE_LABELS.map((placeLabel, placeIndex) => {
    const winner = winners[placeIndex] ?? ZERO_ADDR;
    const winnerReady = hasWinner(winner);
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
      value: winnerReady ? formatPodiumLeaderboardValue(categoryIndex, values[placeIndex] ?? "0") : "Pending",
      meta:
        placeIndex === 0
          ? `${placeLabel} place · current leader`
          : `${placeLabel} place · onchain snapshot`,
      highlight: winnerReady && sameAddress(winner, viewerAddress),
    };
  });
}

export function TimeCurveSimplePodiumSection({
  podiumRows,
  podiumLoading,
  podiumRefreshing = false,
  address,
}: TimeCurveSimplePodiumSectionProps) {
  return (
    <PageSection
      title="Live reserve podiums"
      className="timecurve-simple__podium-panel"
      dataTestId="timecurve-simple-podiums"
      badgeLabel="Onchain podiums"
      badgeTone="warning"
      spotlight
      cutout={{
        src: "/art/cutouts/bunny-podium-win.png",
        width: 156,
        height: 156,
        className: "panel-cutout panel-cutout--simple-podium cutout-decoration--float",
      }}
      lede="The four v1 prize races, read directly from TimeCurve.podium(category). Rows marked with the magenta ring are yours."
      actions={
        <span className="timecurve-simple__podium-refresh" aria-live="polite">
          {podiumRefreshing ? "Refreshing podiums…" : "Live RPC snapshot"}
        </span>
      }
    >
      {podiumLoading && (
        <StatusMessage variant="loading">Loading the four onchain podium categories…</StatusMessage>
      )}
      <div className="podium-preview timecurve-simple__podium-grid">
        {PODIUM_LABELS.map((label, categoryIndex) => (
          <div key={label} className="podium-block timecurve-simple__podium-card">
            <div className="timecurve-simple__podium-card-head">
              <span className="timecurve-simple__podium-art" aria-hidden="true">
                <img
                  src={SIMPLE_PODIUM_ART[categoryIndex]}
                  alt=""
                  width={68}
                  height={68}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <div>
                <h3>{label}</h3>
                <p className="muted">{PODIUM_HELP[categoryIndex]}</p>
              </div>
            </div>
            <RankingList
              rows={rankingRowsForPodium(podiumRows[categoryIndex], categoryIndex, address)}
              emptyText="No onchain winners yet."
            />
          </div>
        ))}
      </div>
      <p className="muted timecurve-simple__podium-footnote">
        Buys refetch this card immediately; a light RPC refresh catches WarBow-only moves without
        making the indexer authoritative for winners.
      </p>
    </PageSection>
  );
}
