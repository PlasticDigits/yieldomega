// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AddressInline } from "@/components/AddressInline";
import { TxHash } from "@/components/TxHash";
import { PageSection } from "@/components/ui/PageSection";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import {
  displayMinGrossSpendAtFloat,
  maxGrossSpendAtFloat,
} from "@/lib/timeCurveMath";
import {
  buySpendEnvelopeFillRatio,
  formatBuyAge,
  type EnvelopeCurveParams,
} from "@/lib/timeCurveBuyDisplay";
import { listBuyImpactTicks, type BuyImpactTick } from "@/lib/timeCurveUx";
import { buySizeColor } from "@/pages/timecurve/buySizeColor";
import { CHARM_TOKEN_LOGO, CL8Y_TOKEN_LOGO } from "@/lib/tokenMedia";
import type { BuyItem } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";

function buyEventTone(actualSecondsAdded: string | undefined, hardReset: boolean | undefined): string {
  if (hardReset) return "ticker-event--reset";
  if (!actualSecondsAdded) return "";
  try {
    const n = BigInt(actualSecondsAdded);
    if (n >= 600n) return "ticker-event--big";
    if (n >= 60n) return "ticker-event--mid";
  } catch {
    /* ignore */
  }
  return "";
}

function parseTickerBigInt(value: string | undefined | null): bigint | null {
  if (!value?.trim()) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function buyBandPosition(
  buy: BuyItem,
  envelopeParams: EnvelopeCurveParams | null,
  fallbackBounds: { minS: bigint; maxS: bigint } | null,
  decimals: number,
): {
  fillPercent: number;
  positionPercent: number;
  minLabel: string;
  maxLabel: string;
  sizeLabel: string;
  accentColor: string;
  title: string;
} | null {
  const amount = parseTickerBigInt(buy.amount);
  if (amount === null) return null;

  let minSpend: bigint | undefined;
  let maxSpend: bigint | undefined;
  let arenaRatio: number | null = null;
  if (envelopeParams && buy.block_timestamp?.trim()) {
    try {
      arenaRatio = buySpendEnvelopeFillRatio(buy, envelopeParams);
      const elapsedSec = Math.max(
        0,
        Number(BigInt(buy.block_timestamp.trim())) - envelopeParams.saleStartSec,
      );
      minSpend = displayMinGrossSpendAtFloat(
        envelopeParams.charmEnvelopeRefWad,
        envelopeParams.growthRateWad,
        envelopeParams.basePriceWad,
        envelopeParams.dailyIncrementWad,
        elapsedSec,
      );
      maxSpend = maxGrossSpendAtFloat(
        envelopeParams.charmEnvelopeRefWad,
        envelopeParams.growthRateWad,
        envelopeParams.basePriceWad,
        envelopeParams.dailyIncrementWad,
        elapsedSec,
      );
    } catch {
      minSpend = undefined;
      maxSpend = undefined;
    }
  }

  if ((minSpend === undefined || maxSpend === undefined) && fallbackBounds) {
    minSpend = fallbackBounds.minS;
    maxSpend = fallbackBounds.maxS;
  }
  if (minSpend === undefined || maxSpend === undefined || maxSpend <= minSpend) return null;
  const fillRatio =
    arenaRatio !== null
      ? arenaRatio
      : Math.max(0, Math.min(1, Number((amount * 10_000n) / maxSpend) / 10_000));
  const fillPercent = Math.max(0, Math.min(100, fillRatio * 100));
  let positionPercent = 0;
  if (amount >= maxSpend) {
    positionPercent = 100;
  } else if (amount > minSpend) {
    positionPercent = Number(((amount - minSpend) * 10_000n) / (maxSpend - minSpend)) / 100;
  }
  const sizeLabel =
    fillPercent >= 80
      ? "Max pressure"
      : fillPercent >= 55
        ? "Heavy buy"
        : fillPercent >= 25
          ? "Mid band"
          : "Near minimum";
  return {
    fillPercent,
    positionPercent,
    minLabel: formatCompactFromRaw(minSpend, decimals, { sigfigs: 3 }),
    maxLabel: formatCompactFromRaw(maxSpend, decimals, { sigfigs: 3 }),
    sizeLabel,
    accentColor: buySizeColor(fillRatio),
    title: `${Math.round(fillPercent)}% of current max CL8Y band; ${Math.round(positionPercent)}% from min to max`,
  };
}

function tickerImpactTicks(buy: BuyItem): BuyImpactTick[] {
  const ticks = listBuyImpactTicks(buy, 6);
  const out: BuyImpactTick[] = [];
  if (buy.flag_planted === true) {
    out.push({ id: "flag-plant", label: "Flag planted", tone: "warning" });
  }
  out.push(...ticks);
  const activeStreak = parseTickerBigInt(buy.buyer_active_defended_streak);
  if (activeStreak !== null && activeStreak > 0n && !out.some((tick) => tick.id === "def")) {
    out.push({ id: "streak", label: "Streak", sub: `${activeStreak.toString()}x`, tone: "info" });
  }
  return out.slice(0, 6);
}

function tickerEffectDisplay(tick: BuyImpactTick): { label: string; sub?: string; glyph: string } {
  switch (tick.id) {
    case "flag-plant":
      return { label: "Flag planted", sub: tick.sub, glyph: "WB" };
    case "flag":
      return { label: "Flag hit", sub: tick.sub ? `-${tick.sub} BP` : undefined, glyph: "WB" };
    case "hreset":
      return { label: "Clock reset", sub: tick.sub, glyph: "CLK" };
    case "sbreak":
      return { label: "Streak break", sub: tick.sub, glyph: "STK" };
    case "ambush":
      return { label: "Ambush", sub: tick.sub, glyph: "AMB" };
    case "clutch":
      return { label: "Clutch", sub: tick.sub, glyph: "CLT" };
    case "tbp":
      return { label: "Timer BP", sub: tick.sub, glyph: "BP" };
    case "def":
    case "streak":
      return { label: "Defended streak", sub: tick.sub, glyph: "DEF" };
    case "wb":
      return { label: "Battle Points", sub: tick.sub, glyph: "BP" };
    case "tadd":
      return { label: "Clock added", sub: tick.sub, glyph: "+T" };
    case "buy":
      return { label: "On-chain buy", sub: tick.sub === "—" ? undefined : tick.sub, glyph: "YO" };
    default:
      return { label: tick.label, sub: tick.sub, glyph: "YO" };
  }
}

function tickerCardTheme(buy: BuyItem, band: ReturnType<typeof buyBandPosition>) {
  const flagPenalty = parseTickerBigInt(buy.bp_flag_penalty) ?? 0n;
  const activeStreak = parseTickerBigInt(buy.buyer_active_defended_streak) ?? 0n;
  const bandFill = band?.fillPercent ?? 0;
  if (flagPenalty > 0n || buy.flag_planted === true) {
    return {
      className: "timecurve-simple__ticker-row--flag",
      badge: "WarBow flag",
      artSrc: "/art/icons/warbow-flag.png",
    };
  }
  if (buy.timer_hard_reset) {
    return {
      className: "timecurve-simple__ticker-row--reset",
      badge: "Clock reset",
      artSrc: "/art/icons/status-cooldown.png",
    };
  }
  if (activeStreak >= 2n) {
    return {
      className: "timecurve-simple__ticker-row--streak",
      badge: "Streak",
      artSrc: "/art/cutouts/bunny-guarding.png",
    };
  }
  if (bandFill >= 75) {
    return {
      className: "timecurve-simple__ticker-row--max",
      badge: "Big bite",
      artSrc: "/art/cutouts/sniper-shark-coin-bandolier.png",
    };
  }
  if (bandFill >= 35) {
    return {
      className: "timecurve-simple__ticker-row--mid",
      badge: "Momentum",
      artSrc: "/art/hat-coin-front.png",
    };
  }
  return {
    className: "timecurve-simple__ticker-row--min",
    badge: "Fresh buy",
    artSrc: CHARM_TOKEN_LOGO,
  };
}

export type TimeCurveLiveBuysActivitySectionProps = {
  /** Defaults to `timecurve-live-buys-activity`. */
  dataTestId?: string;
  recentBuys: BuyItem[] | null;
  decimals: number;
  tickerEnvelopeParams: EnvelopeCurveParams | null;
  cl8ySpendBounds: { minS: bigint; maxS: bigint } | null | undefined;
  isOffline: boolean;
  /** `null` until the first poll completes; then mirrors the latest poll success. */
  buyPollLastOk: boolean | null;
  buysNextOffset: number | null;
  loadingMoreBuys: boolean;
  buyPagesExpanded: boolean;
  onLoadMore: () => void | Promise<void>;
};

/**
 * Full-height “Live buys” ticker cards (formerly on `/timecurve` Simple, then Arena).
 * Wired on the protocol / audit view (`/timecurve/protocol`) so operators can
 * correlate indexed activity with raw onchain reads.
 */
export function TimeCurveLiveBuysActivitySection({
  dataTestId = "timecurve-live-buys-activity",
  recentBuys,
  decimals,
  tickerEnvelopeParams,
  cl8ySpendBounds,
  isOffline,
  buyPollLastOk,
  buysNextOffset,
  loadingMoreBuys,
  buyPagesExpanded,
  onLoadMore,
}: TimeCurveLiveBuysActivitySectionProps) {
  const [tickerWallNowSec, setTickerWallNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const activityScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerWallNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const root = activityScrollRef.current;
    const target = loadMoreSentinelRef.current;
    if (!root || !target || buysNextOffset === null) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void onLoadMoreRef.current();
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [buysNextOffset, recentBuys?.length]);

  const fallbackBounds =
    cl8ySpendBounds && cl8ySpendBounds.minS < cl8ySpendBounds.maxS
      ? { minS: cl8ySpendBounds.minS, maxS: cl8ySpendBounds.maxS }
      : null;

  return (
    <PageSection
      className="timecurve-simple__activity-panel"
      dataTestId={dataTestId}
      badgeLabel="Live buys"
      badgeTone="info"
    >
      {recentBuys && recentBuys.length > 0 ? (
        <>
          {(isOffline || buyPollLastOk === false) && (
            <p className="muted timecurve-simple__indexer-stale-hint">
              Cannot reach indexer · cached data may be stale
            </p>
          )}
          <div
            ref={activityScrollRef}
            className="timecurve-simple__activity-scroll"
            role="region"
            aria-label="Recent buys; scroll for older activity"
          >
            <ul className="timecurve-simple__activity-list">
              {recentBuys.map((b) => {
                const band = buyBandPosition(b, tickerEnvelopeParams, fallbackBounds, decimals);
                const age = formatBuyAge(b.block_timestamp, tickerWallNowSec);
                const ticks = tickerImpactTicks(b);
                const theme = tickerCardTheme(b, band);
                const bandFillPercent = band ? Math.round(band.fillPercent) : null;
                const tickerStyle = {
                  "--ticker-accent": band?.accentColor ?? "#1fb86a",
                  "--ticker-band-fill": band
                    ? `${Math.max(8, Math.min(100, band.fillPercent))}%`
                    : "100%",
                } as CSSProperties;
                return (
                  <li
                    key={`${b.tx_hash}-${b.log_index}`}
                    className={[
                      "timecurve-simple__ticker-row",
                      buyEventTone(b.actual_seconds_added, b.timer_hard_reset),
                      theme.className,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={tickerStyle}
                  >
                    <div className="timecurve-simple__ticker-art" aria-hidden="true">
                      <img src={theme.artSrc} alt="" width={42} height={42} decoding="async" />
                    </div>
                    <div className="timecurve-simple__ticker-main">
                      <span className="timecurve-simple__ticker-badge">{theme.badge}</span>
                      <AddressInline address={b.buyer} size={22} className="timecurve-simple__ticker-buyer" />
                      <span className="timecurve-simple__ticker-age">
                        {age ?? `block ${formatLocaleInteger(b.block_number)}`}
                      </span>
                    </div>
                    <div className="timecurve-simple__ticker-amounts">
                      <span className="timecurve-simple__ticker-amount">
                        <img src={CL8Y_TOKEN_LOGO} alt="" width={18} height={18} decoding="async" />
                        <strong>{formatBuyHubDerivedCompact(b.amount, decimals)}</strong>
                        <span> CL8Y</span>
                      </span>
                      <span className="timecurve-simple__ticker-amount timecurve-simple__ticker-amount--charm">
                        <img src={CHARM_TOKEN_LOGO} alt="" width={18} height={18} decoding="async" />
                        <strong>{formatBuyHubDerivedCompact(b.charm_wad, 18)}</strong>
                        <span> CHARM</span>
                      </span>
                    </div>
                    <div
                      className="timecurve-simple__ticker-band"
                      title={band?.title ?? "Min/max band position unavailable for this indexed buy"}
                    >
                      <div className="timecurve-simple__ticker-band-head">
                        <span>{band ? `Min ${band.minLabel}` : "Min"}</span>
                        <strong>{bandFillPercent !== null ? `${bandFillPercent}% of max` : "Band pending"}</strong>
                        <span>{band ? `Max ${band.maxLabel}` : "Max"}</span>
                      </div>
                      <div className="timecurve-simple__ticker-band-track" aria-hidden="true">
                        <span className="timecurve-simple__ticker-band-min-marker" />
                        <span
                          className={
                            bandFillPercent !== null
                              ? "timecurve-simple__ticker-band-fill"
                              : "timecurve-simple__ticker-band-fill timecurve-simple__ticker-band-fill--unknown"
                          }
                        />
                      </div>
                      <div className="timecurve-simple__ticker-band-foot">
                        {band
                          ? `${band.sizeLabel} · ${Math.round(band.positionPercent)}% through min-max`
                          : "Waiting for band math"}
                      </div>
                    </div>
                    <ul className="timecurve-simple__ticker-effects" aria-label="Buy effects">
                      {ticks.map((tick) => {
                        const effect = tickerEffectDisplay(tick);
                        return (
                          <li
                            key={tick.id}
                            className={`live-buy-tick live-buy-tick--${tick.tone} live-buy-tick--effect-${tick.id}`}
                          >
                            <span className="live-buy-tick__glyph" aria-hidden="true">
                              {effect.glyph}
                            </span>
                            <span className="live-buy-tick__text">
                              <span className="live-buy-tick__label">{effect.label}</span>
                              {effect.sub ? <span className="live-buy-tick__sub">{effect.sub}</span> : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="timecurve-simple__ticker-meta">
                      {b.battle_points_after ? (
                        <span>{formatLocaleInteger(BigInt(b.battle_points_after))} BP</span>
                      ) : (
                        <span>WarBow BP pending</span>
                      )}
                      <span>
                        tx <TxHash hash={b.tx_hash} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {loadingMoreBuys ? (
              <p className="muted timecurve-simple__activity-load-more" aria-live="polite">
                Loading older buys…
              </p>
            ) : null}
            {buysNextOffset !== null ? (
              <div
                ref={loadMoreSentinelRef}
                className="timecurve-simple__activity-load-sentinel"
                data-testid="timecurve-live-buys-scroll-sentinel"
                aria-hidden="true"
              />
            ) : buyPagesExpanded ? (
              <p className="muted timecurve-simple__activity-load-more">End of loaded history</p>
            ) : null}
          </div>
        </>
      ) : buyPollLastOk === true && recentBuys && recentBuys.length === 0 && !isOffline ? (
        <p className="muted">Waiting for the first buy of this round.</p>
      ) : buyPollLastOk === false || isOffline ? (
        <p className="muted">Cannot reach indexer · cached data may be stale</p>
      ) : (
        <p className="muted">Loading recent buys…</p>
      )}
    </PageSection>
  );
}
