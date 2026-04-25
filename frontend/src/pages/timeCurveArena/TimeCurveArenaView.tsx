// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useRef, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { formatUnits } from "viem";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageHeroArcadeBanner, PageHeroHeading } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { indexerBaseUrl } from "@/lib/addresses";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  serializeContractRead,
  type SerializableContractRead,
} from "@/lib/serializeContractRead";
import { buildBuyBattlePointBreakdown } from "@/lib/timeCurveUx";
import { TimeCurveLiveCharts } from "@/pages/timecurve/TimeCurveLiveCharts";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { TimerHeroLiveBuys } from "@/pages/timecurve/TimerHeroLiveBuys";
import { TimerHeroParticles } from "@/pages/timecurve/TimerHeroParticles";
import { TimecurveBuyModals } from "@/pages/timecurve/TimecurveBuyModals";
import { formatCountdown, timerUrgencyClass } from "@/pages/timecurve/formatTimer";
import {
  BattleFeedSection,
  PodiumsSection,
  RawDataAccordion,
  StandingsVisuals,
  WarbowSection,
  WhatMattersSection,
} from "@/pages/timecurve/TimeCurveSections";
import { RankingList, StatCard } from "@/pages/timecurve/timecurveUi";
import { normalizeReferralCode } from "@/lib/referralCode";
import { formatPodiumLeaderboardValue } from "./arenaPageHelpers";
import { useTimeCurveArenaModel } from "./useTimeCurveArenaModel";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export function TimeCurveArenaView() {
  const props = useTimeCurveArenaModel();
  const {
    activeStreakR, address, arenaPhaseBadge, basePriceWadR, battlePtsR, bestStreakR,
    buildBuyNarrativeForFeed, buildWarbowNarrativeForFeed, buyCooldownSecR,
    buyCountR, buyEnvelopeParams, buyErr, buyFeeRoutingEnabled, buyHistoryPoints, buyListModalOpen,
    buyPanelRisk, buyerStats, buys, buysNextOffset, buysTotal, canClaimWarBowFlag, charmWadSelected,
    charmWeightR, cl8ySpendBounds, claimHint, claims, claimsNote, confettiGuide, coreTcData,
    dailyIncWadR, deadline, deadlineSec, decimals, detailBuy, distributeHint, effectiveLedgerSec,
    ended, estimatedSpend, expectedTokenFromCharms, flagOwnerAddr, flagPlantAtSec,
    flagSilenceEndSec, formatWallet, gasBuyIssue, gasClaim, gasDistribute, gasWarbowFlag,
    gasWarbowGuard, gasWarbowRevenge, gasWarbowSteal, growthRateWadR, guardUntilSec, guardedActive,
    handleBuy, handleLoadMoreBuys, hasRevengeOpen, heroTimer, heroTimerBusy, iHoldPlantFlag,
    indexerMismatch, indexerNote, initialMinBuyR, initialTimerSecR, isConnected, isError, isPending,
    isWriting, launchedDec, ledgerSecInt, liquidityAnchors, loadHeroTimer,
    loadingMoreBuys, maxBuyAmount, minBuy, minSpendCurvePoints, onCl8ySpendInputBlur,
    onCl8ySpendSlider, openBuyListModal, pendingRef, pendingRevengeStealer, pricePerCharmR, podiumPayoutPreview,
    podiumPoolBal, podiumReads, podiumSpotlights, prefersReducedMotion, primaryButtonMotion,
    prizeDist, prizePayouts, prizesDistributedR, refApplied,
    referralRegistryOn, revengeDeadlineSec, runVoid, runWarBowClaimFlag, runWarBowGuard,
    runWarBowRevenge, runWarBowSteal, saleActive, saleEnded, saleStart, secondaryButtonMotion,
    secondsRemaining, selectBuy, setBuyListModalOpen, setDetailBuy, setSpendInputStr,
    setStealBypass, setStealVictimInput, setUseReferral, sinkReads, spendInputStr,
    spendSliderPermille, stealBypass, stealPreflight, stealVictim, stealVictimInput, tc,
    timerAddedR, timerCapSecR, timerExpiredAwaitingEnd, timerExtensionPreview,
    timerExtensionSecR, timerNarrative, totalRaiseDisplay, totalRaised, totalTokensForSaleR,
    useReferral, victimBattlePointsBigInt, victimStealsTodayBigInt, viewerBattlePoints, walletCl8yBal, walletCooldownRemainingSec,
    warbowActionHint, warbowBypassBurnWad, warbowFeed, warbowFlagClaimBp, warbowFlagOwnerR,
    warbowFlagPlantR, warbowFlagSilenceSec, warbowGuardBurnWad, warbowLeaderboardRows,
    warbowMaxSteals, warbowMomentumBars, warbowPreflightIssue, warbowRank, warbowTopRows,
    whatMattersNowCards
  } = props;

  const pricePerCharmWad =
    pricePerCharmR?.status === "success" ? (pricePerCharmR.result as bigint) : undefined;

  function formatPriceFixed6(raw: bigint): string {
    const s = formatUnits(raw, 18);
    const [intPart, fracPart = ""] = s.split(".");
    return `${intPart}.${(fracPart + "000000").slice(0, 6)}`;
  }

  const priceTickKeyRef = useRef(0);
  const priceTickPrevRef = useRef<bigint | undefined>(undefined);
  if (pricePerCharmWad !== undefined && priceTickPrevRef.current !== pricePerCharmWad) {
    priceTickPrevRef.current = pricePerCharmWad;
    priceTickKeyRef.current += 1;
  }
  const priceTickKey = priceTickKeyRef.current;

  const buyProjectedEffects = useMemo(() => {
    const items: string[] = [];
    if (charmWadSelected !== undefined && charmWadSelected > 0n) {
      items.push(`+${formatCompactFromRaw(charmWadSelected, 18, { sigfigs: 4 })} CHARM`);
    }
    if (estimatedSpend !== undefined && estimatedSpend > 0n) {
      items.push(`${formatCompactFromRaw(estimatedSpend, decimals, { sigfigs: 4 })} CL8Y spend`);
    }

    if (secondsRemaining === undefined) {
      items.push("Timer effect pending");
    } else if (secondsRemaining < 780) {
      items.push("Hard-reset timer toward 15m");
    } else if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
      items.push(`+${formatLocaleInteger(timerExtensionPreview)}s timer`);
    } else {
      items.push("Timer at cap");
    }

    if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
      items.push(`+${formatLocaleInteger(timerExtensionPreview)}s time-booster credit`);
    } else {
      items.push("No time-booster credit");
    }

    const activeStreak =
      activeStreakR?.status === "success" ? (activeStreakR.result as bigint) : undefined;
    if (secondsRemaining !== undefined && secondsRemaining < 900) {
      items.push(
        activeStreak !== undefined && activeStreak > 0n
          ? `Continue your streak (${formatLocaleInteger(activeStreak)} -> ${formatLocaleInteger(activeStreak + 1n)})`
          : "Start or break defended streak",
      );
    } else {
      items.push("No defended-streak change");
    }

    const hasPendingFlag =
      flagOwnerAddr !== undefined &&
      flagOwnerAddr.toLowerCase() !== ZERO_ADDR &&
      flagPlantAtSec > 0n;
    if (hasPendingFlag && iHoldPlantFlag) {
      items.push("Refresh your pending flag");
    } else if (hasPendingFlag && flagOwnerAddr !== undefined) {
      items.push(`Replace ${formatWallet(flagOwnerAddr, "rival")}'s flag`);
    } else {
      items.push("Plant pending flag");
    }

    if (secondsRemaining !== undefined && secondsRemaining < 30) {
      items.push("+250 BP + reset/clutch bonuses");
    } else if (secondsRemaining !== undefined && secondsRemaining < 780) {
      items.push("+250 BP + reset bonus");
    } else {
      items.push("+250 BP base");
    }
    items.push("Become latest buyer");

    return items;
  }, [
    activeStreakR,
    charmWadSelected,
    decimals,
    estimatedSpend,
    flagOwnerAddr,
    flagPlantAtSec,
    formatWallet,
    iHoldPlantFlag,
    secondsRemaining,
    timerExtensionPreview,
  ]);

  if (!tc) {
    return (
      <section className="page page--timecurve">
        <TimeCurveSubnav active="arena" />
        <header className="page-hero">
          <PageHeroHeading
            title="TimeCurve · Arena"
            badgeLabel="Config needed"
            badgeTone="warning"
          />
        </header>
        <div className={`timer-hero ${timerUrgencyClass(secondsRemaining)}`}>
          <div className="timer-hero__inner">
            <div className="timer-hero__split">
              <TimerHeroLiveBuys
                buys={null}
                indexedTotal={null}
                indexerNote="Set VITE_TIMECURVE_ADDRESS to load recent buys from the indexer."
                formatWallet={formatWallet}
                nowUnixSec={Math.floor(effectiveLedgerSec)}
                envelopeParams={null}
              />
            </div>
          </div>
        </div>
        <div className="page-hero">
          <PageHeroArcadeBanner
            lede={
              <>
                Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see <code>.env.example</code>) to
                read live onchain sale state.
              </>
            }
            mascot={{
              src: "/art/cutouts/loading-mascot-circle.png",
              width: 192,
              height: 192,
              className: "cutout-decoration--sway",
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="page page--timecurve">
      <TimeCurveSubnav active="arena" />
      <header className="page-hero">
        <PageHeroHeading
          title="TimeCurve · Arena"
          badgeLabel={arenaPhaseBadge.label}
          badgeTone={arenaPhaseBadge.tone}
          badgeIconSrc={arenaPhaseBadge.iconSrc}
        />
      </header>
      <div className={`timer-hero ${timerUrgencyClass(secondsRemaining)}`}>
        <TimerHeroParticles
          saleActive={saleActive}
          remainingSec={secondsRemaining}
          timerTone={timerNarrative.tone}
          buys={buys}
          envelopeParams={buyEnvelopeParams}
        />
        <div className="timer-hero__inner">
          <div className="status-strip" aria-label="Timer and live pressure">
            <span className={`status-pill status-pill--${saleActive ? "success" : saleEnded ? "warning" : "info"}`}>
              {saleActive ? "Live round" : saleEnded ? "Sale ended" : timerExpiredAwaitingEnd ? "Timer expired" : "Pre-start"}
            </span>
            {saleActive && (
              <span
                data-timer-tone={timerNarrative.tone}
                className={`status-pill status-pill--${
                  timerNarrative.tone === "critical" ? "danger" : timerNarrative.tone === "warning" ? "warning" : "success"
                }`}
              >
                {timerNarrative.label}
              </span>
            )}
            {guardedActive && (
              <span className="status-pill status-pill--info">
                Guard until <UnixTimestampDisplay raw={guardUntilSec.toString()} />
              </span>
            )}
            {hasRevengeOpen && (
              <span className="status-pill status-pill--warning">
                Revenge window until <UnixTimestampDisplay raw={revengeDeadlineSec.toString()} />
              </span>
            )}
            {canClaimWarBowFlag && <span className="status-pill status-pill--warning">Flag claim ready</span>}
          </div>
          <div className="timer-hero__split timer-hero__split--arena-hub">
            <div className="timer-hero__arena-buy">
              <PageSection
                title="Buy CHARM"
                badgeLabel={saleActive ? "Primary action" : "Buy window"}
                badgeTone={saleActive ? "warning" : "info"}
                spotlight
                className="timecurve-panel timecurve-panel--action timecurve-arena-buy-panel"
                cutout={{
                  src: "/art/cutouts/bunny-sneak-steal.png",
                  width: 196,
                  height: 196,
                  className: "panel-cutout panel-cutout--arena-buy-mascot cutout-decoration--sway",
                }}
                lede="Buy now or pay more later — every block, CHARM costs more CL8Y."
              >
                {isPending && <StatusMessage variant="loading">Loading contract…</StatusMessage>}
                {!isPending && !saleActive && (
                  <StatusMessage variant="placeholder">
                    {saleEnded
                      ? "The round is over. Buying is closed, so the surface pivots to redemption and prize settlement."
                      : "The sale has not started yet. When it opens, this panel becomes the primary action surface."}
                  </StatusMessage>
                )}
                {!isPending && saleActive && (
                  <>
                    <CutoutDecoration
                      className="panel-cutout panel-cutout--coin-stack cutout-decoration--bob"
                      src="/art/hat-coin-stack.png"
                      width={180}
                      height={180}
                    />
                    <div className="timecurve-arena-buy-panel__conversion" aria-hidden="true">
                      <span className="timecurve-arena-buy-panel__conversion-token">
                        <img src="/art/icons/token-cl8y.png" alt="" width={28} height={28} decoding="async" />
                        CL8Y
                      </span>
                      <span className="timecurve-arena-buy-panel__conversion-arrow">→</span>
                      <span className="timecurve-arena-buy-panel__conversion-token">
                        <img src="/art/icons/token-charm.png" alt="" width={28} height={28} decoding="async" />
                        CHARM
                      </span>
                    </div>
                    <div className="timecurve-simple__rate-board" aria-live="polite">
                      <div className="timecurve-simple__rate-row timecurve-simple__rate-row--now">
                        <span className="timecurve-simple__rate-label-row">
                          <img
                            className="timecurve-simple__rate-glyph"
                            src="/art/icons/token-charm.png"
                            alt=""
                            aria-hidden="true"
                            decoding="async"
                            width={24}
                            height={24}
                          />
                          <span className="timecurve-simple__rate-label">1 CHARM costs right now</span>
                          <span className="timecurve-simple__rate-tick" aria-hidden="true">
                            ↑
                          </span>
                        </span>
                        <strong
                          key={priceTickKey}
                          className="timecurve-simple__rate-value timecurve-simple__rate-value--hero timecurve-simple__rate-value--tick"
                        >
                          {pricePerCharmWad !== undefined ? formatPriceFixed6(pricePerCharmWad) : "—"}
                          <span className="timecurve-simple__rate-unit"> CL8Y</span>
                        </strong>
                        <span className="timecurve-simple__rate-foot muted">
                          Ticks up every block — waiting costs CL8Y.
                        </span>
                      </div>
                    </div>
                    <div className="timecurve-arena-buy-panel__checkout">
                      <div className="timecurve-arena-buy-panel__checkout-head">
                        <img src="/art/icons/token-cl8y-24.png" alt="" width={24} height={24} decoding="async" />
                        <div>
                          <span>Set CL8Y spend</span>
                          <strong>Mint CHARM before the next tick gets pricier.</strong>
                        </div>
                      </div>
                      {!isConnected && (
                        <div className="timecurve-simple__connect">
                          <p className="timecurve-simple__connect-pitch">
                            Connect a wallet to choose spend, preview CHARM, and sign the buy.
                          </p>
                          <WalletConnectButton />
                        </div>
                      )}
                      {cl8ySpendBounds ? (
                        <div className="timecurve-simple__minmax-row">
                          <span className="timecurve-simple__minmax">
                            Live band&nbsp;
                            <strong>{formatCompactFromRaw(cl8ySpendBounds.minS, decimals)}</strong>&nbsp;–&nbsp;
                            <strong>{formatCompactFromRaw(cl8ySpendBounds.maxS, decimals)}</strong>
                            &nbsp;CL8Y
                          </span>
                        </div>
                      ) : (
                        <div className="timecurve-simple__minmax-row">
                          <span className="timecurve-simple__minmax">Loading live min – max…</span>
                        </div>
                      )}
                      <div className="timecurve-cl8y-buy-controls">
                        <div className="timecurve-cl8y-buy-controls__balance muted">
                          Your CL8Y balance:{" "}
                          {isConnected ? (
                            walletCl8yBal !== undefined ? (
                              <AmountDisplay raw={BigInt(walletCl8yBal as bigint).toString()} decimals={decimals} />
                            ) : (
                              "—"
                            )
                          ) : (
                            <span className="muted">Connect to read balance</span>
                          )}
                        </div>
                        {cl8ySpendBounds ? (
                          <label className="form-label">
                            CL8Y spend
                            <input
                              type="range"
                              className="form-input"
                              min={0}
                              max={10000}
                              step={1}
                              value={spendSliderPermille}
                              onChange={(e) => onCl8ySpendSlider(Number(e.target.value))}
                              style={{ "--arena-buy-slider-fill": `${spendSliderPermille / 100}%` } as CSSProperties}
                            />
                            <input
                              type="text"
                              inputMode="decimal"
                              className="form-input"
                              autoComplete="off"
                              value={spendInputStr}
                              onChange={(e) => setSpendInputStr(e.target.value)}
                              onBlur={onCl8ySpendInputBlur}
                              aria-label="CL8Y spend amount"
                            />
                          </label>
                        ) : (
                          <StatusMessage variant="muted">
                            Waiting for onchain min/max spend reads and wallet CL8Y balance…
                          </StatusMessage>
                        )}
                      </div>
                      {charmWadSelected !== undefined ? (
                        <div className="timecurve-simple__buy-preview" data-testid="timecurve-arena-buy-preview">
                          <div className="timecurve-simple__buy-preview-row">
                            <span className="timecurve-simple__buy-preview-label">You add</span>
                            <strong className="timecurve-simple__buy-preview-value">
                              {formatCompactFromRaw(charmWadSelected, 18, { sigfigs: 4 })}
                            </strong>
                            <span className="timecurve-simple__buy-preview-unit">CHARM</span>
                          </div>
                        </div>
                      ) : (
                        <div className="timecurve-simple__buy-preview timecurve-simple__buy-preview--loading">
                          Loading CHARM preview…
                        </div>
                      )}
                      <div className="timecurve-arena-buy-panel__future-option" aria-disabled="true">
                        <label>
                          <input type="checkbox" disabled /> Plant WarBow flag
                        </label>
                        <span>Coming soon. Current buys still plant automatically.</span>
                      </div>
                      {referralRegistryOn && pendingRef && (
                        <details className="timecurve-arena-buy-panel__advanced">
                          <summary>Advanced buy options</summary>
                          <label className="form-label">
                            <input
                              type="checkbox"
                              checked={useReferral}
                              onChange={(e) => setUseReferral(e.target.checked)}
                              disabled={!isConnected}
                            />{" "}
                            Apply referral <code>{normalizeReferralCode(pendingRef)}</code> from <code>?ref=</code>
                          </label>
                        </details>
                      )}
                      <div className="timecurve-arena-buy-panel__effects" aria-label="Projected effects of this buy">
                        <div className="timecurve-arena-buy-panel__effects-title">
                          <img src="/art/icons/warbow-flag-20.png" alt="" width={20} height={20} decoding="async" />
                          Projected effects
                        </div>
                        <ul>
                          {buyProjectedEffects.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      {buyFeeRoutingEnabled === false && (
                        <StatusMessage variant="muted">
                          Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.
                        </StatusMessage>
                      )}
                      {isConnected && (
                        <>
                          <motion.button
                            type="button"
                            className="btn-primary btn-primary--priority timecurve-simple__cta timecurve-simple__cta--arcade"
                            disabled={
                              isWriting ||
                              walletCooldownRemainingSec > 0 ||
                              charmWadSelected === undefined ||
                              charmWadSelected <= 0n ||
                              !cl8ySpendBounds ||
                              buyFeeRoutingEnabled === false
                            }
                            onClick={() => void handleBuy()}
                            {...primaryButtonMotion}
                          >
                            <img
                              className="timecurve-simple__cta-glyph"
                              src="/art/icons/token-charm.png"
                              alt=""
                              aria-hidden="true"
                              width={28}
                              height={28}
                              decoding="async"
                            />
                            <span className="timecurve-simple__cta-label">
                              {isWriting ? "Confirm in wallet…" : "Buy CHARM"}
                            </span>
                          </motion.button>
                          {walletCooldownRemainingSec > 0 && (
                            <StatusMessage variant="muted">
                              Buy cooldown · {formatCountdown(walletCooldownRemainingSec)} left
                            </StatusMessage>
                          )}
                          <StatusMessage variant={gasBuyIssue ? "error" : "muted"}>{buyPanelRisk}</StatusMessage>
                        </>
                      )}
                    </div>
                  </>
                )}
                {buyErr && <StatusMessage variant="error">{buyErr}</StatusMessage>}
              </PageSection>
            </div>
            <div className="timer-hero__arena-rail">
              <div className="timer-hero__clock-stack">
            <div className="timer-hero__label">
              {saleActive ? "Time Remaining" : saleEnded ? "Sale Ended" : "Starts In"}
            </div>
            <div className="timer-hero__countdown" aria-live="polite">
              {secondsRemaining !== undefined ? formatCountdown(secondsRemaining) : "—"}
            </div>
            {saleActive && isConnected && walletCooldownRemainingSec > 0 && (
              <div className="timer-hero__wallet-cooldown" aria-live="polite">
                Wallet buy cooldown: <strong>{formatCountdown(walletCooldownRemainingSec)}</strong>
                {buyCooldownSecR?.status === "success" ? (
                  <span className="muted">
                    {" "}
                    ({formatLocaleInteger(Number(buyCooldownSecR.result as bigint))}s onchain window)
                  </span>
                ) : null}
              </div>
            )}
            {saleActive && tc && (
              <div
                className="timer-hero__subtext timer-hero__subtext--deadline-read"
                aria-busy={heroTimerBusy}
              >
                {heroTimer ? (
                  <>
                    <div className="timer-hero__deadline-read-stack">
                      <span className="timer-hero__deadline-read-meta">
                        On-chain{" "}
                        <code className="timer-hero__deadline-fn">deadline()</code>:{" "}
                        <time
                          dateTime={new Date(heroTimer.deadlineSec * 1000).toISOString()}
                          title={`Unix seconds: ${heroTimer.deadlineSec}`}
                        >
                          {new Date(heroTimer.deadlineSec * 1000).toLocaleString()}
                        </time>
                        <span className="timer-hero__deadline-read-sep" aria-hidden>
                          {" "}
                          ·{" "}
                        </span>
                        <span className="timer-hero__deadline-block">
                          read at block {heroTimer.readBlockNumber.toString()}
                        </span>
                      </span>
                      <span className="timer-hero__deadline-block-ts">
                        Head <code className="timer-hero__deadline-fn">block.timestamp</code>:{" "}
                        <time
                          dateTime={new Date(heroTimer.blockTimestampSec * 1000).toISOString()}
                          title={`Unix seconds: ${heroTimer.blockTimestampSec}`}
                        >
                          {new Date(heroTimer.blockTimestampSec * 1000).toLocaleString()}
                        </time>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="timer-hero__deadline-refresh"
                      onClick={() => void loadHeroTimer()}
                      disabled={heroTimerBusy}
                      aria-label="Refresh on-chain deadline read"
                      title="Refresh on-chain deadline read"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className={
                          heroTimerBusy && !prefersReducedMotion
                            ? "timer-hero__deadline-refresh-icon--spin"
                            : undefined
                        }
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M8 16H3v5" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span className="timer-hero__deadline-read-placeholder">
                    Loading on-chain deadline…
                  </span>
                )}
              </div>
            )}
            {saleActive && (
              <>
                <div className="timer-hero__narrative">{timerNarrative.detail}</div>
                {confettiGuide !== null && (
                  <div className="timer-hero__burst-guide" aria-label="Confetti guide">
                    <div className="timer-hero__burst-title">Confetti guide</div>
                    <div className="timer-hero__burst-row">
                      <span
                        className="timer-hero__burst-swatch"
                        aria-hidden
                        style={{ backgroundColor: confettiGuide.color }}
                      />
                      <span className="timer-hero__burst-latest">{confettiGuide.latestLabel}</span>
                    </div>
                    <div className="timer-hero__burst-band">{confettiGuide.bandLabel}</div>
                    <div className="timer-hero__burst-help">{confettiGuide.help}</div>
                  </div>
                )}
                <div className="timer-hero__raise-lines" aria-label="Total raised in CL8Y">
                  <div className="timer-hero__total-raise">
                    TOTAL RAISE: {totalRaiseDisplay.cl8y} CL8Y
                  </div>
                  <div className="timer-hero__total-usd">TOTAL USD: {totalRaiseDisplay.usd}</div>
                </div>
              </>
            )}
          </div>
              <TimerHeroLiveBuys
                buys={buys}
                indexedTotal={buysTotal}
                indexerNote={indexerNote}
                formatWallet={formatWallet}
                nowUnixSec={Math.floor(effectiveLedgerSec)}
                envelopeParams={buyEnvelopeParams}
                onSelectBuy={indexerBaseUrl() && indexerNote === null ? selectBuy : undefined}
                onMore={indexerBaseUrl() && indexerNote === null ? openBuyListModal : undefined}
              />
              {saleActive && (
                <div className="timer-hero__buy-now muted">
                  <p className="timer-hero__buy-now-hint">Buy CHARM + WarBow actions are in the hub panel on the left.</p>
                </div>
              )}
            </div>
        </div>
        </div>
      </div>

      <div className="page-hero">
        <PageHeroArcadeBanner
          coinSrc="/art/icons/token-doub.png"
          coinAlt="DOUB token glyph"
          sceneSrc="/art/scenes/timecurve-arena.jpg"
          lede={
            <>
              Advanced PvP surface — <strong>WarBow</strong> steals, defended streaks, the four
              reserve podiums, and the live battle feed. New here? Start on{" "}
              <Link to="/timecurve">Simple</Link> first.
            </>
          }
          mascot={{
            src: "/art/cutouts/bunny-podium-win.png",
            width: 220,
            height: 220,
            className: "cutout-decoration--float",
          }}
        >
          <div className="status-strip" aria-label="Current TimeCurve status">
            <PageBadge
              label={saleActive ? "Buy + defend + steal" : saleEnded ? "Redeem + settle" : "Waiting for start"}
              tone={saleActive ? "live" : saleEnded ? "warning" : "info"}
            />
            {guardedActive && <PageBadge label="Guard active" tone="info" />}
            {hasRevengeOpen && <PageBadge label="Revenge open" tone="warning" />}
            {canClaimWarBowFlag && <PageBadge label="Flag claim ready" tone="warning" />}
          </div>
        </PageHeroArcadeBanner>
      </div>

      <WhatMattersSection
        saleActive={saleActive}
        saleEnded={saleEnded}
        whatMattersNowCards={whatMattersNowCards}
        minBuy={serializeContractRead(minBuy)}
        decimals={decimals}
        expectedTokenFromCharms={expectedTokenFromCharms?.toString()}
        charmWeightResult={serializeContractRead(charmWeightR)}
        podiumPoolBal={typeof podiumPoolBal === "bigint" ? podiumPoolBal.toString() : undefined}
        battlePointsResult={serializeContractRead(battlePtsR)}
        totalRaisedResult={serializeContractRead(totalRaised)}
        isPending={isPending}
        isError={isError}
        indexerMismatch={indexerMismatch}
        claimHint={claimHint ?? null}
        distributeHint={distributeHint}
      />

      <div className="split-layout split-layout--hero">

        <PageSection
          title={saleEnded ? "After sale actions" : "Standings and prize chase"}
          badgeLabel={saleEnded ? "Redeem and settle" : "Competitive surface"}
          badgeTone={saleEnded ? "warning" : "live"}
          spotlight
          className="timecurve-panel timecurve-panel--status"
          cutout={{
            src: "/art/cutouts/mascot-leprechaun-with-bag-cutout.png",
            width: 228,
            height: 228,
            className: "panel-cutout panel-cutout--lower-right cutout-decoration--float",
          }}
          lede={
            saleEnded
              ? "When the timer expires, use this panel to end the round, redeem charms, and settle the reserve podium pool."
              : "Scan the live ladder, podium leaders, and momentum before you choose whether to buy, defend, or press PvP."
          }
        >
          {saleEnded ? (
            <>
              <div className="timecurve-action-row">
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--critical"
                  disabled={isWriting}
                  onClick={() => runVoid("endSale")}
                  {...secondaryButtonMotion}
                >
                  End sale
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting}
                  onClick={() => runVoid("redeemCharms")}
                  {...secondaryButtonMotion}
                >
                  Redeem charms
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting}
                  onClick={() => runVoid("distributePrizes")}
                  {...secondaryButtonMotion}
                >
                  Distribute prizes
                </motion.button>
              </div>
              {(gasClaim !== undefined || gasDistribute !== undefined) && (
                <StatusMessage variant="muted">
                  {gasClaim !== undefined && <>Estimated gas for redeem: ~{formatLocaleInteger(gasClaim)} units</>}
                  {gasClaim !== undefined && gasDistribute !== undefined && <> · </>}
                  {gasDistribute !== undefined && (
                    <>Estimated gas for prize distribution: ~{formatLocaleInteger(gasDistribute)} units</>
                  )}
                </StatusMessage>
              )}
            </>
          ) : (
            <>
              <div className="stats-grid">
                <StatCard
                  label="WarBow leader"
                  value={warbowTopRows[0]?.value ?? "—"}
                  meta={warbowTopRows[0]?.label ?? "Waiting for contract snapshot"}
                />
                <StatCard
                  label="Your WarBow rank"
                  value={warbowRank ? `#${warbowRank}` : "Unranked"}
                  meta={warbowRank ? "From latest indexed leaderboard" : "Make a move to enter the race"}
                />
                <StatCard
                  label="Podium pool"
                  value={
                    podiumPoolBal !== undefined ? (
                      <AmountDisplay raw={(podiumPoolBal as bigint).toString()} decimals={decimals} />
                    ) : (
                      "—"
                    )
                  }
                  meta="Reserve payout pool shared by four onchain podium categories"
                />
                <StatCard
                  label="Your best defended streak"
                  value={
                    bestStreakR?.status === "success"
                      ? formatLocaleInteger(bestStreakR.result as bigint)
                      : "—"
                  }
                  meta="Peak under-15-minute defended streak"
                />
              </div>
              {warbowMomentumBars.length > 0 && (
                <div className="momentum-strip" aria-label="WarBow momentum strip">
                  {warbowMomentumBars.map((bar, index) => (
                    <div
                      key={bar.key}
                      className={[
                        "momentum-strip__item",
                        index === 0 ? "momentum-strip__item--first" : "",
                        bar.highlight ? "momentum-strip__item--you" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="momentum-strip__meta">
                        <span className="mono" title={bar.wallet}>
                          {bar.label}
                        </span>
                        <strong>{formatLocaleInteger(bar.value)} BP</strong>
                      </div>
                      <div className="momentum-strip__track">
                        <div className="momentum-strip__fill" style={{ width: `${Math.max(bar.width, 8)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <StandingsVisuals buyHistoryPoints={buyHistoryPoints} decimals={decimals} />
              <div className="spotlight-grid">
                {podiumSpotlights.map((card) => (
                  <article
                    key={card.key}
                    className={[
                      "spotlight-card",
                      card.highlight ? "spotlight-card--you" : "",
                      card.label === "WarBow" ? "spotlight-card--warbow" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="spotlight-card__eyebrow">{card.label}</div>
                    <div className="spotlight-card__value">{card.leader}</div>
                    <div className="spotlight-card__meta">
                      {card.value} · {card.help}
                    </div>
                  </article>
                ))}
              </div>
              <RankingList rows={warbowTopRows} emptyText="Waiting for WarBow contract snapshot." />
            </>
          )}
        </PageSection>
      </div>

      {saleActive &&
        deadlineSec !== undefined &&
        saleStart?.status === "success" &&
        initialMinBuyR?.status === "success" &&
        growthRateWadR?.status === "success" &&
        basePriceWadR?.status === "success" &&
        dailyIncWadR?.status === "success" && (
          <TimeCurveLiveCharts
            saleActive={saleActive}
            saleStartSec={Number(saleStart.result as bigint)}
            deadlineSec={deadlineSec}
            nowSec={effectiveLedgerSec}
            initialMinBuy={(initialMinBuyR.result as bigint).toString()}
            growthRateWad={(growthRateWadR.result as bigint).toString()}
            basePriceWad={(basePriceWadR.result as bigint).toString()}
            dailyIncrementWad={(dailyIncWadR.result as bigint).toString()}
            decimals={decimals}
          />
        )}

      <WarbowSection
        saleActive={saleActive}
        warbowMaxSteals={warbowMaxSteals}
        warbowBypassBurnWad={warbowBypassBurnWad.toString()}
        warbowGuardBurnWad={warbowGuardBurnWad.toString()}
        warbowActionHint={warbowActionHint}
        warbowFlagSilenceSec={warbowFlagSilenceSec.toString()}
        warbowFlagClaimBp={warbowFlagClaimBp.toString()}
        warbowPendingFlagReadsReady={
          warbowFlagOwnerR?.status === "success" && warbowFlagPlantR?.status === "success"
        }
        warbowPendingFlagOwner={flagOwnerAddr}
        warbowPendingFlagPlantAtSec={flagPlantAtSec.toString()}
        ledgerSecInt={ledgerSecInt}
        formatWallet={formatWallet}
        isConnected={isConnected}
        stealVictimInput={stealVictimInput}
        setStealVictimInput={setStealVictimInput}
        stealVictim={stealVictim}
        victimStealsToday={victimStealsTodayBigInt?.toString()}
        warbowTopRows={warbowTopRows}
        warbowLeaderboardRows={warbowLeaderboardRows}
        warbowFeed={warbowFeed}
        address={address}
        buildWarbowNarrative={buildWarbowNarrativeForFeed}
        stealBypass={stealBypass}
        setStealBypass={setStealBypass}
        runWarBowSteal={runWarBowSteal}
        runWarBowGuard={runWarBowGuard}
        runWarBowClaimFlag={runWarBowClaimFlag}
        runWarBowRevenge={runWarBowRevenge}
        isWriting={isWriting}
        canClaimWarBowFlag={canClaimWarBowFlag}
        iHoldPlantFlag={iHoldPlantFlag}
        flagSilenceEndSec={flagSilenceEndSec.toString()}
        hasRevengeOpen={hasRevengeOpen}
        secondaryButtonMotion={secondaryButtonMotion as Record<string, unknown>}
        stealPreflight={stealPreflight}
        warbowPreflightIssue={warbowPreflightIssue}
        viewerBattlePoints={viewerBattlePoints?.toString()}
        victimBattlePoints={victimBattlePointsBigInt?.toString()}
        gasWarbowSteal={gasWarbowSteal?.toString()}
        gasWarbowGuard={gasWarbowGuard?.toString()}
        gasWarbowFlag={gasWarbowFlag?.toString()}
        gasWarbowRevenge={gasWarbowRevenge?.toString()}
      />

      <PodiumsSection
        podiumPayoutPreview={podiumPayoutPreview}
        decimals={decimals}
        podiumLoading={podiumReads.isLoading}
        podiumRows={podiumReads.data ?? []}
        address={address}
        formatPodiumLeaderboardValue={formatPodiumLeaderboardValue}
        formatWallet={formatWallet}
      />

      <BattleFeedSection
        indexerNote={indexerNote}
        buys={buys}
        address={address}
        decimals={decimals}
        buysNextOffset={buysNextOffset}
        loadingMoreBuys={loadingMoreBuys}
        handleLoadMoreBuys={handleLoadMoreBuys}
        buildBuyNarrative={buildBuyNarrativeForFeed}
        buildBuyBattlePointBreakdown={buildBuyBattlePointBreakdown}
        formatWallet={formatWallet}
        claimsNote={claimsNote}
        claims={claims}
        prizeDist={prizeDist}
        prizePayouts={prizePayouts}
        refApplied={refApplied}
      />

      <TimecurveBuyModals
        listOpen={buyListModalOpen}
        onCloseList={() => setBuyListModalOpen(false)}
        detailBuy={detailBuy}
        onCloseDetail={() => setDetailBuy(null)}
        onSelectBuy={selectBuy}
        buys={buys}
        indexedTotal={buysTotal}
        buysLoading={buys === null && indexerNote === null}
        buysNextOffset={buysNextOffset}
        loadingMoreBuys={loadingMoreBuys}
        onLoadMoreBuys={handleLoadMoreBuys}
        address={address}
        formatWallet={formatWallet}
        decimals={decimals}
        nowUnixSec={Math.floor(effectiveLedgerSec)}
        envelopeParams={buyEnvelopeParams}
      />

      <RawDataAccordion
        hasCoreContractReads={Boolean(coreTcData && coreTcData.length > 0)}
        saleStart={serializeContractRead(saleStart)}
        deadline={serializeContractRead(deadline)}
        secondsRemaining={secondsRemaining}
        totalRaised={serializeContractRead(totalRaised)}
        ended={serializeContractRead(ended)}
        maxBuyAmount={maxBuyAmount?.toString()}
        prizesDistributedResult={serializeContractRead(prizesDistributedR)}
        isConnected={isConnected}
        charmWeightResult={serializeContractRead(charmWeightR)}
        buyCountResult={serializeContractRead(buyCountR)}
        timerAddedResult={serializeContractRead(timerAddedR)}
        battlePointsResult={serializeContractRead(battlePtsR)}
        activeStreakResult={serializeContractRead(activeStreakR)}
        bestStreakResult={serializeContractRead(bestStreakR)}
        pendingRevengeStealer={pendingRevengeStealer}
        revengeDeadlineSec={revengeDeadlineSec.toString()}
        buyerStats={indexerBaseUrl() ? buyerStats : null}
        initialMinBuyResult={serializeContractRead(initialMinBuyR)}
        growthRateWadResult={serializeContractRead(growthRateWadR)}
        timerExtensionSecResult={serializeContractRead(timerExtensionSecR)}
        initialTimerSecResult={serializeContractRead(initialTimerSecR)}
        timerCapSecResult={serializeContractRead(timerCapSecR)}
        totalTokensForSaleResult={serializeContractRead(totalTokensForSaleR)}
        sinkReads={sinkReads?.map((r) => serializeContractRead(r) as SerializableContractRead)}
        liquidityAnchors={liquidityAnchors}
        minSpendCurvePoints={minSpendCurvePoints.map((p) => ({ minSpend: p.minSpend.toString() }))}
        decimals={decimals}
        launchedDec={launchedDec}
        formatWallet={formatWallet}
      />
    </section>
  );

}
