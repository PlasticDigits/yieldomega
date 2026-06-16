// SPDX-License-Identifier: AGPL-3.0-only

import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatBpsAsPercent, parseBigIntString } from "@/lib/formatAmount";
import type { ArenaBuyRoutingSummary } from "@/lib/indexerApi";

const PLACE_LABELS = ["1st", "2nd", "3rd"] as const;

function trancheTitle(slot: string): string {
  switch (slot) {
    case "current":
      return "Current epoch";
    case "next":
      return "Next epoch (+1)";
    case "future":
      return "Epoch +2";
    default:
      return slot;
  }
}

function formatDoubCompact(raw: string): string {
  return `${formatCompactFromRaw(parseBigIntString(raw), 18, { sigfigs: 4 })} DOUB`;
}

function formatPrizeInline(prizes: readonly [string, string, string]): string {
  return PLACE_LABELS.map((place, i) => `${place}: ${formatDoubCompact(prizes[i]!)}`).join(" · ");
}

export function ProtocolDoubBuyRoutingCard(props: {
  buyRouting: ArenaBuyRoutingSummary | null | undefined;
}) {
  const { buyRouting } = props;

  if (!buyRouting) {
    return (
      <div className="podium-block">
        <h3>DOUB buy routing</h3>
        <p className="protocol-doub-routing__muted">—</p>
      </div>
    );
  }

  return (
    <div className="podium-block">
      <h3>DOUB buy routing</h3>
      <p className="protocol-doub-routing__policy">
        100% podiums · {formatBpsAsPercent(buyRouting.podium_category_share_bps)} per track ·{" "}
        {buyRouting.epoch_tranches
          .map((t) => formatBpsAsPercent(t.tranche_bps))
          .join(" / ")}{" "}
        epoch tranches
      </p>
      <ul className="event-list protocol-doub-routing__list">
        {buyRouting.epoch_tranches.map((tranche) => (
          <li key={tranche.slot}>
            <strong>{trancheTitle(tranche.slot)}</strong> · routing{" "}
            {formatBpsAsPercent(tranche.tranche_bps)} · pool{" "}
            <span className="mono">{formatDoubCompact(tranche.pool_total_doub_wad)}</span>
            <span className="protocol-doub-routing__prizes">
              {" "}
              · {formatPrizeInline(tranche.prize_places_doub_wad)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
