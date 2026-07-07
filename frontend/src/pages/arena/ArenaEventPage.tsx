// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { TxHash } from "@/components/TxHash";
import { PageHeroHeading } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import type { BuyItem } from "@/lib/indexerApi";
import {
  fetchArenaEventDetail,
  type ArenaEventChartBuy,
  type ArenaEventDetail,
} from "@/lib/indexerApi";
import { StandingsVisuals } from "@/pages/arena/ArenaSections";
import { buildBuyHistoryPoints } from "@/lib/timeArenaUx";

function chartBuyToBuyItem(buy: ArenaEventChartBuy): BuyItem {
  return {
    block_number: buy.block_number,
    tx_hash: buy.tx_hash,
    log_index: buy.log_index,
    buyer: buy.buyer,
    amount: buy.amount,
    charm_wad: buy.charm_wad,
    price_per_charm_wad: "0",
    new_deadline: buy.new_deadline,
    total_raised_after: buy.total_raised_after,
    buy_index: buy.buy_index,
    actual_seconds_added: buy.actual_seconds_added,
    block_timestamp: buy.block_timestamp,
  };
}

function podiumUxLabel(podium: string | null | undefined): string | null {
  if (!podium) return null;
  switch (podium) {
    case "last_buy":
      return "Last Buy";
    case "warbow":
      return "WarBow";
    case "defended_streak":
      return "Defended Streak";
    case "time_booster":
      return "Time Booster";
    default:
      return podium;
  }
}

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export function ArenaEventPage() {
  const { eventId: rawEventId } = useParams<{ eventId: string }>();
  const eventId = rawEventId ? decodeURIComponent(rawEventId) : "";
  const { isOffline } = useIndexerConnectivity();
  const [detail, setDetail] = useState<ArenaEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setError("Missing event id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchArenaEventDetail(eventId).then((body) => {
      if (cancelled) return;
      if (!body) {
        setDetail(null);
        setError("Indexer could not load this event — it may not exist or the indexer is offline.");
      } else {
        setDetail(body);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!detail?.title) return;
    const previous = document.title;
    const description = `${detail.title} — Yield Omega arena event archive.`;
    document.title = `${detail.title} · Yield Omega`;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? "";
    meta?.setAttribute("content", description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const previousOgTitle = ogTitle?.getAttribute("content") ?? "";
    ogTitle?.setAttribute("content", document.title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const previousOgDescription = ogDescription?.getAttribute("content") ?? "";
    ogDescription?.setAttribute("content", description);
    return () => {
      document.title = previous;
      if (meta) meta.setAttribute("content", previousDescription);
      if (ogTitle) ogTitle.setAttribute("content", previousOgTitle);
      if (ogDescription) ogDescription.setAttribute("content", previousOgDescription);
    };
  }, [detail?.title]);

  const chartBuys = useMemo(
    () => (detail?.chart_buys ?? []).map(chartBuyToBuyItem),
    [detail?.chart_buys],
  );
  const buyHistoryPoints = useMemo(
    () => buildBuyHistoryPoints(chartBuys, 12),
    [chartBuys],
  );

  return (
    <div className="page arena-event-page yga-secondary-page" data-testid="arena-event-page">
      <header className="page-hero">
        <PageHeroHeading
          title={detail?.title ?? "Arena event"}
          badgeLabel="Event archive"
          badgeTone="info"
        />
      </header>

      {isOffline ? (
        <PageSection title="Indexer status">
          <StatusMessage variant="warning">
            Indexer offline — event details may be incomplete until connectivity returns.
          </StatusMessage>
        </PageSection>
      ) : null}

      {loading ? (
        <PageSection title="Loading">
          <p aria-live="polite">Loading event from indexer…</p>
        </PageSection>
      ) : null}

      {!loading && error ? (
        <PageSection title="Unavailable">
          <StatusMessage variant="warning">{error}</StatusMessage>
          <p className="arena-event-page__cta-row">
            <Link to="/audit">Back to AUDIT</Link>
            <Link to="/">Play Time Arena</Link>
          </p>
        </PageSection>
      ) : null}

      {detail ? (
        <>
          <PageSection title="Summary" spotlight>
            <p className="arena-event-page__subtitle">{detail.subtitle}</p>
            <dl className="arena-event-page__facts">
              {podiumUxLabel(detail.podium) ? (
                <div>
                  <dt>Podium</dt>
                  <dd>{podiumUxLabel(detail.podium)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Epoch</dt>
                <dd>{detail.epoch}</dd>
              </div>
              {detail.block_timestamp ? (
                <div>
                  <dt>Settled</dt>
                  <dd>
                    <UnixTimestampDisplay raw={detail.block_timestamp} />
                  </dd>
                </div>
              ) : null}
              {detail.pool_paid_doub_wad ? (
                <div>
                  <dt>Pool paid</dt>
                  <dd>
                    <AmountDisplay raw={detail.pool_paid_doub_wad} decimals={18} /> DOUB
                  </dd>
                </div>
              ) : null}
              {detail.deadline_sec ? (
                <div>
                  <dt>Last Buy deadline</dt>
                  <dd>
                    <UnixTimestampDisplay raw={detail.deadline_sec} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </PageSection>

          {detail.winners && detail.winners.length > 0 ? (
            <PageSection title="Winners">
              <ul className="arena-event-page__winners">
                {detail.winners.map((winner) => (
                  <li key={winner.rank} className="arena-event-page__winner-card">
                    <span className="arena-event-page__winner-rank">{rankLabel(winner.rank)}</span>
                    {winner.address ? (
                      <AddressInline address={winner.address} tailHexDigits={6} size={22} />
                    ) : (
                      <span>—</span>
                    )}
                    <span className="arena-event-page__winner-prize">
                      <AmountDisplay raw={winner.prize_doub_wad} decimals={18} /> DOUB
                    </span>
                  </li>
                ))}
              </ul>
            </PageSection>
          ) : null}

          <PageSection title="Activity chart">
            <StandingsVisuals buyHistoryPoints={buyHistoryPoints} decimals={18} />
          </PageSection>

          <PageSection title="Transaction replay">
            <dl className="arena-event-page__facts">
              <div>
                <dt>Tx hash</dt>
                <dd>
                  <TxHash hash={detail.tx_hash} />
                </dd>
              </div>
              <div>
                <dt>Block</dt>
                <dd>{detail.block_number}</dd>
              </div>
              <div>
                <dt>Log index</dt>
                <dd>{detail.log_index}</dd>
              </div>
            </dl>
          </PageSection>

          <PageSection title="Explore">
            <p className="arena-event-page__cta-row">
              <Link to="/">Play Time Arena</Link>
              <Link to="/audit">Back to AUDIT directory</Link>
            </p>
          </PageSection>
        </>
      ) : null}
    </div>
  );
}
