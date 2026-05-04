// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { isAddress } from "viem";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AddressInline } from "@/components/AddressInline";
import { CharmRedemptionCurve } from "@/components/CharmRedemptionCurve";
import { TxHash } from "@/components/TxHash";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { humanizeKvLabel } from "@/lib/humanizeIdentifier";
import type { SerializableContractRead } from "@/lib/serializeContractRead";
import { formatBpsAsPercent, formatLocaleInteger, formatUnixSecIsoUtc } from "@/lib/formatAmount";
import { megaEtherscanAddressUrl } from "@/lib/megaEtherscan";
import type {
  BattlePointBreakdownRow,
  BuyHistoryPoint,
  FeedNarrative,
  WarbowPreflightNarrative,
} from "@/lib/timeCurveUx";
import { RESERVE_FEE_ROUTING_BPS } from "@/lib/timeCurvePodiumMath";
import type { WalletFormatShort } from "@/lib/addressFormat";
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

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

function PodiumAddressExplorerInline(props: {
  address: string | undefined;
  formatWallet: WalletFormatShort;
  size?: number;
}) {
  const { address: addr, formatWallet, size = 16 } = props;
  const raw = addr?.trim();
  const linked = Boolean(raw && isAddress(raw as `0x${string}`) && raw.toLowerCase() !== ZERO_ADDR);
  const href = linked && raw ? megaEtherscanAddressUrl(raw) : undefined;
  const body = <AddressInline address={addr} formatWallet={formatWallet} fallback="—" size={size} />;
  if (!href) {
    return body;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="cursor-external-link podium-address-explorer">
      {body}
    </a>
  );
}

function WarbowPendingFlagChainPanel(props: {
  readsReady: boolean;
  saleActive: boolean;
  owner: `0x${string}` | undefined;
  /** Base-10 seconds (string avoids `BigInt` in React props for dev serialization). */
  plantAtSec: string;
  silenceSec: string;
  ledgerSecInt: number;
  viewer: string | undefined;
  formatWallet: WalletFormatShort;
}) {
  const { readsReady, saleActive, owner, plantAtSec: plantAtSecStr, silenceSec: silenceSecStr, ledgerSecInt, viewer, formatWallet } =
    props;

  if (!readsReady || owner === undefined) {
    return <StatusMessage variant="loading">Loading pending WarBow flag from chain…</StatusMessage>;
  }

  let plantAtSec: bigint;
  let silenceSec: bigint;
  try {
    plantAtSec = BigInt(plantAtSecStr);
    silenceSec = BigInt(silenceSecStr);
  } catch {
    return <StatusMessage variant="error">Invalid flag timing reads from chain.</StatusMessage>;
  }

  const hasPending = owner !== ZERO_ADDR && plantAtSec > 0n;
  const silenceEnd = plantAtSec + silenceSec;
  const now = BigInt(ledgerSecInt);
  const inSilence = hasPending && now < silenceEnd;
  const remainingSec = inSilence ? Number(silenceEnd - now) : 0;
  const viewerHolds =
    Boolean(viewer && owner && viewer.toLowerCase() === owner.toLowerCase());

  return (
    <div className="podium-block">
      <h3>Pending WarBow flag (chain)</h3>
      <p className="muted">
        One global slot: <code>warbowPendingFlagOwner</code> / <code>warbowPendingFlagPlantAt</code>. Claims and
        interrupts also appear as <strong>Flag won</strong> / <strong>Flag destroyed</strong> rows in the rivalry feed
        below.
      </p>
      {!saleActive && (
        <StatusMessage variant="muted">Sale is not live — flag claims are closed even if a slot still reads non-zero.</StatusMessage>
      )}
      {!hasPending && (
        <StatusMessage variant="muted">
          <strong>No pending flag.</strong> The next successful buy assigns the pending slot to that buyer (any prior
          holder was cleared).
        </StatusMessage>
      )}
      {hasPending && inSilence && (
        <StatusMessage variant="muted">
          <strong>Silence window active.</strong> Holder <AddressInline address={owner} formatWallet={formatWallet} size={16} /> — about{" "}
          <strong>{formatLocaleInteger(remainingSec)}</strong>s remaining until the holder may claim (ends{" "}
          <UnixTimestampDisplay raw={silenceEnd.toString()} />
          ). Countdown uses the Arena ledger clock (not the buy indexer).
          {viewerHolds ? " You hold this slot." : " Another address holds the slot."}
        </StatusMessage>
      )}
      {hasPending && !inSilence && saleActive && (
        <StatusMessage variant="muted">
          <strong>Claim window open.</strong> <AddressInline address={owner} formatWallet={formatWallet} size={16} /> may call <code>claimWarBowFlag</code> for the
          silence bonus, or another buy will clear the slot
          {viewerHolds ? " (you can use Claim flag above)." : "."}
        </StatusMessage>
      )}
      {hasPending && !inSilence && !saleActive && (
        <StatusMessage variant="muted">
          Silence ended at <UnixTimestampDisplay raw={silenceEnd.toString()} />, but the sale is not active — treat
          onchain reads as authoritative.
        </StatusMessage>
      )}
    </div>
  );
}

export function WhatMattersSection(props: {
  saleActive: boolean;
  saleEnded: boolean;
  whatMattersNowCards: { label: string; value: ReactNode; meta: ReactNode }[];
  minBuy: SerializableContractRead | undefined;
  decimals: number;
  expectedTokenFromCharms: string | undefined;
  charmWeightResult: SerializableContractRead | undefined;
  podiumPoolBal: string | undefined;
  battlePointsResult: SerializableContractRead | undefined;
  totalRaisedResult: SerializableContractRead | undefined;
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
      spotlight
      className="timecurve-panel timecurve-panel--summary"
      cutout={{
        src: "/art/cutouts/loading-mascot-circle.png",
        width: 164,
        height: 164,
        className: "panel-cutout panel-cutout--summary-left cutout-decoration--float",
      }}
      lede="Start here for the room read: what matters most right now, what your wallet already has at stake, and which chase is still alive."
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
            minBuy?.status === "success" && minBuy.result !== undefined ? (
              <AmountDisplay raw={minBuy.result} decimals={decimals} />
            ) : (
              "—"
            )
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
            ) : charmWeightResult?.status === "success" && charmWeightResult.result !== undefined ? (
              <AmountDisplay raw={charmWeightResult.result} decimals={18} />
            ) : (
              "—"
            )
          }
          meta={saleEnded ? "Projected launched-token claim" : "Onchain charm weight for your wallet"}
        />
        <StatCard
          label="Podium pool"
          value={podiumPoolBal !== undefined ? <AmountDisplay raw={podiumPoolBal} decimals={decimals} /> : "—"}
          meta="Reserve pool for the four onchain prize categories"
        />
        <StatCard
          label={saleActive ? "Battle Points" : "Total raised"}
          value={
            saleActive ? (
              battlePointsResult?.status === "success" && battlePointsResult.result !== undefined ? (
                formatLocaleInteger(BigInt(battlePointsResult.result))
              ) : (
                "—"
              )
            ) : totalRaisedResult?.status === "success" && totalRaisedResult.result !== undefined ? (
              <AmountDisplay raw={totalRaisedResult.result} decimals={decimals} />
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
  warbowBypassBurnWad: string;
  warbowGuardBurnWad: string;
  warbowActionHint: string;
  warbowFlagSilenceSec: string;
  warbowFlagClaimBp: string;
  warbowPendingFlagReadsReady: boolean;
  warbowPendingFlagOwner: `0x${string}` | undefined;
  warbowPendingFlagPlantAtSec: string;
  ledgerSecInt: number;
  formatWallet: WalletFormatShort;
  isConnected: boolean;
  stealVictimInput: string;
  setStealVictimInput: (value: string) => void;
  stealVictim?: string;
  victimStealsToday: string | undefined;
  attackerStealsToday: string | undefined;
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
  flagSilenceEndSec: string;
  hasRevengeOpen: boolean;
  secondaryButtonMotion: MotionProps;
  stealPreflight: WarbowPreflightNarrative;
  warbowPreflightIssue: string | null;
  viewerBattlePoints: string | undefined;
  victimBattlePoints: string | undefined;
  gasWarbowSteal: string | undefined;
  gasWarbowGuard: string | undefined;
  gasWarbowFlag: string | undefined;
  gasWarbowRevenge: string | undefined;
}) {
  const {
    saleActive,
    warbowMaxSteals,
    warbowBypassBurnWad,
    warbowGuardBurnWad,
    warbowActionHint,
    warbowFlagSilenceSec,
    warbowFlagClaimBp,
    warbowPendingFlagReadsReady,
    warbowPendingFlagOwner,
    warbowPendingFlagPlantAtSec,
    ledgerSecInt,
    formatWallet,
    isConnected,
    stealVictimInput,
    setStealVictimInput,
    stealVictim,
    victimStealsToday,
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
    victimBattlePoints,
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
      lede="WarBow is the PvP pressure layer: steal when you are behind, guard when you are exposed, revenge once, and claim the flag when the room goes quiet."
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
            the configured window. After a buy, silence for {formatLocaleInteger(BigInt(warbowFlagSilenceSec))}s lets the buyer
            claim +{formatLocaleInteger(BigInt(warbowFlagClaimBp))} BP.
          </StatusMessage>
        </div>
      </details>
      <WarbowPendingFlagChainPanel
        readsReady={warbowPendingFlagReadsReady}
        saleActive={saleActive}
        owner={warbowPendingFlagOwner}
        plantAtSec={warbowPendingFlagPlantAtSec}
        silenceSec={warbowFlagSilenceSec}
        ledgerSecInt={ledgerSecInt}
        viewer={address}
        formatWallet={formatWallet}
      />
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
          {stealVictim && victimStealsToday !== undefined && (
            <StatusMessage variant="muted">
              Victim steals received today: {formatLocaleInteger(BigInt(victimStealsToday))} /{" "}
              {formatLocaleInteger(BigInt(warbowMaxSteals))}
            </StatusMessage>
          )}
          {stealVictim && (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Your BP"
                  value={viewerBattlePoints !== undefined ? formatLocaleInteger(BigInt(viewerBattlePoints)) : "—"}
                  meta="Live contract read"
                />
                <StatCard
                  label="Victim BP"
                  value={victimBattlePoints !== undefined ? formatLocaleInteger(BigInt(victimBattlePoints)) : "—"}
                  meta="Must be at least 2x your BP"
                />
                <StatCard
                  label="Steal pressure today"
                  value={
                    victimStealsToday !== undefined
                      ? `${formatLocaleInteger(BigInt(victimStealsToday))} / ${formatLocaleInteger(BigInt(warbowMaxSteals))}`
                      : "—"
                  }
                  meta="Per-victim UTC-day cap"
                />
                <StatCard
                  label="Steal gas"
                  value={gasWarbowSteal !== undefined ? `~${formatLocaleInteger(BigInt(gasWarbowSteal))}` : "Pending"}
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
              {gasWarbowGuard !== undefined && <>Guard gas ~{formatLocaleInteger(BigInt(gasWarbowGuard))}</>}
              {gasWarbowGuard !== undefined && (gasWarbowFlag !== undefined || gasWarbowRevenge !== undefined) && <> · </>}
              {gasWarbowFlag !== undefined && <>Flag gas ~{formatLocaleInteger(BigInt(gasWarbowFlag))}</>}
              {gasWarbowFlag !== undefined && gasWarbowRevenge !== undefined && <> · </>}
              {gasWarbowRevenge !== undefined && <>Revenge gas ~{formatLocaleInteger(BigInt(gasWarbowRevenge))}</>}
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
  podiumPayoutPreview: { places: readonly [string, string, string] }[];
  decimals: number;
  podiumLoading: boolean;
  podiumRows: { winners: [`0x${string}`, `0x${string}`, `0x${string}`]; values: readonly [string, string, string] }[];
  address: string | undefined;
  formatPodiumLeaderboardValue: (categoryIndex: number, raw: string) => string;
  formatWallet: WalletFormatShort;
}) {
  const { podiumPayoutPreview, decimals, podiumLoading, podiumRows, address, formatPodiumLeaderboardValue, formatWallet } =
    props;
  return (
    <PageSection
      title="Podiums and prizes"
      badgeLabel="Reserve prize podiums"
      badgeTone="warning"
      lede="Four reserve tracks: Last Buy, WarBow (top Battle Points), Defended Streak, and Time Booster. Each pays 1st / 2nd / 3rd in CL8Y from the podium pool."
    >
      <div className="podium-preview">
        {podiumPayoutPreview.map((row, idx) => {
          const onchainPodium = podiumRows[idx];
          return (
            <div key={idx} className="podium-block">
              <h3>{PODIUM_LABELS[idx] ?? `Category ${idx}`}</h3>
              <p className="muted">{PODIUM_HELP[idx]}</p>
              <RankingList
                rows={(["1st", "2nd", "3rd"] as const).map((lab, placeIndex) => ({
                  key: `preview-${idx}-${lab}`,
                  rank: placeIndex + 1,
                  label: (
                    <PodiumAddressExplorerInline
                      address={onchainPodium?.winners[placeIndex]}
                      formatWallet={formatWallet}
                      size={16}
                    />
                  ),
                  value: <AmountDisplay raw={row.places[placeIndex]} decimals={decimals} />,
                  meta: placeIndex === 0 ? "Largest reserve slice in category" : "Reserve payout preview",
                  highlight: Boolean(
                    address &&
                      onchainPodium?.winners[placeIndex]?.toLowerCase() === address.toLowerCase(),
                  ),
                }))}
                emptyText="Waiting for podium pool balance."
              />
            </div>
          );
        })}
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
                        label: (
                          <PodiumAddressExplorerInline address={winner} formatWallet={formatWallet} size={16} />
                        ),
                        value: formatPodiumLeaderboardValue(index, row.values[placeIndex] ?? "0"),
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
  formatWallet: WalletFormatShort;
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
    formatWallet,
  } = props;

  return (
    <PageSection
      title="Live battle feed"
      badgeLabel="Indexer mirror"
      badgeTone="info"
      spotlight
      className="timecurve-panel timecurve-panel--feed"
      cutout={{
        src: "/art/cutouts/mascot-bunnyleprechaungirl-wave-cutout.png",
        width: 256,
        height: 256,
        className: "panel-cutout panel-cutout--mid-right",
      }}
      lede="Follow the latest momentum swings, timer saves, and standout plays as they land."
    >
      {indexerNote && <StatusMessage variant="placeholder">{indexerNote}</StatusMessage>}
      {!buys && !indexerNote && <StatusMessage variant="loading">Loading recent buys...</StatusMessage>}
      {buys && buys.length === 0 && !indexerNote && <StatusMessage variant="muted">No buys indexed yet.</StatusMessage>}
      {buys && buys.length > 0 && (
        <ul className="feed-grid feed-grid--battle">
          {buys.map((buy) => {
            const narrative = buildBuyNarrative(buy, address);
            const bpBreakdown = buildBuyBattlePointBreakdown(buy);
            return (
              <FeedCard
                key={`${buy.tx_hash}-${buy.log_index}`}
                className="feed-card--battle"
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
                      <AddressInline address={claim.buyer} formatWallet={formatWallet} size={16} />{" "}
                      redeemed{" "}
                      <AmountDisplay raw={String(claim.token_amount)} decimals={18} /> · tx <TxHash hash={claim.tx_hash} />
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
                  {prizeDist.map((item) => {
                    const kind = item.kind ?? "drained";
                    return (
                    <li key={`${item.tx_hash}-${item.log_index}-${kind}`}>
                      {kind === "empty_podium" ? (
                        <>
                          PrizesSettledEmptyPodiumPool (
                          <AddressInline address={item.podium_pool ?? ""} formatWallet={formatWallet} size={14} />)
                        </>
                      ) : (
                        <>PrizesDistributed</>
                      )}{" "}
                      · block {formatLocaleInteger(item.block_number)} · tx <TxHash hash={item.tx_hash} />
                    </li>
                    );
                  })}
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
                      <AddressInline address={item.winner} formatWallet={formatWallet} size={16} />{" "}
                      · category {item.category} · place{" "}
                      {item.placement} · <AmountDisplay raw={String(item.amount)} decimals={decimals} /> · tx{" "}
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
                      buyer{" "}
                      <AddressInline address={item.buyer} formatWallet={formatWallet} size={16} />{" "}
                      · referrer CHARM{" "}
                      <AmountDisplay raw={String(item.referrer_amount)} decimals={18} /> · tx <TxHash hash={item.tx_hash} />
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
  hasCoreContractReads: boolean;
  saleStart: SerializableContractRead | undefined;
  deadline: SerializableContractRead | undefined;
  secondsRemaining: number | undefined;
  /** Drives the raw **seconds** row label ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)). */
  countdownSecondsContext?: "untilOpen" | "untilRoundDeadline" | "generic";
  totalRaised: SerializableContractRead | undefined;
  ended: SerializableContractRead | undefined;
  maxBuyAmount: string | undefined;
  prizesDistributedResult: SerializableContractRead | undefined;
  isConnected: boolean;
  charmWeightResult: SerializableContractRead | undefined;
  buyCountResult: SerializableContractRead | undefined;
  timerAddedResult: SerializableContractRead | undefined;
  battlePointsResult: SerializableContractRead | undefined;
  activeStreakResult: SerializableContractRead | undefined;
  bestStreakResult: SerializableContractRead | undefined;
  pendingRevengeStealer: string | undefined;
  revengeDeadlineSec: string;
  buyerStats: TimecurveBuyerStats | null;
  initialMinBuyResult: SerializableContractRead | undefined;
  growthRateWadResult: SerializableContractRead | undefined;
  timerExtensionSecResult: SerializableContractRead | undefined;
  initialTimerSecResult: SerializableContractRead | undefined;
  timerCapSecResult: SerializableContractRead | undefined;
  totalTokensForSaleResult: SerializableContractRead | undefined;
  sinkReads: readonly SerializableContractRead[] | undefined;
  liquidityAnchors:
    | {
        clearing: string;
        launch: string;
        kLo: string;
      }
    | null
    | undefined;
  minSpendCurvePoints: { minSpend: string }[];
  decimals: number;
  launchedDec: number;
  formatWallet: WalletFormatShort;
}) {
  const {
    hasCoreContractReads: coreTcData,
    saleStart,
    deadline,
    secondsRemaining,
    countdownSecondsContext = "generic",
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
    formatWallet,
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
                <dt>{humanizeKvLabel("saleStart")}</dt>
                <dd>
                  {saleStart?.status === "success" && saleStart.result !== undefined ? (
                    <UnixTimestampDisplay raw={saleStart.result} />
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>{humanizeKvLabel("deadline")}</dt>
                <dd>
                  {deadline?.status === "success" && deadline.result !== undefined ? (
                    <UnixTimestampDisplay raw={deadline.result} />
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>
                  {countdownSecondsContext === "untilOpen"
                    ? "Seconds until TimeCurve opens (hero clock)"
                    : countdownSecondsContext === "untilRoundDeadline"
                      ? "Seconds until round deadline (hero clock)"
                      : "seconds remaining"}
                </dt>
                <dd>
                  {secondsRemaining !== undefined
                    ? `${formatLocaleInteger(Math.floor(secondsRemaining))}s`
                    : "—"}
                </dd>
                <dt>{humanizeKvLabel("totalRaised")}</dt>
                <dd>
                  {totalRaised?.status === "success" && totalRaised.result !== undefined ? (
                    <AmountDisplay raw={totalRaised.result} decimals={decimals} />
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>{humanizeKvLabel("ended")}</dt>
                <dd>{ended?.status === "success" && ended.result !== undefined ? ended.result : "—"}</dd>
                <dt>max buy</dt>
                <dd>{maxBuyAmount !== undefined ? <AmountDisplay raw={maxBuyAmount} decimals={decimals} /> : "—"}</dd>
                <dt>{humanizeKvLabel("prizesDistributed")}</dt>
                <dd>
                  {prizesDistributedResult?.status === "success" && prizesDistributedResult.result !== undefined
                    ? prizesDistributedResult.result
                    : "—"}
                </dd>
              </dl>
            )}
          </div>
          <div className="podium-block">
            <h3>Your participation</h3>
            {!isConnected && <StatusMessage variant="placeholder">Connect a wallet to see your deeper onchain stats.</StatusMessage>}
            {isConnected && (
              <>
                <dl className="kv">
                  <dt>{humanizeKvLabel("charmWeight")}</dt>
                  <dd>
                    {charmWeightResult?.status === "success" && charmWeightResult.result !== undefined ? (
                      <AmountDisplay raw={charmWeightResult.result} decimals={18} />
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt>{humanizeKvLabel("buyCount")}</dt>
                  <dd>
                    {buyCountResult?.status === "success" && buyCountResult.result !== undefined
                      ? formatLocaleInteger(BigInt(buyCountResult.result))
                      : "—"}
                  </dd>
                  <dt>timer added</dt>
                  <dd>
                    {timerAddedResult?.status === "success" && timerAddedResult.result !== undefined
                      ? `${formatLocaleInteger(BigInt(timerAddedResult.result))} s`
                      : "—"}
                  </dd>
                  <dt>{humanizeKvLabel("battlePoints")}</dt>
                  <dd>
                    {battlePointsResult?.status === "success" && battlePointsResult.result !== undefined
                      ? formatLocaleInteger(BigInt(battlePointsResult.result))
                      : "—"}
                  </dd>
                  <dt>active streak</dt>
                  <dd>
                    {activeStreakResult?.status === "success" && activeStreakResult.result !== undefined
                      ? formatLocaleInteger(BigInt(activeStreakResult.result))
                      : "—"}
                  </dd>
                  <dt>best streak</dt>
                  <dd>
                    {bestStreakResult?.status === "success" && bestStreakResult.result !== undefined
                      ? formatLocaleInteger(BigInt(bestStreakResult.result))
                      : "—"}
                  </dd>
                  <dt>revenge</dt>
                  <dd>
                    {pendingRevengeStealer && pendingRevengeStealer !== ZERO_ADDR ? (
                      <>
                        <AddressInline
                          address={pendingRevengeStealer}
                          formatWallet={formatWallet}
                          size={16}
                        />{" "}
                        <span className="mono">· {formatUnixSecIsoUtc(BigInt(revengeDeadlineSec))}</span>
                      </>
                    ) : (
                      "—"
                    )}
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
                <dd>
                  {initialMinBuyResult?.status === "success" && initialMinBuyResult.result !== undefined ? (
                    <AmountDisplay raw={initialMinBuyResult.result} decimals={18} />
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>{humanizeKvLabel("growthRateWad")}</dt>
                <dd className="mono">
                  {growthRateWadResult?.status === "success" && growthRateWadResult.result !== undefined
                    ? formatCompactFromRaw(growthRateWadResult.result, 18)
                    : "—"}
                </dd>
                <dt>{humanizeKvLabel("timerExtensionSec")}</dt>
                <dd>
                  {timerExtensionSecResult?.status === "success" && timerExtensionSecResult.result !== undefined
                    ? formatLocaleInteger(BigInt(timerExtensionSecResult.result))
                    : "—"}
                </dd>
                <dt>{humanizeKvLabel("initialTimerSec")}</dt>
                <dd>
                  {initialTimerSecResult?.status === "success" && initialTimerSecResult.result !== undefined
                    ? formatLocaleInteger(BigInt(initialTimerSecResult.result))
                    : "—"}
                </dd>
                <dt>{humanizeKvLabel("timerCapSec")}</dt>
                <dd>
                  {timerCapSecResult?.status === "success" && timerCapSecResult.result !== undefined
                    ? formatLocaleInteger(BigInt(timerCapSecResult.result))
                    : "—"}
                </dd>
                <dt>{humanizeKvLabel("totalTokensForSale")}</dt>
                <dd>
                  {totalTokensForSaleResult?.status === "success" && totalTokensForSaleResult.result !== undefined ? (
                    <AmountDisplay raw={totalTokensForSaleResult.result} decimals={18} />
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
            )}
          </div>
          <div className="podium-block">
            <h3>Reserve routing and launch anchors</h3>
            <ul className="event-list">
              {(
                [
                  ["DOUB/CL8Y LP (locked SIR / Kumbaya)", RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity],
                  ["CL8Y burned (sale proceeds)", RESERVE_FEE_ROUTING_BPS.cl8yBurned],
                  ["Podium pool", RESERVE_FEE_ROUTING_BPS.podiumPool],
                  ["Team / reserved", RESERVE_FEE_ROUTING_BPS.team],
                  ["Rabbit Treasury", RESERVE_FEE_ROUTING_BPS.rabbitTreasury],
                ] as const
              ).map(([label, bps], index) => {
                const row = sinkReads?.[index];
                const onchain =
                  row?.status === "success" && row.result
                    ? Number((JSON.parse(row.result) as readonly [unknown, number])[1])
                    : null;
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
            {coreTcData &&
              totalRaised?.status === "success" &&
              totalRaised.result !== undefined &&
              totalTokensForSaleResult?.status === "success" &&
              totalTokensForSaleResult.result !== undefined && (
              <CharmRedemptionCurve
                totalRaised={totalRaised.result}
                totalTokensForSale={totalTokensForSaleResult.result}
                acceptedDecimals={decimals}
                launchedDecimals={launchedDec}
                userCharmWeight={charmWeightResult?.status === "success" ? charmWeightResult.result : undefined}
                saleStarted={
                  saleStart?.status === "success" &&
                  saleStart.result !== undefined &&
                  BigInt(saleStart.result) > 0n
                }
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
  const maxRaisedStr = buyHistoryPoints[buyHistoryPoints.length - 1]?.totalRaisedAfter ?? "0";
  const maxRaised = BigInt(maxRaisedStr);

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
                <strong>
                  {point.hardReset ? "Hard reset" : `+${formatLocaleInteger(BigInt(point.secondsAdded))}s`}
                </strong>
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
            const raisedAfter = BigInt(point.totalRaisedAfter);
            const raiseWidth = maxRaised > 0n ? Number((raisedAfter * 100n) / maxRaised) : 0;
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
