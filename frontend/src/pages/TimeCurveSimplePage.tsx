// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { TxHash } from "@/components/TxHash";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { fetchTimecurveBuys, type BuyItem } from "@/lib/indexerApi";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { shortAddress } from "@/lib/addressFormat";
import {
  doubPerCharmAtLaunchWad,
  participantLaunchValueCl8yWei,
} from "@/lib/timeCurvePodiumMath";
import { formatCountdown } from "@/pages/timecurve/formatTimer";
import { phaseBadge, phaseNarrative } from "@/pages/timecurve/timeCurveSimplePhase";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { TimeCurveTimerHero } from "@/pages/timecurve/TimeCurveTimerHero";
import { useTimeCurveSaleSession } from "@/pages/timecurve/useTimeCurveSaleSession";

/**
 * Default `/timecurve` view — the **simple, first-run path** described in
 * issue #40. The page surfaces only what a new visitor needs: time remaining,
 * the single primary buy action, and what their CHARM is currently worth in
 * CL8Y at launch (the **launch-anchor invariant**: `1.2 × per-CHARM price`,
 * see [`launchplan-timecurve.md`](../../launchplan-timecurve.md) and
 * [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md)).
 *
 * The buy panel shows the full **rate chain** `1 CHARM = X DOUB = Y CL8Y at
 * launch` so participants can see where the CL8Y projection comes from, plus
 * the **current per-CHARM CL8Y price** big and featured (it ticks up every
 * block, so it's the most important number on the page). We **never display
 * the projected DOUB count for a wallet's holdings** — DOUB-per-CHARM dilutes
 * as `totalCharmWeight` grows, and showing a *personal* number that decreases
 * as new buyers arrive scares first-run users; the per-wallet stake panel
 * therefore only shows CHARM held + CL8Y-equivalent at launch (which is the
 * **non-decreasing** projection of the same allocation).
 *
 * Contract: this page never owns game state. It uses
 * {@link useTimeCurveSaleSession}, which delegates writes to the same
 * `TimeCurve` ABI used by the Arena view, so the contract remains the single
 * source of truth (see `docs/frontend/timecurve-views.md`).
 */
const HERO_LEDE =
  "Buy CHARM with CL8Y to lock in your share of the DOUB launch. Your CHARM only grows in CL8Y value as the sale heats up — the timer is the only thing in your way.";

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

const WAD = 10n ** 18n;

export function TimeCurveSimplePage() {
  const tc = addresses.timeCurve;
  const session = useTimeCurveSaleSession(tc);
  const prefersReducedMotion = useReducedMotion();

  const phaseInfo = phaseBadge(session.phase);

  const heroSecondsRemaining =
    session.phase === "saleActive" || session.phase === "saleExpiredAwaitingEnd"
      ? session.saleCountdownSec
      : session.preStartCountdownSec;
  // Timer-panel badge label: reuse the sale-phase label so the badge adds
  // information instead of repeating "Time remaining" alongside the
  // section H2 "Time left" (Iteration 3 dedupe). The phase tone (live /
  // soon / warning) stays driven by `phaseInfo.tone`.
  const heroLabel = phaseInfo.label;

  const heroNarrative = phaseNarrative(session.phase);

  const [recentBuys, setRecentBuys] = useState<BuyItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const buys = await fetchTimecurveBuys(3, 0);
        if (!cancelled && buys) setRecentBuys(buys.items);
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Launch-anchor invariant (DoubLPIncentives policy): 1 CHARM is projected
  // to be worth `1.2 × pricePerCharmWad` CL8Y at launch. We expose three
  // derived numbers for the UI: the per-CHARM caption ("1 CHARM = X CL8Y at
  // launch"), the buy-delta ("This buy adds ≈ Y CL8Y of launch value"), and
  // the live DOUB-per-CHARM redemption rate ("1 CHARM = N DOUB at launch")
  // so the rate board can show the full chain. All three reuse the shared
  // helpers covered by `timeCurvePodiumMath.test.ts`.
  const launchCl8yPerCharmWei = useMemo(
    () =>
      participantLaunchValueCl8yWei({
        charmWeightWad: WAD,
        pricePerCharmWad: session.pricePerCharmWad,
      }),
    [session.pricePerCharmWad],
  );
  const buyAddsCl8yAtLaunch = useMemo(
    () =>
      participantLaunchValueCl8yWei({
        charmWeightWad: session.charmWadSelected,
        pricePerCharmWad: session.pricePerCharmWad,
      }),
    [session.charmWadSelected, session.pricePerCharmWad],
  );
  const doubPerCharmAtLaunch = useMemo(
    () =>
      doubPerCharmAtLaunchWad({
        totalTokensForSaleWad: session.totalTokensForSaleWad,
        totalCharmWeightWad: session.totalCharmWeightWad,
      }),
    [session.totalTokensForSaleWad, session.totalCharmWeightWad],
  );

  // Price-tick pulse: bump a key whenever the live per-CHARM price changes
  // so the rate row re-renders and the CSS animation re-runs. This keeps
  // the "ticks up every block" message visceral instead of just textual.
  // We avoid setTimeout / explicit animation lifecycle management by
  // letting React's `key` prop drive the re-mount.
  const priceTickKeyRef = useRef(0);
  const priceTickPrevRef = useRef<bigint | undefined>(undefined);
  if (
    session.pricePerCharmWad !== undefined &&
    priceTickPrevRef.current !== session.pricePerCharmWad
  ) {
    priceTickPrevRef.current = session.pricePerCharmWad;
    priceTickKeyRef.current += 1;
  }
  const priceTickKey = priceTickKeyRef.current;

  // "Just extended" chip on the timer panel — the most recent buy that
  // actually moved the clock (any extension ≥ 1s, including hard resets).
  // Sourced from the already-fetched `recentBuys` so this is free; only
  // renders when the sale is active and the indexer has at least one buy.
  const lastExtension = useMemo(() => {
    if (!recentBuys || recentBuys.length === 0) return null;
    for (const b of recentBuys) {
      const reset = Boolean(b.timer_hard_reset);
      let secs = 0;
      try {
        secs = b.actual_seconds_added ? Number(BigInt(b.actual_seconds_added)) : 0;
      } catch {
        secs = 0;
      }
      if (reset || secs > 0) {
        return { buyer: b.buyer, reset, secs };
      }
    }
    return null;
  }, [recentBuys]);

  const slider = session.cl8ySpendBounds ? (
    <div className="timecurve-simple__slider-row">
      <input
        type="range"
        min={0}
        max={10000}
        step={1}
        value={session.spendSliderPermille}
        onChange={(e) => session.setSpendFromSliderPermille(Number(e.target.value))}
        aria-label="CL8Y spend slider"
        className="timecurve-simple__slider"
        disabled={session.phase !== "saleActive" || !session.walletConnected}
      />
      <div className="timecurve-simple__amount-input">
        <input
          type="text"
          inputMode="decimal"
          aria-label="Exact CL8Y spend"
          className="form-input timecurve-simple__amount-field"
          value={session.spendInputStr}
          onChange={(e) => session.setSpendFromInput(e.target.value)}
          onBlur={() => session.setSpendFromInputBlur()}
          disabled={session.phase !== "saleActive" || !session.walletConnected}
        />
        <span className="timecurve-simple__amount-suffix">CL8Y</span>
      </div>
    </div>
  ) : null;

  const minMaxPill = session.cl8ySpendBounds ? (
    <span className="timecurve-simple__minmax">
      Live band&nbsp;
      <strong>{formatCompactFromRaw(session.cl8ySpendBounds.minS, session.decimals)}</strong>&nbsp;–&nbsp;
      <strong>{formatCompactFromRaw(session.cl8ySpendBounds.maxS, session.decimals)}</strong>
      &nbsp;CL8Y
    </span>
  ) : (
    <span className="timecurve-simple__minmax">Loading live min – max…</span>
  );

  const buyPreview =
    session.charmWadSelected !== undefined ? (
      <div className="timecurve-simple__buy-preview" data-testid="timecurve-simple-buy-preview">
        <div className="timecurve-simple__buy-preview-row">
          <span className="timecurve-simple__buy-preview-label">You add</span>
          <strong className="timecurve-simple__buy-preview-value">
            {formatCompactFromRaw(session.charmWadSelected, 18, { sigfigs: 4 })}
          </strong>
          <span className="timecurve-simple__buy-preview-unit">CHARM</span>
        </div>
        {buyAddsCl8yAtLaunch !== undefined && buyAddsCl8yAtLaunch > 0n && (
          <div className="timecurve-simple__buy-preview-row timecurve-simple__buy-preview-row--launch">
            <span className="timecurve-simple__buy-preview-label">Worth at launch ≈</span>
            <strong className="timecurve-simple__buy-preview-value">
              {formatCompactFromRaw(buyAddsCl8yAtLaunch, session.decimals, { sigfigs: 4 })}
            </strong>
            <span className="timecurve-simple__buy-preview-unit">CL8Y</span>
          </div>
        )}
      </div>
    ) : (
      <div className="timecurve-simple__buy-preview timecurve-simple__buy-preview--loading">
        Loading CHARM preview…
      </div>
    );

  const nonCl8yBlocked =
    session.payWith !== "cl8y" &&
    (session.kumbayaRoutingBlocker !== null ||
      session.swapQuoteFailed ||
      session.quotedPayInWei === undefined ||
      session.swapQuoteLoading);

  const buyDisabled =
    session.phase !== "saleActive" ||
    session.isWriting ||
    !session.walletConnected ||
    session.walletCooldownRemainingSec > 0 ||
    session.charmWadSelected === undefined ||
    nonCl8yBlocked ||
    session.buyFeeRoutingEnabled === false;

  const { data: nativeBal } = useBalance({
    address: session.walletAddress,
    query: { enabled: Boolean(session.walletAddress && session.payWith === "eth") },
  });

  const buyButtonMotion = prefersReducedMotion
    ? {}
    : { whileHover: { y: -2 }, whileTap: { scale: 0.985 } };

  const cooldownLine =
    session.walletCooldownRemainingSec > 0
      ? `Buy cooldown · ${formatCountdown(session.walletCooldownRemainingSec)} left`
      : null;

  const headerContent = (
    <div className="timecurve-simple__hero-meta">
      {session.deadlineSec !== undefined && session.phase !== "saleStartPending" && (
        <span className="muted">
          Deadline (chain time):{" "}
          <UnixTimestampDisplay raw={String(session.deadlineSec)} />
        </span>
      )}
      {session.saleStartSec !== undefined && session.phase === "saleStartPending" && (
        <span className="muted">
          Sale opens (chain time):{" "}
          <UnixTimestampDisplay raw={String(session.saleStartSec)} />
        </span>
      )}
    </div>
  );

  const stakePanelVisible =
    session.walletConnected &&
    session.charmWeightWad !== undefined &&
    (session.phase === "saleActive" ||
      session.phase === "saleEnded" ||
      session.phase === "saleExpiredAwaitingEnd");

  const launchHelperCopy =
    launchCl8yPerCharmWei !== undefined
      ? `1 CHARM ≈ ${formatCompactFromRaw(launchCl8yPerCharmWei, session.decimals, { sigfigs: 4 })} CL8Y at launch`
      : "Loading launch projection…";

  // Rate board (top of buy panel) — the **single most-important number on
  // the page** is the live current per-CHARM CL8Y price (it ticks up every
  // block; waiting costs money). We pair it with the at-launch chain so the
  // user can see where the "your stake is worth Y CL8Y at launch" projection
  // comes from: `1 CHARM = N DOUB = M CL8Y at launch`. The CL8Y projection
  // is the canonical 1.2× anchor (`participantLaunchValueCl8yWei`); the DOUB
  // figure is `totalTokensForSale / totalCharmWeight` (decreases as more
  // CHARM mints). Live updates come for free because both inputs refresh on
  // every block via the hook's wagmi reads.
  // Hero price formatter: fixed 6 fractional digits so per-block ticks of
  // ~1e-5 CL8Y are *visibly* obvious (compact / sigfigs=5 hides them when
  // the integer portion is already large). This is intentionally NOT the
  // same formatter used elsewhere — the "single most important number on
  // the page" deserves precision, even if it means the trailing digits
  // shimmer between blocks.
  function formatPriceFixed6(raw: bigint): string {
    const s = formatUnits(raw, 18); // e.g. "1.000023456789012345"
    const [intPart, fracPart = ""] = s.split(".");
    return `${intPart}.${(fracPart + "000000").slice(0, 6)}`;
  }
  const rateBoard = (
    <div
      className="timecurve-simple__rate-board"
      data-testid="timecurve-simple-rate-board"
      aria-live="polite"
    >
      <div className="timecurve-simple__rate-row timecurve-simple__rate-row--now">
        <span className="timecurve-simple__rate-label-row">
          {/* CHARM coin glyph + ↑ tick badge make "what you're buying"
              and "the price ticks up every block" instantly readable
              before the user parses any text. Decorative; the textual
              label remains the source of truth for assistive tech. */}
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
          data-testid="timecurve-simple-rate-now"
        >
          {session.pricePerCharmWad !== undefined ? formatPriceFixed6(session.pricePerCharmWad) : "—"}
          <span className="timecurve-simple__rate-unit"> CL8Y</span>
        </strong>
        <span className="timecurve-simple__rate-foot muted">
          Ticks up every block — waiting costs CL8Y.
        </span>
      </div>
      <div className="timecurve-simple__rate-row timecurve-simple__rate-row--launch">
        <span className="timecurve-simple__rate-label">1 CHARM at launch</span>
        {/* Stack the DOUB and CL8Y values into two compact rate-pair tiles
            so the equation never wraps mid-number. Iteration 3 fix: the
            single-line "X DOUB = Y CL8Y" was wrapping awkwardly on
            mid-width panels; tiling reads cleaner and keeps both numbers
            equally readable. */}
        <div className="timecurve-simple__rate-pair">
          <span
            className="timecurve-simple__rate-pair-tile"
            data-testid="timecurve-simple-rate-launch"
          >
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
          <span className="timecurve-simple__rate-pair-tile timecurve-simple__rate-pair-tile--cl8y">
            <span className="timecurve-simple__rate-pair-value">
              {launchCl8yPerCharmWei !== undefined
                ? formatPriceFixed6(launchCl8yPerCharmWei)
                : "—"}
            </span>
            <span className="timecurve-simple__rate-pair-unit">CL8Y</span>
          </span>
        </div>
        <span className="timecurve-simple__rate-foot muted">
          1.2× per-CHARM clearing price (locked DOUB/CL8Y LP). CL8Y projection only goes up.
        </span>
      </div>
    </div>
  );

  return (
    <div className="page timecurve-simple-page">
      <TimeCurveSubnav active="simple" />

      {/* Sale hub — timer + primary buy action share the spotlight row above
          the fold, so the single most valuable action is the first thing a
          first-run user sees. The hero (title + lede + deadline) sits BELOW
          the hub so the page leads with action and the hero acts as the
          context strip explaining what the hub does. */}
      <div className="timecurve-simple__hub">
        <PageSection
          title="Time left"
          spotlight
          className="timecurve-simple__timer-panel"
          badgeLabel={heroLabel}
          badgeTone={phaseInfo.tone}
          lede={heroNarrative}
        >
          <TimeCurveTimerHero
            secondsRemaining={heroSecondsRemaining}
            foot={
              <>
                {session.phase === "saleActive" &&
                  "Every buy adds 2 minutes; clutch buys hard-reset the clock."}
                {session.phase === "saleEnded" &&
                  (session.charmRedemptionEnabled === false
                    ? "Redemptions await onchain go-live (operator / governance signoff)."
                    : "Holders of CHARM can claim their DOUB share.")}
                {session.phase === "saleStartPending" &&
                  "Stay on this page — it switches to Live automatically."}
                {session.phase === "saleExpiredAwaitingEnd" &&
                  "Anyone can call endSale() now — see the Arena view."}
              </>
            }
          />
          {/* Calm "fair-launch" sidekick. The art README (`frontend/public/art/
              README.md`) earmarks this cutout for the Simple-view timer panel
              specifically — it grounds the dark arcade stage in the Yieldomega
              cast without competing with the digits (anchored bottom-left,
              clipped by the panel's own `overflow: hidden`). */}
          <CutoutDecoration
            className="panel-cutout panel-cutout--pair-mascot cutout-decoration--bob"
            src="/art/cutouts/leprechaun-bag-bunny-pair.png"
            width={260}
            height={260}
          />
          {/* Live "just extended" chip — anchored to the bottom-right of
              the dark stage so the most recent buy that bumped the clock
              feels alive without crowding the digits. Only renders when
              the sale is active and the indexer has a qualifying buy. */}
          {session.phase === "saleActive" && lastExtension && (
            <span
              className={
                lastExtension.reset
                  ? "timecurve-simple__last-extension timecurve-simple__last-extension--reset"
                  : "timecurve-simple__last-extension"
              }
              aria-live="polite"
              data-testid="timecurve-simple-last-extension"
            >
              <span className="timecurve-simple__last-extension-dot" aria-hidden="true" />
              {lastExtension.reset ? (
                <>
                  Hard reset by{" "}
                  <span className="timecurve-simple__last-extension-addr">
                    {shortAddress(lastExtension.buyer)}
                  </span>
                </>
              ) : (
                <>
                  Just +{lastExtension.secs}s by{" "}
                  <span className="timecurve-simple__last-extension-addr">
                    {shortAddress(lastExtension.buyer)}
                  </span>
                </>
              )}
            </span>
          )}
        </PageSection>

        <PageSection
          title={session.phase === "saleEnded" ? "Redeem CHARM" : "Buy CHARM"}
          spotlight
          className="timecurve-simple__buy-panel"
          badgeLabel={
            session.phase === "saleActive"
              ? "Primary action"
              : session.phase === "saleEnded"
                ? "Settlement"
                : "Coming soon"
          }
          badgeTone={
            // Iteration 3: gold "warning" tone for the live sale matches the
            // honey vending-machine panel chrome (the green "live" tone
            // clashed with the gold gradient). Semantics survive: UX-wise
            // the badge still flags "this is the most actionable thing on
            // the page".
            session.phase === "saleActive" ? "warning" : "info"
          }
          lede={
            session.phase === "saleEnded"
              ? session.charmRedemptionEnabled === false
                ? "The sale is over. DOUB allocation redemptions are gated onchain until the owner enables them (issue #55)."
                : "The sale is over. Redeem CHARM to mint your DOUB share onchain."
              : session.phase === "saleActive"
                ? "Buy now or pay more later — every block, CHARM costs more CL8Y."
                : "The sale will open here when the timer hits zero."
          }
        >
          {/* "Vending machine" sidekick — anchors the gold buy panel to
              the Yieldomega cast and visually echoes "this is where you
              spend coins". The bob loop is suppressed for users with
              `prefers-reduced-motion` via the shared rule below. */}
          <CutoutDecoration
            className="panel-cutout panel-cutout--coin-stack"
            src="/art/hat-coin-stack.png"
            width={180}
            height={180}
          />
          {/* Live rate board: current price (big, ticks every block) +
              at-launch chain (1 CHARM = N DOUB = M CL8Y at 1.2× anchor). */}
          {session.phase === "saleActive" && rateBoard}

          {!session.walletConnected && session.phase !== "loading" && (
            <div className="timecurve-simple__connect">
              <p className="timecurve-simple__connect-pitch">
                Connect a wallet to mint CHARM and lock in your DOUB launch share.
              </p>
              <WalletConnectButton />
            </div>
          )}

          {session.phase === "saleActive" && session.walletConnected && (
            <>
              <div className="timecurve-simple__minmax-row">{minMaxPill}</div>
              {slider}
              {buyPreview}
              {session.buyFeeRoutingEnabled === false && (
                <StatusMessage variant="muted">
                  Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable.
                </StatusMessage>
              )}
              <motion.button
                type="button"
                className="btn-primary btn-primary--priority timecurve-simple__cta timecurve-simple__cta--arcade"
                disabled={buyDisabled}
                onClick={() => void session.submitBuy()}
                {...buyButtonMotion}
              >
                {/* Inline CHARM coin glyph turns the CTA into a clear "do
                    the thing with the coin" arcade lever — newbies don't
                    need to read the label to know which button mints
                    CHARM. Decorative; label remains the source of truth. */}
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
                  {session.isWriting
                    ? "Submitting…"
                    : session.payWith !== "cl8y" && session.swapQuoteLoading
                      ? "Refreshing quote…"
                      : "Buy CHARM"}
                </span>
              </motion.button>
              {cooldownLine && <StatusMessage variant="muted">{cooldownLine}</StatusMessage>}
              {session.buyError && (
                <StatusMessage variant="error">
                  {session.buyError}{" "}
                  <button
                    type="button"
                    className="btn-secondary timecurve-simple__error-dismiss"
                    onClick={() => session.clearBuyError()}
                  >
                    dismiss
                  </button>
                </StatusMessage>
              )}

              {/* Advanced: pay-with, slippage, referral. Hidden by default
                  so first-run buyers see the slider + CTA + launch value only.
                  Returning power users open this once and stay open via
                  browser autofill of `<details open>` state. */}
              <details className="timecurve-simple__advanced">
                <summary className="timecurve-simple__advanced-summary">
                  Advanced (pay with ETH/USDM, slippage, referral)
                </summary>
                <div className="timecurve-simple__advanced-body">
                  <div className="timecurve-simple__paywith muted" role="group" aria-label="Pay with">
                    <span className="timecurve-simple__paywith-label">Pay with</span>
                    {(
                      [
                        ["cl8y", "CL8Y"],
                        ["eth", "ETH"],
                        ["usdm", "USDM"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="timecurve-simple__paywith-option">
                        <input
                          type="radio"
                          name="timecurve-pay-with"
                          value={key}
                          checked={session.payWith === key}
                          onChange={() => session.setPayWith(key)}
                        />{" "}
                        {label}
                      </label>
                    ))}
                  </div>
                  {session.payWith !== "cl8y" && (
                    <p className="muted timecurve-simple__kumbaya-note">
                      ETH and USDM route through Kumbaya v3 first; the sale always settles in CL8Y.
                    </p>
                  )}
                  {session.kumbayaRoutingBlocker && session.payWith !== "cl8y" && (
                    <StatusMessage variant="error">{session.kumbayaRoutingBlocker}</StatusMessage>
                  )}
                  {session.payWith !== "cl8y" && session.swapQuoteLoading && (
                    <StatusMessage variant="muted">Fetching DEX quote…</StatusMessage>
                  )}
                  {session.payWith !== "cl8y" && session.swapQuoteFailed && (
                    <StatusMessage variant="error">
                      Could not quote this route (no liquidity or misconfigured pools for this chain).
                    </StatusMessage>
                  )}
                  {session.payWith !== "cl8y" && session.quotedPayInWei !== undefined && (
                    <p className="muted">
                      Quote: spend up to ≈{" "}
                      <AmountDisplay
                        raw={String(session.quotedPayInWei)}
                        decimals={session.payTokenDecimals}
                      />{" "}
                      {session.payWith === "eth" ? "WETH" : "USDM"} before slippage cap (
                      {(session.slippageBps / 100).toFixed(2)}% extra headroom).
                    </p>
                  )}
                  {session.payWith === "eth" && nativeBal && (
                    <p className="muted">
                      Native ETH balance:{" "}
                      <AmountDisplay raw={String(nativeBal.value)} decimals={nativeBal.decimals} />{" "}
                      {nativeBal.symbol}
                    </p>
                  )}
                  <div className="timecurve-simple__slippage muted">
                    <label>
                      Slippage (basis points, max 500){" "}
                      <input
                        type="number"
                        className="form-input timecurve-simple__slippage-input"
                        min={0}
                        max={500}
                        step={10}
                        value={session.slippageBps}
                        onChange={(e) => session.setSlippageBps(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="timecurve-simple__balance-row">
                    <PageBadge label="Wallet balance" tone="info" />
                    <span>
                      {session.walletBalanceWei !== undefined ? (
                        <AmountDisplay
                          raw={String(session.walletBalanceWei)}
                          decimals={session.decimals}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  {session.referralRegistryOn && session.pendingReferralCode && (
                    <div className="timecurve-simple__referral muted">
                      <label>
                        <input
                          type="checkbox"
                          checked={session.useReferral}
                          onChange={(e) => session.setUseReferral(e.target.checked)}
                        />{" "}
                        Apply pending referral code <code>{session.pendingReferralCode}</code>
                      </label>
                    </div>
                  )}
                </div>
              </details>
            </>
          )}

          {session.phase === "saleEnded" && session.walletConnected && (
            <>
              {session.charmRedemptionEnabled === false && (
                <StatusMessage variant="muted">
                  The contract has not enabled redeemCharms yet — this is expected before final go-live (issue #55).
                </StatusMessage>
              )}
              <motion.button
                type="button"
                className="btn-primary timecurve-simple__cta"
                disabled={
                  session.isWriting ||
                  session.charmsRedeemed === true ||
                  session.charmWeightWad === undefined ||
                  session.charmWeightWad === 0n ||
                  session.charmRedemptionEnabled === false
                }
                onClick={() => void session.submitRedeem()}
                {...buyButtonMotion}
              >
                {session.charmsRedeemed
                  ? "Already redeemed"
                  : session.isWriting
                    ? "Submitting…"
                    : "Redeem CHARM"}
              </motion.button>
              {session.buyError && (
                <StatusMessage variant="error">{session.buyError}</StatusMessage>
              )}
            </>
          )}

          {session.phase === "saleStartPending" && (
            <StatusMessage variant="muted">
              The sale has not opened yet. The Buy CHARM action will unlock automatically when the
              countdown above reaches zero.
            </StatusMessage>
          )}

          {session.phase === "saleExpiredAwaitingEnd" && (
            <StatusMessage variant="muted">
              The timer expired but settlement has not run yet. Anyone can trigger{" "}
              <code>endSale()</code>; the Arena view exposes a button.
            </StatusMessage>
          )}
        </PageSection>
      </div>

      {/* Hero context strip — title, the action-led lede, and the chain-time
          deadline. Sits BELOW the hub on purpose: the page leads with action
          and uses the hero to explain what just happened above (UX feedback
          from the original design where the hero pushed the buy button below
          the fold). The hero still owns the sale-phase badge so the visual
          status indicator is shared with Arena / Protocol. */}
      <PageHero
        title="TimeCurve sale"
        lede={HERO_LEDE}
        badgeLabel={phaseInfo.label}
        badgeTone={phaseInfo.tone}
        badgeIconSrc={phaseInfo.iconSrc}
        coinSrc="/art/token-logo.png"
      >
        {headerContent}
      </PageHero>

      {/* "Your stake at launch" — central UX answer to "what is my CHARM
          worth?". Displays only the CHARM count and the canonical launch-anchor
          projection (`participantLaunchValueCl8yWei`). The DOUB count is
          intentionally hidden because DOUB-per-CHARM dilutes as
          `totalCharmWeight` grows, while the CL8Y-equivalent at launch is the
          non-decreasing, stress-free projection of the same allocation. */}
      {stakePanelVisible && (
        <PageSection
          title="Your stake at launch"
          className="timecurve-simple__stake-panel"
          badgeLabel="1.2× launch anchor"
          badgeTone="info"
          lede={
            <>
              The DOUB/CL8Y locked liquidity seeds at <strong>1.2×</strong> the per-CHARM clearing
              price, so your CHARM is projected in CL8Y here — a number that{" "}
              <strong>only goes up</strong> as the sale heats up. Hidden on purpose: the DOUB count,
              which dilutes as more CHARM mints.
            </>
          }
        >
          <div className="timecurve-simple__stake-grid">
            <div className="timecurve-simple__stake-tile">
              <span className="timecurve-simple__stake-tile-label">You hold</span>
              <strong
                className="timecurve-simple__stake-tile-value"
                data-testid="timecurve-simple-stake-charm"
              >
                {session.charmWeightWad !== undefined
                  ? formatCompactFromRaw(session.charmWeightWad, 18, { sigfigs: 4 })
                  : "—"}
              </strong>
              <span className="timecurve-simple__stake-tile-unit">CHARM</span>
            </div>
            <div className="timecurve-simple__stake-tile timecurve-simple__stake-tile--launch">
              <span className="timecurve-simple__stake-tile-label">Worth at launch ≈</span>
              <strong
                className="timecurve-simple__stake-tile-value"
                data-testid="timecurve-simple-stake-cl8y-launch"
              >
                {session.launchCl8yValueWei !== undefined
                  ? formatCompactFromRaw(session.launchCl8yValueWei, session.decimals, {
                      sigfigs: 4,
                    })
                  : "—"}
              </strong>
              <span className="timecurve-simple__stake-tile-unit">CL8Y</span>
            </div>
          </div>
          <p className="muted timecurve-simple__stake-foot">
            {launchHelperCopy} · enforced by{" "}
            <code>DoubLPIncentives</code>; see the{" "}
            <Link to="/timecurve/protocol">Protocol view</Link> for raw onchain reads.
          </p>
        </PageSection>
      )}

      {/* Recent buys — moved out of the timer panel and given its own slim
          section so the spotlight row stays focused on the timer + buy CTA. */}
      <PageSection
        title="Recent buys"
        className="timecurve-simple__activity-panel"
        badgeLabel="Live ticker"
        badgeTone="info"
      >
        {recentBuys && recentBuys.length > 0 ? (
          <ul className="timecurve-simple__activity-list">
            {recentBuys.slice(0, 3).map((b) => (
              <li
                key={`${b.tx_hash}-${b.log_index}`}
                className={`timecurve-simple__ticker-row ${buyEventTone(b.actual_seconds_added, b.timer_hard_reset)}`}
              >
                <span className="mono" title={b.buyer}>
                  {shortAddress(b.buyer)}
                </span>
                <span>
                  <AmountDisplay raw={b.amount} decimals={session.decimals} />
                </span>
                <span>
                  {b.timer_hard_reset
                    ? "hard reset"
                    : b.actual_seconds_added !== undefined
                      ? `+${formatLocaleInteger(BigInt(b.actual_seconds_added))}s`
                      : ""}
                </span>
                <span>
                  tx <TxHash hash={b.tx_hash} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Waiting for the first buy of this round.</p>
        )}
      </PageSection>

    </div>
  );
}

export default TimeCurveSimplePage;
