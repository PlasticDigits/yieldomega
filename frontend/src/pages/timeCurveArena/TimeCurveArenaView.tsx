// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useRef, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { formatUnits } from "viem";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AddressInline } from "@/components/AddressInline";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { Cl8yTimeCurveUnlimitedApprovalFieldset } from "@/components/Cl8yTimeCurveUnlimitedApprovalFieldset";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ConversionArrow } from "@/components/ui/ConversionArrow";
import { PageHeroArcadeBanner, PageHeroHeading } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { indexerBaseUrl } from "@/lib/addresses";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import { ARENA_TOTAL_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  serializeContractRead,
  type SerializableContractRead,
} from "@/lib/serializeContractRead";
import {
  CHARM_TOKEN_LOGO,
  CL8Y_TOKEN_LOGO,
  DOUB_TOKEN_LOGO,
  ETH_TOKEN_LOGO,
  USDM_TOKEN_LOGO,
} from "@/lib/tokenMedia";
import { doubPerCharmAtLaunchWad } from "@/lib/timeCurvePodiumMath";
import { buildBuyBattlePointBreakdown } from "@/lib/timeCurveUx";
import { TimeCurveLiveCharts } from "@/pages/timecurve/TimeCurveLiveCharts";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { useArenaHeroCountdownSecondSfx } from "@/pages/timeCurveArena/useArenaHeroCountdownSecondSfx";
import { useArenaWarbowRankSfx } from "@/pages/timeCurveArena/useArenaWarbowRankSfx";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";
import { usePeerBuyHeadSfx } from "@/pages/timecurve/usePeerBuyHeadSfx";
import { TimerHeroLiveBuys } from "@/pages/timecurve/TimerHeroLiveBuys";
import { TimerHeroParticles } from "@/pages/timecurve/TimerHeroParticles";
import { TimecurveBuyModals } from "@/pages/timecurve/TimecurveBuyModals";
import { formatCountdown, timerUrgencyClass } from "@/pages/timecurve/formatTimer";
import { WarbowHeroActions } from "./WarbowHeroActions";
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
// Issue #80: the Arena buy panel is the sparse "predator in the pool" placement for sniper-shark art.
const ARENA_SNIPER_SHARK_CUTOUT = "/art/cutouts/sniper-shark-peek-scope.png";

export function TimeCurveArenaView() {
  const props = useTimeCurveArenaModel();
  const totalRaiseUsdFreshness = useRelativeFreshnessLabel(props.totalRaiseCl8yObservedAtMs);
  const { mismatch: chainMismatch, walletChainId } = useWalletTargetChainMismatch();
  const {
    activeStreakR, address, arenaPhase, arenaPhaseBadge, basePriceWadR, battlePtsR, bestStreakR,
    buildBuyNarrativeForFeed, buildWarbowNarrativeForFeed, buyAddsCl8yAtLaunch, buyCooldownSecR,
    buyCountR, buyEnvelopeParams, buyErr, buyFeeRoutingEnabled, buyHistoryPoints, buyListModalOpen,
    buyPanelRisk, buyerStats, buys, buysNextOffset, buysTotal, canClaimWarBowFlag,
    canDistributePrizesAsOwner, charmWadSelected,
    charmWeightR, cl8ySpendBounds, claimHint, claims, claimsNote, confettiGuide, coreTcData,
    dailyIncWadR, deadline, deadlineSec, decimals, detailBuy, distributeHint, effectiveLedgerSec,
    ended, estimatedSpend, expectedTokenFromCharms, flagOwnerAddr, flagPlantAtSec,
    flagSilenceEndSec, formatWallet, gasBuyIssue, gasClaim, gasDistribute, gasWarbowFlag,
    gasWarbowGuard, gasWarbowRevenge, gasWarbowSteal, growthRateWadR, guardUntilSec, guardedActive,
    handleBuy, handleLoadMoreBuys, hasRevengeOpen, heroTimer, heroTimerBusy, iHoldPlantFlag,
    indexerMismatch, indexerNote, initialMinBuyR, initialTimerSecR, isConnected, isError, isPending,
    isWriting, kumbayaRoutingBlocker, launchCl8yPerCharmWei, launchPayQuoteLoading, launchedDec,
    ledgerSecInt, liquidityAnchors, loadHeroTimer,
    loadingMoreBuys, maxBuyAmount, minBuy, minSpendCurvePoints, nonCl8yBuyBlocked,
    onCl8ySpendInputBlur, onCl8ySpendSlider,     openBuyListModal, bandBoundaryQuotesLoading,
    payTokenDecimals, payWalletBalance, payWith,
    pendingRef, plantWarBowFlag, pendingRevengeTargets, perCharmPayQuoteLoading, pricePerCharmR, podiumPayoutPreview,
    podiumPoolBal, podiumReads, podiumSpotlights, prefersReducedMotion, primaryButtonMotion,
    prizeDist, prizePayouts, prizesDistributedR, pvpErr, quotedBandMaxPayInWei, quotedBandMinPayInWei,
    quotedLaunchPerCharmPayInWei, quotedPayInWei, quotedPerCharmPayInWei, refApplied,
    rateBoardKumbayaWarning, referralRegistryOn, revengeDeadlineSec, revengeIndexerConfigured,
    runVoid, runWarBowClaimFlag, runWarBowGuard,
    runWarBowRevenge, runWarBowSteal, saleActive, saleEnded, saleStart, secondaryButtonMotion,
    secondsRemaining, selectBuy, setBuyListModalOpen, setDetailBuy, setPayWith, setPlantWarBowFlag, setSpendInputStr,
    setStealBypass, setStealVictimInput, setUseReferral, sinkReads, spendInputStr,
    spendSliderPermille, stealBypass, stealPreflight, stealVictim, stealVictimInput, swapQuoteFailed,
    swapQuoteLoading, tc,
    timerAddedR, timerCapSecR, timerExpiredAwaitingEnd, timerExtensionPreview,
    timerExtensionSecR, timerNarrative, totalCharmWeightR, totalRaiseDisplay, totalRaised,
    totalTokensForSaleR,
    useReferral, victimBattlePointsBigInt, victimStealsTodayBigInt, viewerBattlePoints, walletCooldownRemainingSec,
    warbowActionHint, warbowBypassBurnWad, warbowFeed, warbowFlagClaimBp, warbowFlagOwnerR,
    warbowFlagPlantR, warbowFlagSilenceSec, warbowGuardBurnWad, warbowLeaderboardRows,
    warbowMaxSteals, warbowMomentumBars, warbowPreflightIssue, warbowRank, warbowStealCandidates, warbowTopRows,
    whatMattersNowCards
  } = props;

  const onchainEnded = ended?.status === "success" && Boolean(ended.result);
  /** `saleEnded` OR `saleExpiredAwaitingEnd` — settlement CTAs must not hide behind the live-standings layout (GitLab #188). */
  const showPostRoundSettlementPanel = saleEnded || timerExpiredAwaitingEnd;

  const pricePerCharmWad =
    pricePerCharmR?.status === "success" ? (pricePerCharmR.result as bigint) : undefined;

  usePeerBuyHeadSfx({
    recentBuys: buys,
    walletAddress: address,
    reduceMotion: Boolean(prefersReducedMotion),
  });

  useArenaHeroCountdownSecondSfx({
    saleActive,
    secondsRemaining,
    reduceMotion: Boolean(prefersReducedMotion),
  });

  useArenaWarbowRankSfx({
    viewerConnected: Boolean(address),
    saleActive,
    warbowRank,
  });

  function formatPriceFixed6(raw: bigint): string {
    const s = formatUnits(raw, 18);
    const [intPart, fracPart = ""] = s.split(".");
    return `${intPart}.${(fracPart + "000000").slice(0, 6)}`;
  }

  function formatEthRateHero(raw: bigint): string {
    const s = formatUnits(raw, 18);
    const [intPart, fracPart = ""] = s.split(".");
    return `${intPart}.${(fracPart + "00000000").slice(0, 8)}`;
  }

  const rateNowDisplay = useMemo(() => {
    if (pricePerCharmWad === undefined) {
      return { text: "—" as const, unit: " CL8Y" as const, loading: false as const };
    }
    if (payWith === "cl8y") {
      return {
        text: formatPriceFixed6(pricePerCharmWad),
        unit: " CL8Y" as const,
        loading: false as const,
      };
    }
    if (perCharmPayQuoteLoading) {
      if (payWith === "eth") {
        return { text: "…" as const, unit: " ETH" as const, loading: true as const };
      }
      return { text: "…" as const, unit: " USDM" as const, loading: true as const };
    }
    const quoted = quotedPerCharmPayInWei;
    const raw =
      quoted !== undefined ? quoted : fallbackPayTokenWeiForCl8y(pricePerCharmWad, payWith);
    if (payWith === "eth") {
      return {
        text: formatEthRateHero(raw),
        unit: " ETH" as const,
        loading: false as const,
      };
    }
    return {
      text: formatPriceFixed6(raw),
      unit: " USDM" as const,
      loading: false as const,
    };
  }, [pricePerCharmWad, payWith, perCharmPayQuoteLoading, quotedPerCharmPayInWei]);

  const totalTokensForSaleWad =
    totalTokensForSaleR?.status === "success" ? (totalTokensForSaleR.result as bigint) : undefined;
  const totalCharmWeightWad =
    totalCharmWeightR?.status === "success" ? (totalCharmWeightR.result as bigint) : undefined;

  const doubPerCharmAtLaunch = useMemo(
    () =>
      doubPerCharmAtLaunchWad({
        totalTokensForSaleWad,
        totalCharmWeightWad,
      }),
    [totalTokensForSaleWad, totalCharmWeightWad],
  );

  const rateLaunchDisplay = useMemo(() => {
    if (launchCl8yPerCharmWei === undefined) {
      return { text: "—" as const, unit: " CL8Y" as const, loading: false as const };
    }
    if (payWith === "cl8y") {
      return {
        text: formatPriceFixed6(launchCl8yPerCharmWei),
        unit: " CL8Y" as const,
        loading: false as const,
      };
    }
    if (launchPayQuoteLoading) {
      if (payWith === "eth") {
        return { text: "…" as const, unit: " ETH" as const, loading: true as const };
      }
      return { text: "…" as const, unit: " USDM" as const, loading: true as const };
    }
    const quoted = quotedLaunchPerCharmPayInWei;
    const raw =
      quoted !== undefined ? quoted : fallbackPayTokenWeiForCl8y(launchCl8yPerCharmWei, payWith);
    if (payWith === "eth") {
      return {
        text: formatEthRateHero(raw),
        unit: " ETH" as const,
        loading: false as const,
      };
    }
    return {
      text: formatPriceFixed6(raw),
      unit: " USDM" as const,
      loading: false as const,
    };
  }, [launchCl8yPerCharmWei, payWith, launchPayQuoteLoading, quotedLaunchPerCharmPayInWei]);

  const rateBoardPayOptions = (
    [
      ["cl8y", "CL8Y", CL8Y_TOKEN_LOGO],
      ["eth", "ETH", ETH_TOKEN_LOGO],
      ["usdm", "USDM", USDM_TOKEN_LOGO],
    ] as const
  ).map(([key, label, logo]) => (
    <button
      key={key}
      type="button"
      data-testid={`timecurve-simple-paywith-${key}`}
      className={
        payWith === key
          ? "timecurve-simple__rate-paywith-btn timecurve-simple__rate-paywith-btn--active"
          : "timecurve-simple__rate-paywith-btn"
      }
      aria-pressed={payWith === key}
      aria-label={`Show price in ${label}`}
      onClick={() => setPayWith(key as PayWithAsset)}
    >
      <img src={logo} alt="" width={16} height={16} decoding="async" aria-hidden="true" />
      {label}
    </button>
  ));

  const paySpendSuffix = payWith === "cl8y" ? "CL8Y" : payWith === "eth" ? "ETH" : "USDM";
  const paySpendLogo =
    payWith === "cl8y" ? CL8Y_TOKEN_LOGO : payWith === "eth" ? ETH_TOKEN_LOGO : USDM_TOKEN_LOGO;

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
      items.push(`+${formatBuyHubDerivedCompact(charmWadSelected, 18)} CHARM`);
    }
    if (estimatedSpend !== undefined && estimatedSpend > 0n) {
      items.push(`${formatBuyHubDerivedCompact(estimatedSpend, decimals)} CL8Y spend`);
    }

    if (secondsRemaining === undefined) {
      items.push("Timer effect pending");
    } else if (secondsRemaining < 780) {
      items.push("Hard-reset timer toward 15m");
    } else if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
      items.push(`+${formatLocaleInteger(timerExtensionPreview)}s timer`);
    }

    if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
      items.push(`+${formatLocaleInteger(timerExtensionPreview)}s time-booster credit`);
    }

    const activeStreak =
      activeStreakR?.status === "success" ? (activeStreakR.result as bigint) : undefined;
    if (secondsRemaining !== undefined && secondsRemaining < 900) {
      items.push(
        activeStreak !== undefined && activeStreak > 0n
          ? `Continue your streak (${formatLocaleInteger(activeStreak)} -> ${formatLocaleInteger(activeStreak + 1n)})`
          : "Start or break defended streak",
      );
    }

    if (plantWarBowFlag) {
      const hasPendingFlag =
        flagOwnerAddr !== undefined &&
        flagOwnerAddr.toLowerCase() !== ZERO_ADDR &&
        flagPlantAtSec > 0n;
      if (hasPendingFlag && iHoldPlantFlag) {
        items.push("Refresh your pending WarBow flag (resets silence timer)");
      } else if (hasPendingFlag && flagOwnerAddr !== undefined) {
        items.push(`Replace ${formatWallet(flagOwnerAddr, "rival")}'s pending flag`);
      } else {
        items.push("Plant pending WarBow flag");
      }
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
    plantWarBowFlag,
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
                buys={buys}
                indexedTotal={buysTotal}
                indexerNote={indexerNote}
                formatWallet={formatWallet}
                envelopeParams={buyEnvelopeParams}
                onSelectBuy={indexerBaseUrl() && indexerNote === null ? selectBuy : undefined}
                onMore={indexerBaseUrl() && indexerNote === null ? openBuyListModal : undefined}
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
          envelopeParams={buyEnvelopeParams}
        />
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
              <ChainMismatchWriteBarrier testId="timecurve-arena-buy-chain-write-gate">
              <PageSection
                title="Buy CHARM"
                badgeLabel={saleActive ? "Primary action" : "Buy window"}
                badgeTone={saleActive ? "warning" : "info"}
                spotlight
                className="timecurve-panel timecurve-panel--action timecurve-arena-buy-panel"
                cutout={{
                  src: ARENA_SNIPER_SHARK_CUTOUT,
                  width: 196,
                  height: 196,
                  className: "panel-cutout panel-cutout--arena-buy-mascot panel-cutout--arena-sniper-shark cutout-decoration--peek",
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
                      {payWith === "cl8y" && (
                        <>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CL8Y_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CL8Y
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-arrow">
                            <ConversionArrow size={20} />
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CHARM_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CHARM
                          </span>
                        </>
                      )}
                      {payWith === "eth" && (
                        <>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={ETH_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            ETH
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-arrow">
                            <ConversionArrow size={20} />
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CL8Y_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CL8Y
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-arrow">
                            <ConversionArrow size={20} />
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CHARM_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CHARM
                          </span>
                        </>
                      )}
                      {payWith === "usdm" && (
                        <>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={USDM_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            USDM
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-arrow">
                            <ConversionArrow size={20} />
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CL8Y_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CL8Y
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-arrow">
                            <ConversionArrow size={20} />
                          </span>
                          <span className="timecurve-arena-buy-panel__conversion-token">
                            <img src={CHARM_TOKEN_LOGO} alt="" width={28} height={28} decoding="async" />
                            CHARM
                          </span>
                        </>
                      )}
                    </div>
                    <div className="timecurve-simple__rate-board" aria-live="polite">
                      <div className="timecurve-simple__rate-row timecurve-simple__rate-row--now">
                        <span className="timecurve-simple__rate-label-row">
                          <img
                            className="timecurve-simple__rate-glyph"
                            src={CHARM_TOKEN_LOGO}
                            alt=""
                            aria-hidden="true"
                            decoding="async"
                            width={24}
                            height={24}
                          />
                          <span className="timecurve-simple__rate-label">1 CHARM costs right now</span>
                        </span>
                        <div className="timecurve-simple__rate-paywith" role="group" aria-label="Show live price in">
                          {rateBoardPayOptions}
                        </div>
                        <span className="timecurve-simple__rate-value-row">
                          {payWith !== "cl8y" && rateBoardKumbayaWarning && (
                            <span
                              className="timecurve-simple__kumbaya-route-warn"
                              title="kumbaya route failed"
                              aria-label="kumbaya route failed"
                            >
                              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                                <path
                                  d="M10 2.5 17.5 16H2.5L10 2.5Z"
                                  fill="#e6c200"
                                  stroke="#8a7200"
                                  strokeWidth="1.2"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10 7v4.2"
                                  stroke="#5c4a00"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                />
                                <circle cx="10" cy="14.2" r="0.9" fill="#5c4a00" />
                              </svg>
                            </span>
                          )}
                          <strong
                            key={`${priceTickKey}-${payWith}-${rateNowDisplay.text}`}
                            className="timecurve-simple__rate-value timecurve-simple__rate-value--hero timecurve-simple__rate-value--tick"
                            data-testid="timecurve-arena-rate-now"
                            aria-busy={rateNowDisplay.loading}
                          >
                            {rateNowDisplay.text}
                            <span className="timecurve-simple__rate-unit">{rateNowDisplay.unit}</span>
                          </strong>
                        </span>
                        <span className="timecurve-simple__rate-foot muted">
                          {payWith === "cl8y"
                            ? "Ticks up every block — waiting costs CL8Y."
                            : "Underlying sale price is always CL8Y; ETH / USDM are Kumbaya routes into CL8Y."}
                        </span>
                      </div>
                      <div className="timecurve-simple__rate-row timecurve-simple__rate-row--launch">
                        <span className="timecurve-simple__rate-label">1 CHARM at launch</span>
                        <div className="timecurve-simple__rate-pair">
                          <span className="timecurve-simple__rate-pair-tile">
                            <span className="timecurve-simple__rate-pair-value">
                              {doubPerCharmAtLaunch !== undefined
                                ? formatCompactFromRaw(doubPerCharmAtLaunch, 18, { sigfigs: 5 })
                                : "—"}
                            </span>
                            <span className="timecurve-simple__rate-pair-unit">DOUB</span>
                          </span>
                          <span className="timecurve-simple__rate-pair-equals" aria-hidden="true">
                            =
                          </span>
                          <span
                            className={`timecurve-simple__rate-pair-tile timecurve-simple__rate-pair-tile--launch-pay-${payWith}`}
                          >
                            {payWith !== "cl8y" && rateBoardKumbayaWarning && (
                              <span
                                className="timecurve-simple__kumbaya-route-warn"
                                title="kumbaya route failed"
                                aria-label="kumbaya route failed"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  width="16"
                                  height="16"
                                  aria-hidden="true"
                                  focusable="false"
                                >
                                  <path
                                    d="M10 2.5 17.5 16H2.5L10 2.5Z"
                                    fill="#e6c200"
                                    stroke="#8a7200"
                                    strokeWidth="1.2"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10 7v4.2"
                                    stroke="#5c4a00"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                  />
                                  <circle cx="10" cy="14.2" r="0.9" fill="#5c4a00" />
                                </svg>
                              </span>
                            )}
                            <span className="timecurve-simple__rate-pair-value">
                              {rateLaunchDisplay.text}
                            </span>
                            <span className="timecurve-simple__rate-pair-unit">
                              {rateLaunchDisplay.unit.trim()}
                            </span>
                          </span>
                        </div>
                        <span className="timecurve-simple__rate-foot muted">
                          1.275× per-CHARM clearing price (locked DOUB/CL8Y LP). CL8Y projection only goes up.
                        </span>
                      </div>
                    </div>
                    <div className="timecurve-arena-buy-panel__checkout">
                      <div className="timecurve-arena-buy-panel__checkout-head">
                        <img src={paySpendLogo} alt="" width={24} height={24} decoding="async" />
                        <div>
                          <span>Set {paySpendSuffix} spend</span>
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
                            {payWith === "cl8y" ? (
                              <>
                                Live band&nbsp;
                                <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.minS, decimals)}</strong>
                                &nbsp;–&nbsp;
                                <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.maxS, decimals)}</strong>
                                &nbsp;CL8Y
                              </>
                            ) : bandBoundaryQuotesLoading ||
                              quotedBandMinPayInWei === undefined ||
                              quotedBandMaxPayInWei === undefined ? (
                              <>
                                Live band (≈{paySpendSuffix})&nbsp;…&nbsp;· CL8Y&nbsp;
                                <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.minS, decimals)}</strong>
                                &nbsp;–&nbsp;
                                <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.maxS, decimals)}</strong>
                              </>
                            ) : (
                              <>
                                Live band ≈&nbsp;
                                <strong>
                                  {formatBuyHubDerivedCompact(quotedBandMinPayInWei, payTokenDecimals)}
                                </strong>
                                &nbsp;–&nbsp;
                                <strong>
                                  {formatBuyHubDerivedCompact(quotedBandMaxPayInWei, payTokenDecimals)}
                                </strong>
                                &nbsp;{paySpendSuffix}&nbsp;
                                <span className="muted">
                                  (CL8Y&nbsp;
                                  <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.minS, decimals)}</strong>
                                  &nbsp;–&nbsp;
                                  <strong>{formatBuyHubDerivedCompact(cl8ySpendBounds.maxS, decimals)}</strong>)
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="timecurve-simple__minmax-row">
                          <span className="timecurve-simple__minmax">Loading live min – max…</span>
                        </div>
                      )}
                      {payWith !== "cl8y" && kumbayaRoutingBlocker && (
                        <StatusMessage variant="error">{kumbayaRoutingBlocker}</StatusMessage>
                      )}
                      {payWith !== "cl8y" && !kumbayaRoutingBlocker && swapQuoteFailed && (
                        <StatusMessage variant="error">
                          Could not quote this route (no liquidity or misconfigured pools for this chain).
                        </StatusMessage>
                      )}
                      {payWith !== "cl8y" && !kumbayaRoutingBlocker && !swapQuoteFailed && (
                        <p className="muted">
                          Kumbaya route uses a fixed <strong>3%</strong> max slippage cap on routed input.
                        </p>
                      )}
                      <div className="timecurve-cl8y-buy-controls">
                        <div className="timecurve-cl8y-buy-controls__balance muted">
                          Your {payWalletBalance.symbol} balance:{" "}
                          {isConnected ? (
                            payWalletBalance.raw !== undefined ? (
                              <AmountDisplay
                                raw={String(payWalletBalance.raw)}
                                decimals={payWalletBalance.decimals}
                              />
                            ) : (
                              "—"
                            )
                          ) : (
                            <span className="muted">Connect to read balance</span>
                          )}
                        </div>
                        {cl8ySpendBounds ? (
                          <div
                            className={`form-label timecurve-cl8y-buy-controls__slider-label timecurve-cl8y-buy-controls__slider-label--pay-${payWith}`}
                          >
                            <span>{paySpendSuffix} spend</span>
                            <input
                              type="range"
                              className="form-input"
                              min={0}
                              max={10000}
                              step={1}
                              value={spendSliderPermille}
                              onChange={(e) => onCl8ySpendSlider(Number(e.target.value))}
                              aria-label={`${paySpendSuffix} spend slider (targets CL8Y sale band)`}
                              style={{ "--arena-buy-slider-fill": `${spendSliderPermille / 100}%` } as CSSProperties}
                            />
                            {payWith === "cl8y" ? (
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
                            ) : (
                              <span
                                className="form-input timecurve-simple__amount-field--quoted"
                                aria-label={`Quoted ${paySpendSuffix} spend for the selected CL8Y target`}
                              >
                                {swapQuoteLoading || quotedPayInWei === undefined ? (
                                  "…"
                                ) : (
                                  <AmountDisplay
                                    raw={String(quotedPayInWei)}
                                    decimals={payTokenDecimals}
                                  />
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <StatusMessage variant="muted">
                            Waiting for onchain min/max spend reads…
                          </StatusMessage>
                        )}
                      </div>
                      {charmWadSelected !== undefined ? (
                        <div className="timecurve-simple__buy-preview" data-testid="timecurve-arena-buy-preview">
                          <div className="timecurve-simple__buy-preview-row">
                            <span className="timecurve-simple__buy-preview-label">You add</span>
                            <strong className="timecurve-simple__buy-preview-value">
                              {formatBuyHubDerivedCompact(charmWadSelected, 18)}
                            </strong>
                            <span className="timecurve-simple__buy-preview-unit">CHARM</span>
                          </div>
                          {buyAddsCl8yAtLaunch !== undefined && buyAddsCl8yAtLaunch > 0n && (
                            <div className="timecurve-simple__buy-preview-row timecurve-simple__buy-preview-row--launch">
                              <span className="timecurve-simple__buy-preview-label">Worth at launch ≈</span>
                              <strong className="timecurve-simple__buy-preview-value">
                                {formatBuyHubDerivedCompact(buyAddsCl8yAtLaunch, decimals)}
                              </strong>
                              <span className="timecurve-simple__buy-preview-unit">CL8Y</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="timecurve-simple__buy-preview timecurve-simple__buy-preview--loading">
                          Loading CHARM preview…
                        </div>
                      )}
                      {referralRegistryOn && pendingRef && (
                        <div className="timecurve-simple__referral muted">
                          <label>
                            <input
                              type="checkbox"
                              checked={useReferral}
                              onChange={(e) => setUseReferral(e.target.checked)}
                              disabled={!isConnected}
                            />{" "}
                            Apply pending referral code <code>{normalizeReferralCode(pendingRef)}</code>
                          </label>
                        </div>
                      )}
                      <div className="timecurve-arena-buy-panel__warbow-plant">
                        <label>
                          <input
                            type="checkbox"
                            checked={plantWarBowFlag}
                            onChange={(e) => setPlantWarBowFlag(e.target.checked)}
                            disabled={!isConnected}
                          />{" "}
                          Plant WarBow flag
                        </label>
                        {plantWarBowFlag ? (
                          <p className="muted">
                            Opt-in: this buy can set you as the global pending flag holder. After the silence
                            window, another buyer may cost you Battle Points if you do not claim in time — see{" "}
                            <Link to="/timecurve?view=protocol">protocol copy</Link> and{" "}
                            <a href="https://gitlab.com/PlasticDigits/yieldomega/-/issues/63">issue #63</a>.
                          </p>
                        ) : (
                          <p className="muted">
                            Global pending-flag slot: check → after silence, <strong>+1000 BP</strong> if you claim in
                            time, or <strong>−2000 BP</strong> if another buy clears you after claim opens. Unchecked:
                            CHARM only, slot unchanged.
                          </p>
                        )}
                      </div>
                      <Cl8yTimeCurveUnlimitedApprovalFieldset disabled={!isConnected} />
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
                            className={[
                              "btn-primary btn-primary--priority timecurve-simple__cta timecurve-simple__cta--arcade",
                              chainMismatch ? "timecurve-simple__cta--wrong-network" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-testid="timecurve-arena-buy-charm-cta"
                            disabled={
                              isWriting ||
                              chainMismatch ||
                              walletCooldownRemainingSec > 0 ||
                              charmWadSelected === undefined ||
                              charmWadSelected <= 0n ||
                              !cl8ySpendBounds ||
                              nonCl8yBuyBlocked ||
                              buyFeeRoutingEnabled === false
                            }
                            title={
                              chainMismatch ? chainMismatchWriteMessage(walletChainId) ?? undefined : undefined
                            }
                            onClick={() => void handleBuy()}
                            {...(chainMismatch ? {} : primaryButtonMotion)}
                          >
                            <img
                              className="timecurve-simple__cta-glyph"
                              src={CHARM_TOKEN_LOGO}
                              alt=""
                              aria-hidden="true"
                              width={28}
                              height={28}
                              decoding="async"
                            />
                            <span className="timecurve-simple__cta-label">
                              {isWriting
                                ? "Confirm in wallet…"
                                : payWith !== "cl8y" && swapQuoteLoading
                                  ? "Refreshing quote…"
                                  : "Buy CHARM"}
                            </span>
                          </motion.button>
                          {walletCooldownRemainingSec > 0 && (
                            <StatusMessage variant="muted">
                              Buy cooldown · {formatCountdown(walletCooldownRemainingSec)} left
                            </StatusMessage>
                          )}
                          <StatusMessage variant={gasBuyIssue || swapQuoteFailed ? "error" : "muted"}>
                            {buyPanelRisk}
                          </StatusMessage>
                        </>
                      )}
                    </div>
                  </>
                )}
                {buyErr && <StatusMessage variant="error">{buyErr}</StatusMessage>}
              </PageSection>
              </ChainMismatchWriteBarrier>
            </div>
            <div className="timer-hero__arena-rail">
              <div className="timer-hero__clock-stack">
            <div className="timer-hero__label">
              {saleActive
                ? "Time Remaining"
                : saleEnded
                  ? "Sale Ended"
                  : arenaPhase === "saleStartPending"
                    ? "TimeCurve Opens In"
                    : timerExpiredAwaitingEnd
                      ? "Round timer ended"
                      : "Starts In"}
            </div>
            <div
              className="timer-hero__countdown"
              aria-label={
                arenaPhase === "saleStartPending"
                  ? secondsRemaining !== undefined
                    ? `TimeCurve Opens In, ${formatCountdown(secondsRemaining)}`
                    : "TimeCurve Opens In"
                  : undefined
              }
              aria-live="polite"
            >
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
                  <div
                    className="timer-hero__total-usd-block"
                    title={ARENA_TOTAL_USD_EQUIV_TITLE}
                  >
                    <div className="timer-hero__total-usd">TOTAL USD: {totalRaiseDisplay.usd}</div>
                    {totalRaiseUsdFreshness ? (
                      <div className="timer-hero__total-usd-affordance">
                        CL8Y total seen {totalRaiseUsdFreshness} · USD is illustrative (1 CL8Y = $1)
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
              <TimerHeroLiveBuys
                buys={buys}
                indexedTotal={buysTotal}
                indexerNote={indexerNote}
                formatWallet={formatWallet}
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
          coinSrc={DOUB_TOKEN_LOGO}
          coinAlt="DOUB token glyph"
          sceneSrc="/art/scenes/timecurve-arena.jpg"
          lede={
            <>
              <strong>WarBow is the Arena.</strong> Steal when you are behind, guard before rivals drain you, and
              answer a pending stealer before revenge expires. New here? Start on <Link to="/timecurve">Simple</Link>{" "}
              for the calmer buy path.
            </>
          }
          mascot={{
            src: "/art/cutouts/bunny-podium-win.png",
            width: 220,
            height: 220,
            className: "cutout-decoration--float",
          }}
        >
          <ChainMismatchWriteBarrier testId="timecurve-arena-hero-warbow-chain-write-gate">
            <WarbowHeroActions
              saleActive={saleActive}
              saleEnded={saleEnded}
              isConnected={isConnected}
              address={address}
              formatWallet={formatWallet}
              viewerBattlePoints={viewerBattlePoints?.toString()}
              stealCandidates={warbowStealCandidates}
              stealVictim={stealVictim}
              setStealVictimInput={setStealVictimInput}
              victimStealsToday={victimStealsTodayBigInt?.toString()}
              victimBattlePoints={victimBattlePointsBigInt?.toString()}
              warbowMaxSteals={warbowMaxSteals}
              stealBypass={stealBypass}
              setStealBypass={setStealBypass}
              stealPreflight={stealPreflight}
              warbowPreflightIssue={warbowPreflightIssue}
              runWarBowSteal={runWarBowSteal}
              runWarBowGuard={runWarBowGuard}
              runWarBowRevenge={runWarBowRevenge}
              guardedActive={guardedActive}
              guardUntilSec={guardUntilSec.toString()}
              hasRevengeOpen={hasRevengeOpen}
              pendingRevengeTargets={pendingRevengeTargets}
              revengeIndexerConfigured={revengeIndexerConfigured}
              revengeDeadlineSec={revengeDeadlineSec.toString()}
              warbowGuardBurnWad={warbowGuardBurnWad.toString()}
              warbowBypassBurnWad={warbowBypassBurnWad.toString()}
              buyFeeRoutingEnabled={buyFeeRoutingEnabled}
              isWriting={isWriting}
            />
          </ChainMismatchWriteBarrier>
          {pvpErr && <StatusMessage variant="error">{pvpErr}</StatusMessage>}
        </PageHeroArcadeBanner>
      </div>

      <WhatMattersSection
        saleActive={saleActive}
        saleEnded={saleEnded}
        timerExpiredAwaitingEnd={timerExpiredAwaitingEnd}
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

        <ChainMismatchWriteBarrier testId="timecurve-arena-standings-chain-write-gate">
        <PageSection
          title={
            showPostRoundSettlementPanel
              ? saleEnded
                ? "After sale actions"
                : "Round over — settle onchain"
              : "Standings and prize chase"
          }
          badgeLabel={
            showPostRoundSettlementPanel ? (saleEnded ? "Redeem and settle" : "End sale first") : "Competitive surface"
          }
          badgeTone={showPostRoundSettlementPanel ? "warning" : "live"}
          spotlight
          className="timecurve-panel timecurve-panel--status"
          cutout={{
            src: "/art/cutouts/mascot-leprechaun-with-bag-cutout.png",
            width: 228,
            height: 228,
            className: "panel-cutout panel-cutout--lower-right cutout-decoration--float",
          }}
          lede={
            showPostRoundSettlementPanel
              ? saleEnded
                ? "When the timer expires, use this panel to end the round, redeem charms, and settle the reserve podium pool."
                : "The live timer is past deadline. Call End sale first (any wallet may submit). Then redeem CHARM for DOUB and, when you are the owner with payouts enabled, distribute reserve prizes."
              : "Scan the live ladder, podium leaders, and momentum before you choose whether to buy, defend, or press PvP."
          }
        >
          {showPostRoundSettlementPanel ? (
            <>
              <div className="timecurve-action-row">
                {!onchainEnded && (
                  <motion.button
                    type="button"
                    className="btn-secondary btn-secondary--critical"
                    disabled={isWriting || chainMismatch}
                    data-testid="timecurve-arena-end-sale"
                    onClick={() => runVoid("endSale")}
                    {...secondaryButtonMotion}
                  >
                    End sale
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting || chainMismatch || !onchainEnded}
                  data-testid="timecurve-arena-redeem-charms"
                  title={
                    !onchainEnded
                      ? "Run End sale onchain first — redeemCharms requires TimeCurve.ended()."
                      : undefined
                  }
                  onClick={() => runVoid("redeemCharms")}
                  {...secondaryButtonMotion}
                >
                  Redeem charms
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--priority"
                  disabled={isWriting || chainMismatch || !canDistributePrizesAsOwner || !onchainEnded}
                  data-testid="timecurve-arena-distribute-prizes"
                  title={
                    !onchainEnded
                      ? "Run End sale onchain first — distributePrizes requires TimeCurve.ended()."
                      : undefined
                  }
                  onClick={() => runVoid("distributePrizes")}
                  {...secondaryButtonMotion}
                >
                  Distribute prizes
                </motion.button>
              </div>
              {!onchainEnded && (
                <StatusMessage variant="muted">
                  Redeem charms and Distribute prizes stay disabled until <strong>End sale</strong> succeeds —{" "}
                  <code>redeemCharms</code> and <code>distributePrizes</code> require <code>ended == true</code> on{" "}
                  <code>TimeCurve</code>.
                </StatusMessage>
              )}
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
                        <AddressInline address={bar.wallet} formatWallet={formatWallet} size={16} />
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
        </ChainMismatchWriteBarrier>
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

      <ChainMismatchWriteBarrier testId="timecurve-arena-warbow-chain-write-gate">
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
        pendingRevengeTargets={pendingRevengeTargets}
        revengeIndexerConfigured={revengeIndexerConfigured}
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
      </ChainMismatchWriteBarrier>
      {pvpErr && <StatusMessage variant="error">{pvpErr}</StatusMessage>}

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
        envelopeParams={buyEnvelopeParams}
      />

      <RawDataAccordion
        hasCoreContractReads={Boolean(coreTcData && coreTcData.length > 0)}
        saleStart={serializeContractRead(saleStart)}
        deadline={serializeContractRead(deadline)}
        secondsRemaining={secondsRemaining}
        countdownSecondsContext={
          arenaPhase === "saleStartPending"
            ? "untilOpen"
            : arenaPhase === "saleActive" || arenaPhase === "saleExpiredAwaitingEnd"
              ? "untilRoundDeadline"
              : "generic"
        }
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
        pendingRevengeTargets={pendingRevengeTargets}
        revengeIndexerConfigured={revengeIndexerConfigured}
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
