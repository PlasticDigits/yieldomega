// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { useBalance } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { TxHash } from "@/components/TxHash";
import { PageBadge } from "@/components/ui/PageBadge";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses } from "@/lib/addresses";
import { fetchTimecurveBuys, fetchTimecurveWarbowLeaderboard, type BuyItem } from "@/lib/indexerApi";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { shortAddress } from "@/lib/addressFormat";
import { formatCountdown, timerUrgencyClass } from "@/pages/timecurve/formatTimer";
import { phaseBadge, phaseNarrative } from "@/pages/timecurve/timeCurveSimplePhase";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { useTimeCurveSaleSession } from "@/pages/timecurve/useTimeCurveSaleSession";

/**
 * Default `/timecurve` view — the **simple, first-run path** described in
 * issue #40. It surfaces only what a new visitor needs to make sense of the
 * launch: time remaining, the single primary buy action, and a hint of who
 * is moving right now. Advanced PvP, podiums, and raw onchain reads live
 * behind the sub-nav (Arena, Protocol).
 *
 * Contract: this page never owns game state. It uses
 * {@link useTimeCurveSaleSession}, which delegates writes to the same
 * `TimeCurve` ABI used by the Arena view, so the contract remains the single
 * source of truth (see `docs/frontend/timecurve-views.md`).
 */
const HERO_LEDE = "Spend CL8Y to get CHARM. CHARM redeems for DOUB after the timer dies.";

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

export function TimeCurveSimplePage() {
  const tc = addresses.timeCurve;
  const session = useTimeCurveSaleSession(tc);
  const prefersReducedMotion = useReducedMotion();

  const phaseInfo = phaseBadge(session.phase);

  const heroSecondsRemaining =
    session.phase === "saleActive" || session.phase === "saleExpiredAwaitingEnd"
      ? session.saleCountdownSec
      : session.preStartCountdownSec;
  const heroUrgency = timerUrgencyClass(heroSecondsRemaining);
  const heroLabel =
    session.phase === "saleStartPending"
      ? "Until sale opens"
      : session.phase === "saleEnded"
        ? "Sale closed"
        : session.phase === "saleExpiredAwaitingEnd"
          ? "Timer expired"
          : "Time remaining on the sale timer";

  const heroNarrative = phaseNarrative(session.phase);

  const [recentBuys, setRecentBuys] = useState<BuyItem[] | null>(null);
  const [warbowLeaderBp, setWarbowLeaderBp] = useState<string | null>(null);
  const [warbowLeaderAddr, setWarbowLeaderAddr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const buys = await fetchTimecurveBuys(3, 0);
        if (!cancelled && buys) setRecentBuys(buys.items);
      } catch {
        /* ignore */
      }
      try {
        const leader = await fetchTimecurveWarbowLeaderboard(1, 0);
        if (!cancelled && leader && leader.items[0]) {
          setWarbowLeaderBp(leader.items[0].battle_points_after);
          setWarbowLeaderAddr(leader.items[0].buyer);
        }
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

  const charmPreview =
    session.charmWadSelected !== undefined ? (
      <div className="timecurve-simple__preview">
        <span className="timecurve-simple__preview-label">You will get ≈</span>
        <strong className="timecurve-simple__preview-value">
          {formatCompactFromRaw(session.charmWadSelected, 18, { sigfigs: 4 })}
        </strong>
        <span className="timecurve-simple__preview-unit">CHARM</span>
      </div>
    ) : (
      <div className="timecurve-simple__preview timecurve-simple__preview--loading">
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

  return (
    <div className="page timecurve-simple-page">
      <TimeCurveSubnav active="simple" />

      <PageHero
        title="TimeCurve sale"
        lede={HERO_LEDE}
        badgeLabel={phaseInfo.label}
        badgeTone={phaseInfo.tone}
        coinSrc="/art/token-logo.png"
      >
        {headerContent}
      </PageHero>

      <PageSection
        title="Time left"
        spotlight
        className="timecurve-simple__timer-panel"
        badgeLabel={heroLabel}
        badgeTone={phaseInfo.tone}
        lede={heroNarrative}
      >
        <div className={`timer-hero ${heroUrgency}`} aria-live="polite">
          <div
            className="timer-hero__value timecurve-simple__timer-value"
            data-testid="timecurve-simple-timer"
          >
            {heroSecondsRemaining !== undefined ? formatCountdown(heroSecondsRemaining) : "—"}
          </div>
          <div className="timecurve-simple__timer-foot muted">
            {session.phase === "saleActive" &&
              "Each buy adds time to the timer; very large clutch buys can hard-reset it."}
            {session.phase === "saleEnded" &&
              (session.charmRedemptionEnabled === false
                ? "Redemptions await onchain go-live (operator / governance signoff)."
                : "Holders of CHARM can claim their DOUB share.")}
            {session.phase === "saleStartPending" && "Stay on this page — it will switch to Live automatically."}
          </div>
        </div>
        <div className="timecurve-simple__activity" aria-label="Recent buys">
          <div className="timecurve-simple__activity-title muted">Recent buys</div>
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
        </div>
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
        badgeTone={session.phase === "saleActive" ? "live" : "info"}
        lede={
          session.phase === "saleEnded"
            ? session.charmRedemptionEnabled === false
              ? "The sale is over. DOUB allocation redemptions are gated onchain until the owner enables them (see issue #55)."
              : "The sale is over. Hit Redeem CHARM to mint your DOUB share onchain."
            : "Pick how you pay (CL8Y, ETH, or USDM). The sale always settles in CL8Y; ETH and USDM route through Kumbaya v3–compatible pools first."
        }
      >
        {!session.walletConnected && session.phase !== "loading" && (
          <div className="timecurve-simple__connect">
            <p>Connect a wallet to start buying CHARM.</p>
            <ConnectButton showBalance={false} />
          </div>
        )}

        {session.phase === "saleActive" && session.walletConnected && (
          <>
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
            <p className="muted timecurve-simple__kumbaya-note">
              ETH and USDM use a third-party DEX route (Kumbaya). Quotes come from the onchain
              quoter; your wallet signs wrap/approve/swap then the usual TimeCurve buy.
            </p>
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
                  <AmountDisplay raw={String(session.walletBalanceWei)} decimals={session.decimals} />
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="timecurve-simple__minmax-row">{minMaxPill}</div>
            {slider}
            {charmPreview}
            {session.buyFeeRoutingEnabled === false && (
              <StatusMessage variant="muted">
                Buys that route CL8Y through the fee sinks are paused onchain until operators re-enable them.
              </StatusMessage>
            )}
            <motion.button
              type="button"
              className="btn-primary timecurve-simple__cta"
              disabled={buyDisabled}
              onClick={() => void session.submitBuy()}
              {...buyButtonMotion}
            >
              {session.isWriting ? "Submitting…" : "Buy CHARM"}
            </motion.button>
            <p className="muted timecurve-simple__cta-hint">
              {session.payWith === "cl8y"
                ? "Approves CL8Y if needed, then submits the buy. The contract clamps your size into the live min–max CHARM band."
                : "Submits a fixed CL8Y-out swap on the router (wrap + approve for ETH), then approves CL8Y for TimeCurve and buys. Several transactions in one flow."}
            </p>
            {cooldownLine && <StatusMessage variant="muted">{cooldownLine}</StatusMessage>}
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
          </>
        )}

        {session.phase === "saleEnded" && session.walletConnected && (
          <>
            <div className="timecurve-simple__balance-row">
              <PageBadge label="Your CHARM weight" tone="info" />
              <span>
                {session.charmWeightWad !== undefined ? (
                  <AmountDisplay raw={String(session.charmWeightWad)} decimals={18} />
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="timecurve-simple__balance-row">
              <PageBadge label="Projected DOUB" tone="info" />
              <span>
                {session.expectedTokenFromCharms !== undefined ? (
                  <AmountDisplay
                    raw={String(session.expectedTokenFromCharms)}
                    decimals={session.launchedDec}
                  />
                ) : (
                  "—"
                )}
              </span>
            </div>
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

      <PageSection
        title="Want more?"
        className="timecurve-simple__explore"
        lede="The simple view stays light. Hop to Arena for PvP and podiums, or to Protocol for raw onchain reads."
      >
        <div className="timecurve-explore-grid">
          <Link to="/timecurve/arena" className="timecurve-explore-card">
            <PageBadge label="Arena" tone="warning" />
            <h3>WarBow PvP &amp; podiums</h3>
            <p className="muted">
              Steal Battle Points, plant the silence flag, defend a streak, and chase the four
              reserve podiums.
            </p>
            <div className="timecurve-explore-card__stat">
              {warbowLeaderBp !== null ? (
                <>
                  <strong>BP leader · {formatLocaleInteger(BigInt(warbowLeaderBp))}</strong>
                  {warbowLeaderAddr && (
                    <span className="mono"> · {shortAddress(warbowLeaderAddr)}</span>
                  )}
                </>
              ) : (
                <span className="muted">Live BP leader will appear here once a buy lands.</span>
              )}
            </div>
            <span className="timecurve-explore-card__cta">Open Arena →</span>
          </Link>
          <Link to="/timecurve/protocol" className="timecurve-explore-card">
            <PageBadge label="Protocol" tone="info" />
            <h3>Raw onchain reads</h3>
            <p className="muted">
              Inspect immutable parameters, fee routing, and the underlying contract reads driving
              this page.
            </p>
            <div className="timecurve-explore-card__stat">
              {session.deadlineSec !== undefined ? (
                <>
                  <strong>Deadline</strong>{" "}
                  <span className="mono">unix {session.deadlineSec}</span>
                </>
              ) : (
                <span className="muted">Loading deadline…</span>
              )}
            </div>
            <span className="timecurve-explore-card__cta">Open Protocol →</span>
          </Link>
        </div>
      </PageSection>
    </div>
  );
}

export default TimeCurveSimplePage;
