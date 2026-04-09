// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CharmRedemptionCurve } from "@/components/CharmRedemptionCurve";
import { TxHash } from "@/components/TxHash";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatBpsAsPercent, formatLocaleInteger, formatUnixSecIsoUtc } from "@/lib/formatAmount";
import type {
  BattlePointBreakdownRow,
  BuyHistoryPoint,
  FeedNarrative,
  WarbowPreflightNarrative,
} from "@/lib/timeCurveUx";
import { RESERVE_FEE_ROUTING_BPS } from "@/lib/timeCurvePodiumMath";
import { shortAddress } from "@/lib/addressFormat";
import type {
  BuyItem,
  CharmRedemptionItem,
  PrizeDistributionItem,
  PrizePayoutItem,
  ReferralAppliedItem,
  TimecurveBuyerStats,
  WarbowBattleFeedItem,
} from "@/lib/indexerApi";
import { PODIUM_HELP, PODIUM_LABELS } from "./podiumCopy";
import { FeedCard, RankingList, type RankingRow, StatCard } from "./timecurveUi";

type MotionProps = Record<string, unknown>;

export function WhatMattersSection(props: {
  saleActive: boolean;
  saleEnded: boolean;
  whatMattersNowCards: { label: string; value: ReactNode; meta: ReactNode }[];
  minBuy: { status: "success" | "failure"; result?: unknown } | undefined;
  decimals: number;
  expectedTokenFromCharms: bigint | undefined;
  charmWeightResult: { status: "success" | "failure"; result?: unknown } | undefined;
  podiumPoolBal: bigint | undefined;
  battlePointsResult: { status: "success" | "failure"; result?: unknown } | undefined;
  totalRaisedResult: { status: "success" | "failure"; result?: unknown } | undefined;
  isPending: boolean;
  isError: boolean;
  indexerMismatch: string | null;
  claimHint: string | null;
  distributeHint: string | null;
}) {
  const {
    saleActive,
    saleEnded,
    whatMattersNowCards,
    minBuy,
    decimals,
    expectedTokenFromCharms,
    charmWeightResult,
    podiumPoolBal,
    battlePointsResult,
    totalRaisedResult,
    isPending,
    isError,
    indexerMismatch,
    claimHint,
    distributeHint,
  } = props;

  return (
    <PageSection
      title="What matters now"
      badgeLabel={saleActive ? "Player view" : saleEnded ? "Settlement view" : "Live setup"}
      badgeTone={saleActive ? "live" : saleEnded ? "warning" : "info"}
      lede="The top of TimeCurve now tells you what to chase, what your move changes, and why the room is exciting even before you optimize."
    >
      <div className="priority-grid">
        {whatMattersNowCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} meta={card.meta} className="stat-card--priority" />
        ))}
      </div>
      <div className="stats-grid timecurve-stats-grid">
        <StatCard
          label={saleActive ? "Current min buy" : "Minimum buy"}
          value={
            minBuy?.status === "success" ? <AmountDisplay raw={minBuy.result as bigint} decimals={decimals} /> : "—"
          }
          meta="Human-readable reserve spend floor"
        />
        <StatCard
          label={saleEnded ? "Expected redemption" : "Your charm weight"}
          value={
            saleEnded ? (
              expectedTokenFromCharms !== undefined ? (
                <AmountDisplay raw={expectedTokenFromCharms} decimals={18} />
              ) : (
                "—"
              )
            ) : charmWeightResult?.status === "success" ? (
              <AmountDisplay raw={charmWeightResult.result as bigint} decimals={18} />
            ) : (
              "—"
            )
          }
          meta={saleEnded ? "Projected launched-token claim" : "Onchain charm weight for your wallet"}
        />
        <StatCard
          label="Podium pool"
          value={podiumPoolBal !== undefined ? <AmountDisplay raw={podiumPoolBal} decimals={decimals} /> : "—"}
          meta="Reserve pool for the three fixed prize categories"
        />
        <StatCard
          label={saleActive ? "Battle Points" : "Total raised"}
          value={
            saleActive ? (
              battlePointsResult?.status === "success" ? (
                formatLocaleInteger(battlePointsResult.result as bigint)
              ) : (
                "—"
              )
            ) : totalRaisedResult?.status === "success" ? (
              <AmountDisplay raw={totalRaisedResult.result as bigint} decimals={decimals} />
            ) : (
              "—"
            )
          }
          meta={saleActive ? "Your live WarBow PvP score" : "Authoritative sale total from contract reads"}
        />
      </div>
      {isPending && <StatusMessage variant="loading">Loading contract reads...</StatusMessage>}
      {isError && <StatusMessage variant="error">Could not read contract (check RPC / network).</StatusMessage>}
      {indexerMismatch && <StatusMessage variant="error">{indexerMismatch}</StatusMessage>}
      {claimHint && <StatusMessage variant="muted">{claimHint}</StatusMessage>}
      {saleEnded && distributeHint && <StatusMessage variant="muted">{distributeHint}</StatusMessage>}
    </PageSection>
  );
}

export function WarbowSection(props: {
  saleActive: boolean;
  warbowMaxSteals: number;
  warbowBypassBurnWad: bigint;
  warbowGuardBurnWad: bigint;
  warbowActionHint: string;
  warbowFlagSilenceSec: bigint;
  warbowFlagClaimBp: bigint;
  isConnected: boolean;
  stealVictimInput: string;
  setStealVictimInput: (value: string) => void;
  stealVictim?: string;
  victimStealsTodayBigInt: bigint | undefined;
  warbowTopRows: RankingRow[];
  warbowLeaderboardRows: RankingRow[];
  warbowFeed: WarbowBattleFeedItem[] | null;
  address: string | undefined;
  buildWarbowNarrative: (item: WarbowBattleFeedItem, viewer: string | undefined) => FeedNarrative;
  stealBypass: boolean;
  setStealBypass: (value: boolean) => void;
  runWarBowSteal: () => Promise<void>;
  runWarBowGuard: () => Promise<void>;
  runWarBowClaimFlag: () => Promise<void>;
  runWarBowRevenge: () => Promise<void>;
  isWriting: boolean;
  canClaimWarBowFlag: boolean;
  iHoldPlantFlag: boolean;
  flagSilenceEndSec: bigint;
  hasRevengeOpen: boolean;
  secondaryButtonMotion: MotionProps;
  stealPreflight: WarbowPreflightNarrative;
  warbowPreflightIssue: string | null;
  viewerBattlePoints: bigint | undefined;
  victimBattlePointsBigInt: bigint | undefined;
  gasWarbowSteal: bigint | undefined;
  gasWarbowGuard: bigint | undefined;
  gasWarbowFlag: bigint | undefined;
  gasWarbowRevenge: bigint | undefined;
}) {
  const {
    saleActive,
    warbowMaxSteals,
    warbowBypassBurnWad,
    warbowGuardBurnWad,
    warbowActionHint,
    warbowFlagSilenceSec,
    warbowFlagClaimBp,
    isConnected,
    stealVictimInput,
    setStealVictimInput,
    stealVictim,
    victimStealsTodayBigInt,
    warbowTopRows,
    warbowLeaderboardRows,
    warbowFeed,
    address,
    buildWarbowNarrative,
    stealBypass,
    setStealBypass,
    runWarBowSteal,
    runWarBowGuard,
    runWarBowClaimFlag,
    runWarBowRevenge,
    isWriting,
    canClaimWarBowFlag,
    iHoldPlantFlag,
    flagSilenceEndSec,
    hasRevengeOpen,
    secondaryButtonMotion,
    stealPreflight,
    warbowPreflightIssue,
    viewerBattlePoints,
    victimBattlePointsBigInt,
    gasWarbowSteal,
    gasWarbowGuard,
    gasWarbowFlag,
    gasWarbowRevenge,
  } = props;

  return (
    <PageSection
      title="WarBow moves and rivalry"
      badgeLabel={saleActive ? "Live PvP" : "PvP rules"}
      badgeTone={saleActive ? "live" : "info"}
      spotlight
      lede="WarBow is the loudest status layer in TimeCurve: steal when you are behind, guard when you are a target, revenge when someone hits you, and claim the flag when silence turns into spotlight."
    >
      <div className="status-strip">
        <span className="status-pill status-pill--info">
          Steal cap: {formatLocaleInteger(warbowMaxSteals)} per victim per UTC day
        </span>
        <span className="status-pill status-pill--warning">
          Bypass burn <AmountDisplay raw={warbowBypassBurnWad} decimals={18} />
        </span>
        <span className="status-pill status-pill--info">
          Guard burn <AmountDisplay raw={warbowGuardBurnWad} decimals={18} />
        </span>
      </div>
      <StatusMessage variant="muted">{warbowActionHint}</StatusMessage>
      <details className="podium-block accordion-panel">
        <summary>
          <strong>Rules and eligibility</strong>
        </summary>
        <div className="accordion-panel__content">
          <StatusMessage variant="muted">
            Steals require the victim to have at least 2x your Battle Points. Each victim can be stolen from{" "}
            {formatLocaleInteger(warbowMaxSteals)} times per UTC day unless you pay the extra bypass burn. Guard lasts
            6h and reduces the next incoming steal to 1%. Revenge lets the victim hit the pending stealer once within
            the configured window. After a buy, silence for {formatLocaleInteger(warbowFlagSilenceSec)}s lets the buyer
            claim +{formatLocaleInteger(warbowFlagClaimBp)} BP.
          </StatusMessage>
        </div>
      </details>
      {isConnected && saleActive && (
        <>
          <label className="form-label">
            Steal victim address
            <input
              type="text"
              className="form-input"
              placeholder="0x..."
              value={stealVictimInput}
              onChange={(e) => setStealVictimInput(e.target.value)}
              spellCheck={false}
            />
          </label>
          {stealVictim && victimStealsTodayBigInt !== undefined && (
            <StatusMessage variant="muted">
              Victim steals received today: {formatLocaleInteger(victimStealsTodayBigInt)} /{" "}
              {formatLocaleInteger(BigInt(warbowMaxSteals))}
            </StatusMessage>
          )}
          {stealVictim && (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Your BP"
                  value={viewerBattlePoints !== undefined ? formatLocaleInteger(viewerBattlePoints) : "—"}
                  meta="Live contract read"
                />
                <StatCard
                  label="Victim BP"
                  value={victimBattlePointsBigInt !== undefined ? formatLocaleInteger(victimBattlePointsBigInt) : "—"}
                  meta="Must be at least 2x your BP"
                />
                <StatCard
                  label="Steal pressure today"
                  value={
                    victimStealsTodayBigInt !== undefined
                      ? `${formatLocaleInteger(victimStealsTodayBigInt)} / ${formatLocaleInteger(BigInt(warbowMaxSteals))}`
                      : "—"
                  }
                  meta="Per-victim UTC-day cap"
                />
                <StatCard
                  label="Steal gas"
                  value={gasWarbowSteal !== undefined ? `~${formatLocaleInteger(gasWarbowSteal)}` : "Pending"}
                  meta="Best-effort simulation + gas estimate"
                />
              </div>
              <StatusMessage variant={stealPreflight.tone === "error" ? "error" : "muted"}>
                <strong>{stealPreflight.title}</strong> · {warbowPreflightIssue ?? stealPreflight.detail}
              </StatusMessage>
            </>
          )}
          <label className="form-label">
            <input type="checkbox" checked={stealBypass} onChange={(e) => setStealBypass(e.target.checked)} /> Pay the
            bypass burn if the victim already hit the UTC-day steal cap
          </label>
          <div className="timecurve-action-row">
            <motion.button
              type="button"
              className="btn-secondary btn-secondary--critical"
              disabled={isWriting || stealPreflight.tone === "error"}
              onClick={() => void runWarBowSteal()}
              {...secondaryButtonMotion}
            >
              Attempt steal
            </motion.button>
            <motion.button
              type="button"
              className="btn-secondary"
              disabled={isWriting}
              onClick={() => void runWarBowGuard()}
              {...secondaryButtonMotion}
            >
              Activate guard
            </motion.button>
            <motion.button
              type="button"
              className="btn-secondary"
              disabled={isWriting || !canClaimWarBowFlag}
              onClick={() => void runWarBowClaimFlag()}
              {...secondaryButtonMotion}
            >
              Claim flag
            </motion.button>
            <motion.button
              type="button"
              className="btn-secondary btn-secondary--priority"
              disabled={isWriting || !hasRevengeOpen}
              onClick={() => void runWarBowRevenge()}
              {...secondaryButtonMotion}
            >
              Trigger revenge
            </motion.button>
          </div>
          {(gasWarbowGuard !== undefined || gasWarbowFlag !== undefined || gasWarbowRevenge !== undefined) && (
            <StatusMessage variant="muted">
              {gasWarbowGuard !== undefined && <>Guard gas ~{formatLocaleInteger(gasWarbowGuard)}</>}
              {gasWarbowGuard !== undefined && (gasWarbowFlag !== undefined || gasWarbowRevenge !== undefined) && <> · </>}
              {gasWarbowFlag !== undefined && <>Flag gas ~{formatLocaleInteger(gasWarbowFlag)}</>}
              {gasWarbowFlag !== undefined && gasWarbowRevenge !== undefined && <> · </>}
              {gasWarbowRevenge !== undefined && <>Revenge gas ~{formatLocaleInteger(gasWarbowRevenge)}</>}
            </StatusMessage>
          )}
          {!canClaimWarBowFlag && iHoldPlantFlag && saleActive && (
            <StatusMessage variant="muted">
              Flag planted. Silence ends at <UnixTimestampDisplay raw={flagSilenceEndSec} />.
            </StatusMessage>
          )}
        </>
      )}
      <div className="split-layout">
        <div className="podium-block">
          <h3>Top rivals</h3>
          <RankingList rows={warbowTopRows} emptyText="Waiting for WarBow contract snapshot." />
        </div>
        <div className="podium-block">
          <h3>Chasing pack</h3>
          <RankingList rows={warbowLeaderboardRows} emptyText="Set the indexer URL or wait for indexed buys." />
        </div>
      </div>
      <div className="podium-block">
        <h3>Rivalry feed</h3>
        {warbowFeed && warbowFeed.length > 0 ? (
          <ul className="feed-grid">
            {warbowFeed.slice(0, 8).map((item) => {
              const narrative = buildWarbowNarrative(item, address);
              return (
                <FeedCard
                  key={`${item.tx_hash}-${item.kind}-${item.log_index}`}
                  eyebrow={narrative.eyebrow}
                  title={<strong>{narrative.headline}</strong>}
                  meta={
                    <>
                      {narrative.detail}
                      {item.block_timestamp ? ` · ${new Date(Number(item.block_timestamp) * 1000).toLocaleString()}` : ""}
                      {" "}· block {formatLocaleInteger(item.block_number)} · tx <TxHash hash={item.tx_hash} />
                    </>
                  }
                  tags={narrative.tags}
                />
              );
            })}
          </ul>
        ) : (
          <StatusMessage variant="muted">No WarBow feed rows yet.</StatusMessage>
        )}
      </div>
    </PageSection>
  );
}

export function PodiumsSection(props: {
  podiumPayoutPreview: { places: readonly [bigint, bigint, bigint] }[];
  decimals: number;
  podiumLoading: boolean;
  podiumRows: { winners: [`0x${string}`, `0x${string}`, `0x${string}`]; values: readonly [bigint, bigint, bigint] }[];
  address: string | undefined;
  formatPodiumLeaderboardValue: (categoryIndex: number, raw: bigint) => string;
}) {
  const { podiumPayoutPreview, decimals, podiumLoading, podiumRows, address, formatPodiumLeaderboardValue } = props;
  return (
    <PageSection
      title="Podiums and prizes"
      badgeLabel="Reserve prize podiums"
      badgeTone="warning"
      lede="Reserve prizes only pay three categories: Last Buy, Time Booster, and Defended Streak. WarBow stays separate as the PvP status ladder, so the page shows both without mixing their rules."
    >
      <div className="podium-preview">
        {podiumPayoutPreview.map((row, idx) => (
          <div key={idx} className="podium-block">
            <h3>{PODIUM_LABELS[idx] ?? `Category ${idx}`}</h3>
            <p className="muted">{PODIUM_HELP[idx]}</p>
            <RankingList
              rows={(["1st", "2nd", "3rd"] as const).map((lab, placeIndex) => ({
                key: `preview-${idx}-${lab}`,
                rank: placeIndex + 1,
                label: lab,
                value: <AmountDisplay raw={row.places[placeIndex]} decimals={decimals} />,
                meta: placeIndex === 0 ? "Largest reserve slice in category" : "Reserve payout preview",
              }))}
              emptyText="Waiting for podium pool balance."
            />
          </div>
        ))}
      </div>
      <details className="podium-block accordion-panel">
        <summary>
          <strong>Current winners and category rules</strong>
        </summary>
        <div className="accordion-panel__content">
          <div className="split-layout">
            <div>
              <h3>How categories work</h3>
              <ul className="accent-list">
                {PODIUM_LABELS.map((title, index) => (
                  <li key={title}>
                    <strong>{title}</strong>
                    <div className="muted">{PODIUM_HELP[index]}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Onchain podiums</h3>
              {podiumLoading && <StatusMessage variant="loading">Loading podiums...</StatusMessage>}
              {!podiumLoading &&
                podiumRows.map((row, index) => (
                  <div key={index} className="podium-block">
                    <h3>{PODIUM_LABELS[index] ?? `Category ${index}`}</h3>
                    <RankingList
                      rows={row.winners.map((winner, placeIndex) => ({
                        key: `podium-${index}-${winner}-${placeIndex}`,
                        rank: placeIndex + 1,
                        label: <span className="mono">{shortAddress(winner)}</span>,
                        value: formatPodiumLeaderboardValue(index, row.values[placeIndex] ?? 0n),
                        meta: placeIndex === 0 ? "Current leader" : "Onchain snapshot",
                        highlight: Boolean(address && winner.toLowerCase() === address.toLowerCase()),
                      }))}
                      emptyText="No onchain winners yet."
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </details>
    </PageSection>
  );
}

export function BattleFeedSection(props: {
  indexerNote: string | null;
  buys: BuyItem[] | null;
  address: string | undefined;
  decimals: number;
  buysNextOffset: number | null;
  loadingMoreBuys: boolean;
  handleLoadMoreBuys: () => Promise<void>;
  buildBuyNarrative: (buy: BuyItem, viewer: string | undefined) => FeedNarrative;
  buildBuyBattlePointBreakdown: (buy: BuyItem) => BattlePointBreakdownRow[];
  claimsNote: string | null;
  claims: CharmRedemptionItem[] | null;
  prizeDist: PrizeDistributionItem[] | null;
  prizePayouts: PrizePayoutItem[] | null;
  refApplied: ReferralAppliedItem[] | null;
}) {
  const {
    indexerNote,
    buys,
    address,
    decimals,
    buysNextOffset,
    loadingMoreBuys,
    handleLoadMoreBuys,
    buildBuyNarrative,
    buildBuyBattlePointBreakdown,
    claimsNote,
    claims,
    prizeDist,
    prizePayouts,
    refApplied,
  } = props;

  return (
    <PageSection
      title="Live battle feed"
      badgeLabel="Indexer mirror"
      badgeTone="info"
      lede="Recent buys should feel like moments: who changed the room, how the timer moved, what status shifted, and why spectators should care."
    >
      {indexerNote && <StatusMessage variant="placeholder">{indexerNote}</StatusMessage>}
      {!buys && !indexerNote && <StatusMessage variant="loading">Loading recent buys...</StatusMessage>}
      {buys && buys.length === 0 && !indexerNote && <StatusMessage variant="muted">No buys indexed yet.</StatusMessage>}
      {buys && buys.length > 0 && (
        <ul className="feed-grid">
          {buys.map((buy) => {
            const narrative = buildBuyNarrative(buy, address);
            const bpBreakdown = buildBuyBattlePointBreakdown(buy);
            return (
              <FeedCard
                key={`${buy.tx_hash}-${buy.log_index}`}
                eyebrow={narrative.eyebrow}
                title={
                  <>
                    <strong>{narrative.headline}</strong>
                    <AmountDisplay raw={buy.amount} decimals={decimals} />
                  </>
                }
                meta={
                  <>
                    {narrative.detail}
                    {bpBreakdown.length > 0
                      ? ` · ${bpBreakdown
                          .map((row) => `${row.label} ${row.value > 0n ? "+" : ""}${formatLocaleInteger(row.value)} BP`)
                          .join(" · ")}`
                      : ""}
                    {" "}· charms {formatCompactFromRaw(buy.charm_wad, 18)} ·{" "}
                    {buy.battle_points_after !== undefined
                      ? `BP ${formatLocaleInteger(BigInt(buy.battle_points_after))}`
                      : "BP n/a"}{" "}
                    · block {formatLocaleInteger(buy.block_number)} · tx <TxHash hash={buy.tx_hash} />
                  </>
                }
                tags={narrative.tags}
              />
            );
          })}
        </ul>
      )}
      {buysNextOffset !== null && (
        <p>
          <button
            type="button"
            className="btn-secondary"
            disabled={loadingMoreBuys}
            onClick={() => void handleLoadMoreBuys()}
          >
            {loadingMoreBuys ? "Loading..." : "Load more events"}
          </button>
        </p>
      )}
      <details className="podium-block accordion-panel">
        <summary>
          <strong>Settlement mirrors and referral rows</strong>
        </summary>
        <div className="accordion-panel__content">
          <div className="split-layout">
            <div className="podium-block">
              <h3>Charm redemptions</h3>
              {claimsNote && <StatusMessage variant="placeholder">{claimsNote}</StatusMessage>}
              {claims && claims.length > 0 ? (
                <ul className="event-list">
                  {claims.map((claim) => (
                    <li key={`${claim.tx_hash}-${claim.log_index}`}>
                      <span className="mono">{shortAddress(claim.buyer)}</span> redeemed{" "}
                      <AmountDisplay raw={claim.token_amount} decimals={18} /> · tx <TxHash hash={claim.tx_hash} />
                    </li>
                  ))}
                </ul>
              ) : (
                !claimsNote && <StatusMessage variant="muted">No charm redemptions indexed yet.</StatusMessage>
              )}
            </div>
            <div className="podium-block">
              <h3>Prize batch runs</h3>
              {prizeDist && prizeDist.length > 0 ? (
                <ul className="event-list">
                  {prizeDist.map((item) => (
                    <li key={`${item.tx_hash}-${item.log_index}`}>
                      PrizesDistributed · block {formatLocaleInteger(item.block_number)} · tx <TxHash hash={item.tx_hash} />
                    </li>
                  ))}
                </ul>
              ) : (
                <StatusMessage variant="muted">No prize batch runs indexed yet.</StatusMessage>
              )}
            </div>
            <div className="podium-block">
              <h3>Podium payouts</h3>
              {prizePayouts && prizePayouts.length > 0 ? (
                <ul className="event-list">
                  {prizePayouts.map((item) => (
                    <li key={`${item.tx_hash}-${item.log_index}`}>
                      <span className="mono">{shortAddress(item.winner)}</span> · category {item.category} · place{" "}
                      {item.placement} · <AmountDisplay raw={BigInt(item.amount)} decimals={decimals} /> · tx{" "}
                      <TxHash hash={item.tx_hash} />
                    </li>
                  ))}
                </ul>
              ) : (
                <StatusMessage variant="muted">No podium payout rows indexed yet.</StatusMessage>
              )}
            </div>
            <div className="podium-block">
              <h3>Referral buys</h3>
              {!address && <StatusMessage variant="placeholder">Connect a wallet to see your referral rows.</StatusMessage>}
              {address && refApplied && refApplied.length > 0 ? (
                <ul className="event-list">
                  {refApplied.map((item) => (
                    <li key={`${item.tx_hash}-${item.log_index}`}>
                      buyer <span className="mono">{shortAddress(item.buyer)}</span> · referrer CHARM{" "}
                      <AmountDisplay raw={BigInt(item.referrer_amount)} decimals={18} /> · tx <TxHash hash={item.tx_hash} />
                    </li>
                  ))}
                </ul>
              ) : (
                address && <StatusMessage variant="muted">No referral rows indexed for this wallet.</StatusMessage>
              )}
            </div>
          </div>
        </div>
      </details>
    </PageSection>
  );
}

export function RawDataAccordion(props: {
  coreTcData: readonly unknown[] | undefined;
  saleStart: { status: "success" | "failure"; result?: unknown } | undefined;
  deadline: { status: "success" | "failure"; result?: unknown } | undefined;
  remaining: number | undefined;
  totalRaised: { status: "success" | "failure"; result?: unknown } | undefined;
  ended: { status: "success" | "failure"; result?: unknown } | undefined;
  maxBuyAmount: bigint | undefined;
  prizesDistributedResult: { status: "success" | "failure"; result?: unknown } | undefined;
  isConnected: boolean;
  charmWeightResult: { status: "success" | "failure"; result?: unknown } | undefined;
  buyCountResult: { status: "success" | "failure"; result?: unknown } | undefined;
  timerAddedResult: { status: "success" | "failure"; result?: unknown } | undefined;
  battlePointsResult: { status: "success" | "failure"; result?: unknown } | undefined;
  activeStreakResult: { status: "success" | "failure"; result?: unknown } | undefined;
  bestStreakResult: { status: "success" | "failure"; result?: unknown } | undefined;
  pendingRevengeStealer: string | undefined;
  revengeDeadlineSec: bigint;
  buyerStats: TimecurveBuyerStats | null;
  initialMinBuyResult: { status: "success" | "failure"; result?: unknown } | undefined;
  growthRateWadResult: { status: "success" | "failure"; result?: unknown } | undefined;
  timerExtensionSecResult: { status: "success" | "failure"; result?: unknown } | undefined;
  initialTimerSecResult: { status: "success" | "failure"; result?: unknown } | undefined;
  timerCapSecResult: { status: "success" | "failure"; result?: unknown } | undefined;
  totalTokensForSaleResult: { status: "success" | "failure"; result?: unknown } | undefined;
  sinkReads: readonly { status: "success" | "failure"; result?: unknown }[] | undefined;
  liquidityAnchors:
    | {
        clearing: bigint;
        launch: bigint;
        kLo: bigint;
      }
    | null
    | undefined;
  minSpendCurvePoints: { minSpend: bigint }[];
  decimals: number;
  launchedDec: number;
}) {
  const {
    coreTcData,
    saleStart,
    deadline,
    remaining,
    totalRaised,
    ended,
    maxBuyAmount,
    prizesDistributedResult,
    isConnected,
    charmWeightResult,
    buyCountResult,
    timerAddedResult,
    battlePointsResult,
    activeStreakResult,
    bestStreakResult,
    pendingRevengeStealer,
    revengeDeadlineSec,
    buyerStats,
    initialMinBuyResult,
    growthRateWadResult,
    timerExtensionSecResult,
    initialTimerSecResult,
    timerCapSecResult,
    totalTokensForSaleResult,
    sinkReads,
    liquidityAnchors,
    minSpendCurvePoints,
    decimals,
    launchedDec,
  } = props;

  return (
    <details className="data-panel accordion-panel">
      <summary>
        <div className="section-heading__copy">
          <PageBadge label="Protocol detail" tone="info" />
          <h2>Raw contract and operator context</h2>
          <div className="section-heading__lede">
            Player-facing buy, timer, prizes, and PvP surfaces now come first. Open this for raw onchain mirrors,
            immutable parameters, and launch-routing context.
          </div>
        </div>
      </summary>
      <div className="accordion-panel__content">
        <div className="split-layout">
          <div className="podium-block">
            <h3>Onchain snapshot</h3>
            {coreTcData && (
              <dl className="kv">
                <dt>saleStart</dt>
                <dd>{saleStart?.status === "success" ? <UnixTimestampDisplay raw={saleStart.result as bigint} /> : "—"}</dd>
                <dt>deadline</dt>
                <dd>{deadline?.status === "success" ? <UnixTimestampDisplay raw={deadline.result as bigint} /> : "—"}</dd>
                <dt>time remaining</dt>
                <dd>{remaining !== undefined ? `${formatLocaleInteger(remaining)}s` : "—"}</dd>
                <dt>totalRaised</dt>
                <dd>{totalRaised?.status === "success" ? <AmountDisplay raw={totalRaised.result as bigint} decimals={decimals} /> : "—"}</dd>
                <dt>ended</dt>
                <dd>{ended?.status === "success" ? String(ended.result) : "—"}</dd>
                <dt>max buy</dt>
                <dd>{maxBuyAmount !== undefined ? <AmountDisplay raw={maxBuyAmount} decimals={decimals} /> : "—"}</dd>
                <dt>prizesDistributed</dt>
                <dd>{prizesDistributedResult?.status === "success" ? String(prizesDistributedResult.result) : "—"}</dd>
              </dl>
            )}
          </div>
          <div className="podium-block">
            <h3>Your participation</h3>
            {!isConnected && <StatusMessage variant="placeholder">Connect a wallet to see your deeper onchain stats.</StatusMessage>}
            {isConnected && (
              <>
                <dl className="kv">
                  <dt>charmWeight</dt>
                  <dd>{charmWeightResult?.status === "success" ? <AmountDisplay raw={charmWeightResult.result as bigint} decimals={18} /> : "—"}</dd>
                  <dt>buyCount</dt>
                  <dd>{buyCountResult?.status === "success" ? formatLocaleInteger(buyCountResult.result as bigint) : "—"}</dd>
                  <dt>timer added</dt>
                  <dd>{timerAddedResult?.status === "success" ? `${formatLocaleInteger(timerAddedResult.result as bigint)} s` : "—"}</dd>
                  <dt>battlePoints</dt>
                  <dd>{battlePointsResult?.status === "success" ? formatLocaleInteger(battlePointsResult.result as bigint) : "—"}</dd>
                  <dt>active streak</dt>
                  <dd>{activeStreakResult?.status === "success" ? formatLocaleInteger(activeStreakResult.result as bigint) : "—"}</dd>
                  <dt>best streak</dt>
                  <dd>{bestStreakResult?.status === "success" ? formatLocaleInteger(bestStreakResult.result as bigint) : "—"}</dd>
                  <dt>revenge</dt>
                  <dd className="mono">
                    {pendingRevengeStealer && pendingRevengeStealer !== "0x0000000000000000000000000000000000000000"
                      ? `${shortAddress(pendingRevengeStealer)} · ${formatUnixSecIsoUtc(revengeDeadlineSec)}`
                      : "—"}
                  </dd>
                </dl>
                {buyerStats && (
                  <StatusMessage variant="muted">
                    Indexer mirror: charm weight {formatCompactFromRaw(buyerStats.indexed_charm_weight, 18)} · buys{" "}
                    {formatLocaleInteger(buyerStats.indexed_buy_count)}
                  </StatusMessage>
                )}
              </>
            )}
          </div>
          <div className="podium-block">
            <h3>Immutable sale parameters</h3>
            {coreTcData && (
              <dl className="kv">
                <dt>envelope ref WAD</dt>
                <dd>{initialMinBuyResult?.status === "success" ? <AmountDisplay raw={initialMinBuyResult.result as bigint} decimals={18} /> : "—"}</dd>
                <dt>growthRateWad</dt>
                <dd className="mono">{growthRateWadResult?.status === "success" ? formatCompactFromRaw(growthRateWadResult.result as bigint, 18) : "—"}</dd>
                <dt>timerExtensionSec</dt>
                <dd>{timerExtensionSecResult?.status === "success" ? formatLocaleInteger(timerExtensionSecResult.result as bigint) : "—"}</dd>
                <dt>initialTimerSec</dt>
                <dd>{initialTimerSecResult?.status === "success" ? formatLocaleInteger(initialTimerSecResult.result as bigint) : "—"}</dd>
                <dt>timerCapSec</dt>
                <dd>{timerCapSecResult?.status === "success" ? formatLocaleInteger(timerCapSecResult.result as bigint) : "—"}</dd>
                <dt>totalTokensForSale</dt>
                <dd>{totalTokensForSaleResult?.status === "success" ? <AmountDisplay raw={totalTokensForSaleResult.result as bigint} decimals={18} /> : "—"}</dd>
              </dl>
            )}
          </div>
          <div className="podium-block">
            <h3>Reserve routing and launch anchors</h3>
            <ul className="event-list">
              {(
                [
                  ["DOUB LP (locked SIR / Kumbaya)", RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity],
                  ["CL8Y buy-and-burn", RESERVE_FEE_ROUTING_BPS.cl8yBuyAndBurn],
                  ["Podium pool", RESERVE_FEE_ROUTING_BPS.podiumPool],
                  ["Team / reserved", RESERVE_FEE_ROUTING_BPS.team],
                  ["Rabbit Treasury", RESERVE_FEE_ROUTING_BPS.rabbitTreasury],
                ] as const
              ).map(([label, bps], index) => {
                const row = sinkReads?.[index];
                const onchain = row?.status === "success" ? Number((row.result as readonly [unknown, number])[1]) : null;
                return (
                  <li key={label}>
                    <strong>{label}</strong> · policy {formatBpsAsPercent(bps)}
                    {onchain !== null ? ` · onchain ${formatBpsAsPercent(onchain)}` : ""}
                  </li>
                );
              })}
            </ul>
            {liquidityAnchors ? (
              <dl className="kv" style={{ marginTop: "0.85rem" }}>
                <dt>Projected reserve / DOUB</dt>
                <dd className="mono">{formatCompactFromRaw(liquidityAnchors.clearing, 18)}</dd>
                <dt>Launch anchor</dt>
                <dd className="mono">{formatCompactFromRaw(liquidityAnchors.launch, 18)}</dd>
                <dt>Kumbaya lower band</dt>
                <dd className="mono">{formatCompactFromRaw(liquidityAnchors.kLo, 18)}</dd>
              </dl>
            ) : (
              <StatusMessage variant="muted">Waiting for sale totals to project liquidity anchors.</StatusMessage>
            )}
          </div>
        </div>
        <div className="split-layout">
          <div className="podium-block">
            <h3>Charm redemption curve</h3>
            {coreTcData && totalRaised?.status === "success" && totalTokensForSaleResult?.status === "success" && (
              <CharmRedemptionCurve
                totalRaised={totalRaised.result as bigint}
                totalTokensForSale={totalTokensForSaleResult.result as bigint}
                acceptedDecimals={decimals}
                launchedDecimals={launchedDec}
                userCharmWeight={charmWeightResult?.status === "success" ? (charmWeightResult.result as bigint) : undefined}
                saleStarted={saleStart?.status === "success" && (saleStart.result as bigint) > 0n}
              />
            )}
          </div>
          <div className="podium-block">
            <h3>Min gross spend curve</h3>
            {minSpendCurvePoints.length > 1 ? (
              <svg className="epoch-chart" viewBox="0 0 400 120" role="img" aria-label="Min gross spend curve">
                {(() => {
                  const vals = minSpendCurvePoints.map((point) => Number(point.minSpend));
                  const vmin = Math.min(...vals);
                  const vmax = Math.max(...vals);
                  const span = Math.max(vmax - vmin, 1);
                  return (
                    <polyline
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth="3"
                      points={minSpendCurvePoints
                        .map((point, index) => {
                          const x = (index / (minSpendCurvePoints.length - 1)) * 380 + 10;
                          const y = 110 - ((Number(point.minSpend) - vmin) / span) * 100;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  );
                })()}
              </svg>
            ) : (
              <StatusMessage variant="muted">Curve appears after the sale has started.</StatusMessage>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

export function StandingsVisuals(props: {
  buyHistoryPoints: BuyHistoryPoint[];
  decimals: number;
}) {
  const { buyHistoryPoints, decimals } = props;
  if (buyHistoryPoints.length === 0) {
    return null;
  }
  const maxRaised = buyHistoryPoints[buyHistoryPoints.length - 1]?.totalRaisedAfter ?? 0n;

  return (
    <div className="race-history-grid">
      <div className="history-card">
        <h3>Deadline pressure</h3>
        <div className="timeline-strip" aria-label="Recent timer swing history">
          {buyHistoryPoints.map((point) => (
            <div key={point.key} className="timeline-strip__item">
              <div
                className={["timeline-strip__bar", point.hardReset ? "timeline-strip__bar--reset" : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{ width: `${Math.max(point.width, 10)}%` }}
              />
              <div className="timeline-strip__meta">
                <strong>{point.hardReset ? "Hard reset" : `+${formatLocaleInteger(point.secondsAdded)}s`}</strong>
                <span>{point.buyer}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="history-card">
        <h3>Raise climb</h3>
        <div className="timeline-strip" aria-label="Recent raise progress history">
          {buyHistoryPoints.map((point) => {
            const raiseWidth = maxRaised > 0n ? Number((point.totalRaisedAfter * 100n) / maxRaised) : 0;
            return (
              <div key={`${point.key}-raised`} className="timeline-strip__item">
                <div className="timeline-strip__bar timeline-strip__bar--raised" style={{ width: `${Math.max(raiseWidth, 10)}%` }} />
                <div className="timeline-strip__meta">
                  <strong>
                    <AmountDisplay raw={point.totalRaisedAfter} decimals={decimals} />
                  </strong>
                  <span>{point.meta}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
