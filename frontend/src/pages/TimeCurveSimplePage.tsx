// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AmountTripleStack } from "@/components/AmountTripleStack";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { TimecurveBuySpendRangeInput } from "@/components/TimecurveBuySpendRangeInput";
import { Cl8yTimeCurveUnlimitedApprovalFieldset } from "@/components/Cl8yTimeCurveUnlimitedApprovalFieldset";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { erc20Abi, timeCurveReadAbi } from "@/lib/abis";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { fetchTimecurveBuys, type BuyItem } from "@/lib/indexerApi";
import {
  formatBuyCtaCharmAmountLabel,
  formatBuyHubDerivedCompact,
  formatBuyHubLaunchVsClearingGainPercentLabel,
  formatHeroRateFromWad,
} from "@/lib/timeCurveBuyHubFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import {
  CHARM_TOKEN_LOGO,
  CL8Y_TOKEN_LOGO,
  ETH_TOKEN_LOGO,
  USDM_TOKEN_LOGO,
} from "@/lib/tokenMedia";
import {
  participantLaunchValueCl8yWei,
  podiumCategorySlices,
  podiumPlacementShares,
} from "@/lib/timeCurvePodiumMath";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { formatMmSsCountdown } from "@/pages/timecurve/formatTimer";
import { phaseNarrative } from "@/pages/timecurve/timeCurveSimplePhase";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { TimeCurveTimerHero } from "@/pages/timecurve/TimeCurveTimerHero";
import { TimeCurveStakeAtLaunchSection } from "@/pages/timecurve/TimeCurveStakeAtLaunchSection";
import { useTimeCurveSaleSession } from "@/pages/timecurve/useTimeCurveSaleSession";
import { useTimeCurveSimplePageSfx } from "@/pages/timecurve/useTimeCurveSimplePageSfx";
import { TimeCurveSimpleAgentCard } from "@/pages/timecurve/TimeCurveSimpleAgentCard";
import { TimeCurveBuyProjectedEffects } from "@/pages/timecurve/TimeCurveBuyProjectedEffects";
import { TimeCurveSimplePodiumSection } from "@/pages/timecurve/TimeCurveSimplePodiumSection";
import { buildTimeCurveBuyProjectedEffectLines } from "@/pages/timecurve/timeCurveBuyProjectedEffects";
import {
  usePodiumReads,
  useWarbowPodiumLiveInvalidation,
} from "@/pages/timecurve/usePodiumReads";
import { mergeBuysNewestFirst } from "@/pages/timeCurveArena/arenaPageHelpers";
import { warbowFlagPlantMutedLine } from "@/lib/warbowFlagPlantCopy";

/** Indexer page size for Simple head poll (podium ages, SFX, timer extension chip). */
const SIMPLE_RECENT_BUYS_PAGE_LIMIT = 15;

const SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS: { value: PayWithAsset; label: string; logo: string }[] = [
  { value: "cl8y", label: "CL8Y", logo: CL8Y_TOKEN_LOGO },
  { value: "eth", label: "ETH", logo: ETH_TOKEN_LOGO },
  { value: "usdm", label: "USDM", logo: USDM_TOKEN_LOGO },
];

function TimecurveSimpleRatePayTokenPicker({
  payWith,
  setPayWith,
}: {
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuSurfaceRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const active =
    SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS.find((o) => o.value === payWith) ?? SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS[0];

  const syncMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minWidth = Math.max(r.width, 148);
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    if (left + minWidth > vw - margin) left = Math.max(margin, vw - margin - minWidth);
    left = Math.max(margin, Math.min(left, vw - minWidth - margin));

    const estimatedH = 140;
    let top = r.bottom + 6;
    if (top + estimatedH > vh - margin && r.top > estimatedH + margin) {
      top = Math.max(margin, r.top - estimatedH - 6);
    }

    setMenuBox({ top, left, minWidth });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    syncMenuPosition();
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
    };
  }, [open, syncMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuSurfaceRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="timecurve-simple__rate-pay-picker">
      <button
        ref={triggerRef}
        type="button"
        className="timecurve-simple__rate-pay-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={
          open
            ? `${active.label} selected. Close pay token menu.`
            : `Pay with ${active.label}. Open menu to change pay token.`
        }
        data-testid="timecurve-simple-rate-pay-picker-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <img
          className="timecurve-simple__rate-pay-logo"
          src={active.logo}
          alt=""
          width={28}
          height={28}
          decoding="async"
          aria-hidden="true"
        />
        <span className="timecurve-simple__rate-pay-picker-chevron" aria-hidden="true">
          <svg width="9" height="9" viewBox="0 0 10 10" focusable="false">
            <path
              d="M2 3.5 5 6.5 8 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && menuBox && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuSurfaceRef}
              id={listboxId}
              className="timecurve-simple__rate-pay-picker-menu"
              role="listbox"
              aria-label="Pay token"
              style={{
                position: "fixed",
                top: menuBox.top,
                left: menuBox.left,
                minWidth: menuBox.minWidth,
              }}
            >
              {SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={payWith === o.value}
                  className={
                    payWith === o.value
                      ? "timecurve-simple__rate-pay-picker-option timecurve-simple__rate-pay-picker-option--active"
                      : "timecurve-simple__rate-pay-picker-option"
                  }
                  data-testid={`timecurve-simple-rate-pay-option-${o.value}`}
                  onClick={() => {
                    setPayWith(o.value);
                    setOpen(false);
                  }}
                >
                  <img src={o.logo} alt="" width={22} height={22} decoding="async" aria-hidden="true" />
                  <span className="timecurve-simple__rate-pay-picker-label">{o.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function TimecurveSimpleAmountPayTokenSelect({
  payWith,
  setPayWith,
  disabled,
}: {
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
  disabled: boolean;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const comboboxRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const active =
    SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS.find((o) => o.value === payWith) ?? SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS[0];

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const root = rootRef.current;
    if (!root) return;
    requestAnimationFrame(() => {
      const opt = root.querySelector<HTMLElement>(`[data-pay-token-value="${payWith}"]`);
      (opt ?? root.querySelector<HTMLElement>("[data-pay-token-value]"))?.focus();
    });
  }, [open, disabled, payWith]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        comboboxRef.current?.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="timecurve-simple__amount-suffix timecurve-simple__amount-token-dropdown">
      <button
        ref={comboboxRef}
        type="button"
        className="timecurve-simple__amount-token-combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={`Pay with ${active.label} (change spend token)`}
        data-testid="timecurve-simple-amount-pay-token"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <img
          className="timecurve-simple__amount-token-dropdown-icon"
          src={active.logo}
          alt=""
          width={16}
          height={16}
          decoding="async"
          aria-hidden="true"
        />
        <span className="timecurve-simple__amount-token-combobox-label">{active.label}</span>
        <span className="timecurve-simple__amount-token-combobox-chevron" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" focusable="false">
            <path
              d="M2 3.5 5 6.5 8 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && !disabled ? (
        <div id={listboxId} className="timecurve-simple__amount-token-list" role="listbox" aria-label="Spend token">
          {SIMPLE_AMOUNT_PAY_TOKEN_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === payWith}
              data-pay-token-value={o.value}
              className={
                o.value === payWith
                  ? "timecurve-simple__amount-token-option timecurve-simple__amount-token-option--active"
                  : "timecurve-simple__amount-token-option"
              }
              onClick={() => {
                setPayWith(o.value);
                setOpen(false);
                comboboxRef.current?.focus();
              }}
            >
              <img
                className="timecurve-simple__amount-token-dropdown-icon"
                src={o.logo}
                alt=""
                width={16}
                height={16}
                decoding="async"
                aria-hidden="true"
              />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Default `/timecurve` view — the **simple, first-run path** described in
 * issue #40. The page surfaces only what a new visitor needs: time remaining,
 * the single primary buy action, and what their CHARM is currently worth in
 * CL8Y at launch (the **launch-anchor invariant**: `1.275 × per-CHARM price`,
 * see [`launchplan-timecurve.md`](../../launchplan-timecurve.md) and
 * [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md)).
 *
 * The buy panel shows the full **rate chain** `1 CHARM = X DOUB = Y CL8Y at
 * launch` so participants can see where the CL8Y projection comes from, plus
 * the **current per-CHARM CL8Y price** big and featured (it ticks up every
 * block, so it's the most important number on the page). During the sale we
 * **do not** surface wallet-level projected DOUB — DOUB-per-CHARM dilutes as
 * `totalCharmWeight` grows. After `redeemCharms` ([issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90)),
 * the stake panel adds the **actual redeemed DOUB** (same ratio as the contract)
 * and strikes through the CL8Y-at-launch tile — we **do not** replace that CL8Y
 * line with DOUB alone because pay rails and anchoring stay in CL8Y terms.
 *
 * Contract: this page never owns game state. It uses
 * {@link useTimeCurveSaleSession}, which delegates writes to the same
 * `TimeCurve` ABI used by the Arena view, so the contract remains the single
 * source of truth (see `docs/frontend/timecurve-views.md`).
 */
export function TimeCurveSimplePage() {
  const tc = addresses.timeCurve;
  const session = useTimeCurveSaleSession(tc);
  const { mismatch: chainMismatch } = useWalletTargetChainMismatch();
  const prefersReducedMotion = useReducedMotion();
  const [buyFeedRefreshNonce, setBuyFeedRefreshNonce] = useState(0);
  const queryClient = useQueryClient();

  const timerSectionTitle =
    session.phase === "saleStartPending" ? "TimeCurve Opens In" : "Time left";

  const heroSecondsRemaining =
    session.phase === "saleActive" || session.phase === "saleExpiredAwaitingEnd"
      ? session.saleCountdownSec
      : session.preStartCountdownSec;

  const heroNarrative = phaseNarrative(session.phase);

  const warbowFlagPlantLine = useMemo(
    () =>
      warbowFlagPlantMutedLine({
        claimBp: session.warbowFlagClaimBp ?? 1000n,
        silenceSec: session.warbowFlagSilenceSec ?? 300n,
      }),
    [session.warbowFlagClaimBp, session.warbowFlagSilenceSec],
  );

  const buyProjectedEffects = useMemo(
    () =>
      buildTimeCurveBuyProjectedEffectLines({
        charmWadSelected: session.charmWadSelected,
        charmWeightTotalWad: session.buyCheckoutCharmWeightWad,
        estimatedSpendWei: session.estimatedSpendWei,
        decimals: session.decimals,
        secondsRemaining: session.saleCountdownSec,
        timerExtensionPreview: session.timerExtensionPreviewSec,
        activeDefendedStreak: session.activeDefendedStreak,
        plantWarBowFlag: session.plantWarBowFlag,
        flagOwnerAddr: session.warbowPendingFlagOwner,
        flagPlantAtSec: session.warbowPendingFlagPlantAt,
        walletAddress: session.walletAddress,
        formatRivalWallet: (addr) => shortAddress(addr),
      }),
    [
      session.activeDefendedStreak,
      session.buyCheckoutCharmWeightWad,
      session.charmWadSelected,
      session.decimals,
      session.estimatedSpendWei,
      session.plantWarBowFlag,
      session.saleCountdownSec,
      session.timerExtensionPreviewSec,
      session.walletAddress,
      session.warbowPendingFlagOwner,
      session.warbowPendingFlagPlantAt,
    ],
  );

  const podiumReads = usePodiumReads(tc);
  const { data: podiumAcceptedAsset } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "acceptedAsset",
    query: { enabled: Boolean(tc) },
  });
  const { data: podiumPoolAddress } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "podiumPool",
    query: { enabled: Boolean(tc) },
  });
  const { data: podiumPoolBalance } = useReadContract({
    address: podiumAcceptedAsset as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: podiumPoolAddress ? [podiumPoolAddress as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(podiumAcceptedAsset && podiumPoolAddress),
      refetchInterval: 1000,
    },
  });
  const podiumPayoutPreview = useMemo(() => {
    if (typeof podiumPoolBalance !== "bigint") {
      return undefined;
    }
    return podiumCategorySlices(podiumPoolBalance).map((slice) => {
      const [first, second, third] = podiumPlacementShares(slice);
      return { places: [first.toString(), second.toString(), third.toString()] as const };
    });
  }, [podiumPoolBalance]);

  const [recentBuys, setRecentBuys] = useState<BuyItem[] | null>(null);
  /** Wall clock for podium “time since buy” copy; decoupled from chain time. */
  const [tickerWallNowSec, setTickerWallNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useWarbowPodiumLiveInvalidation(tc, queryClient, setBuyFeedRefreshNonce);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerWallNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useTimeCurveSimplePageSfx({
    recentBuys,
    walletAddress: session.walletAddress,
    saleCountdownSec: session.saleCountdownSec,
    phase: session.phase,
    reduceMotion: Boolean(prefersReducedMotion),
  });

  useEffect(() => {
    if (!indexerBaseUrl()) {
      setRecentBuys(null);
      return;
    }
    let cancelled = false;
    let timeoutId = 0;

    const tick = async () => {
      try {
        const buys = await fetchTimecurveBuys(SIMPLE_RECENT_BUYS_PAGE_LIMIT, 0);
        if (cancelled) return;
        const ok = buys != null;
        reportIndexerFetchAttempt(ok);
        if (ok) {
          setRecentBuys((prev) => mergeBuysNewestFirst(buys.items, prev));
        }
      } catch {
        if (!cancelled) {
          reportIndexerFetchAttempt(false);
        }
      }
    };

    const loop = async () => {
      await tick();
      if (cancelled) return;
      timeoutId = window.setTimeout(loop, getIndexerBackoffPollMs(5000));
    };

    void loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [buyFeedRefreshNonce]);

  // Launch-anchor invariant (DoubLPIncentives policy): 1 CHARM is projected
  // to be worth `1.275 × pricePerCharmWad` CL8Y at launch. We surface the
  // buy-delta ("This buy adds ≈ Y CL8Y of launch value") and the stake-panel
  // helper caption; math lives in `timeCurvePodiumMath` (see tests there).
  const buyPreviewCharmWeightWad = session.buyCheckoutCharmWeightWad;
  const buyAddsCl8yAtLaunch = useMemo(
    () =>
      participantLaunchValueCl8yWei({
        charmWeightWad: buyPreviewCharmWeightWad,
        pricePerCharmWad: session.pricePerCharmWad,
      }),
    [buyPreviewCharmWeightWad, session.pricePerCharmWad],
  );

  const buyPreviewLaunchGainLabel = useMemo(
    () =>
      formatBuyHubLaunchVsClearingGainPercentLabel({
        clearingSpendCl8yWei: session.estimatedSpendWei,
        approxLaunchCl8yWei: buyAddsCl8yAtLaunch,
      }),
    [session.estimatedSpendWei, buyAddsCl8yAtLaunch],
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
        const pulseKey = `${b.tx_hash}:${b.log_index}:${b.block_number}`;
        return { buyer: b.buyer, reset, secs, pulseKey };
      }
    }
    return null;
  }, [recentBuys]);

  const paySpendSuffix =
    session.payWith === "cl8y" ? "CL8Y" : session.payWith === "eth" ? "ETH" : "USDM";

  const slider = session.cl8ySpendBounds ? (
    <div
      className={`timecurve-simple__slider-row timecurve-simple__slider-row--pay-${session.payWith}`}
    >
      <TimecurveBuySpendRangeInput
        min={0}
        max={10000}
        step={1}
        value={session.spendSliderPermille}
        onChange={(e) => session.setSpendFromSliderPermille(Number(e.target.value))}
        aria-label={`${paySpendSuffix} spend slider (targets CL8Y sale band)`}
        disabled={session.phase !== "saleActive" || !session.walletConnected}
      />
      <div className="timecurve-simple__amount-input">
        {session.payWith === "cl8y" ? (
          <>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Exact CL8Y spend"
              className="form-input timecurve-simple__amount-field"
              value={session.spendInputStr}
              onChange={(e) => session.setSpendFromInput(e.target.value)}
              onBlur={() => session.setSpendFromInputBlur()}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                e.preventDefault();
                e.currentTarget.blur();
              }}
              disabled={session.phase !== "saleActive" || !session.walletConnected}
            />
            <TimecurveSimpleAmountPayTokenSelect
              payWith={session.payWith}
              setPayWith={session.setPayWith}
              disabled={session.phase !== "saleActive" || !session.walletConnected}
            />
          </>
        ) : (
          <>
            <span
              className="form-input timecurve-simple__amount-field timecurve-simple__amount-field--quoted"
              aria-label={`Quoted ${paySpendSuffix} spend for the selected CL8Y target`}
            >
              {session.swapQuoteLoading || session.quotedPayInWei === undefined ? (
                "…"
              ) : (
                <AmountDisplay
                  raw={String(session.quotedPayInWei)}
                  decimals={session.payTokenDecimals}
                />
              )}
            </span>
            <TimecurveSimpleAmountPayTokenSelect
              payWith={session.payWith}
              setPayWith={session.setPayWith}
              disabled={session.phase !== "saleActive" || !session.walletConnected}
            />
          </>
        )}
      </div>
    </div>
  ) : null;

  const minMaxPill = session.cl8ySpendBounds ? (
    <span className="timecurve-simple__minmax timecurve-simple__minmax--rate-card">
      {session.payWith === "cl8y" ? (
        <>
          Buy Limits:&nbsp;
          <span className="timecurve-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.minS, session.decimals)}</strong>
            <span className="timecurve-simple__minmax-suffix">min</span>
          </span>
          <span className="timecurve-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.maxS, session.decimals)}</strong>
            <span className="timecurve-simple__minmax-suffix">max</span>
          </span>
        </>
      ) : session.bandBoundaryQuotesLoading ||
        session.quotedBandMinPayInWei === undefined ||
        session.quotedBandMaxPayInWei === undefined ? (
        <>
          Buy Limits:&nbsp;
          <span className="timecurve-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.minS, session.decimals)}</strong>
            <span className="timecurve-simple__minmax-suffix">min</span>
          </span>
          <span className="timecurve-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.maxS, session.decimals)}</strong>
            <span className="timecurve-simple__minmax-suffix">max</span>
          </span>
        </>
      ) : (
        <>
          Buy Limits:&nbsp;≈&nbsp;
          <span className="timecurve-simple__minmax-pair">
            <strong>
              {formatBuyHubDerivedCompact(session.quotedBandMinPayInWei, session.payTokenDecimals)}
            </strong>
            <span className="timecurve-simple__minmax-suffix">min</span>
          </span>
          <span className="timecurve-simple__minmax-pair">
            <strong>
              {formatBuyHubDerivedCompact(session.quotedBandMaxPayInWei, session.payTokenDecimals)}
            </strong>
            <span className="timecurve-simple__minmax-suffix">max</span>
          </span>
          <span className="muted">
            {" "}
            (CL8Y&nbsp;
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.minS, session.decimals)}</strong>
            &nbsp;–&nbsp;
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.maxS, session.decimals)}</strong>)
          </span>
        </>
      )}
    </span>
  ) : (
    <span className="timecurve-simple__minmax timecurve-simple__minmax--rate-card">Loading buy limits…</span>
  );

  const buyPreview =
    session.charmWadSelected === undefined ? (
      <div className="timecurve-simple__buy-preview timecurve-simple__buy-preview--loading">
        Loading CHARM preview…
      </div>
    ) : buyAddsCl8yAtLaunch !== undefined && buyAddsCl8yAtLaunch > 0n ? (
      <div className="timecurve-simple__buy-preview" data-testid="timecurve-simple-buy-preview">
        <div
          className="timecurve-simple__buy-preview-approx"
          aria-label="Approximate CL8Y at launch"
        >
          <div className="timecurve-simple__buy-preview-approx-main">
            <span className="timecurve-simple__buy-preview-approx-symbol" aria-hidden>
              ≈
            </span>
            <span className="timecurve-simple__buy-preview-approx-value">
              {"Worth: "}
              {formatBuyHubDerivedCompact(buyAddsCl8yAtLaunch, session.decimals)}
            </span>
            <span className="timecurve-simple__buy-preview-approx-unit">CL8Y</span>
            {buyPreviewLaunchGainLabel ? (
              <span
                className="timecurve-simple__buy-preview-gain"
                aria-label="Estimated percent gain: CL8Y at launch versus implied CL8Y spend for this CHARM size"
              >
                ({buyPreviewLaunchGainLabel})
              </span>
            ) : null}
          </div>
          {session.buyCharmBonusPreviewLines.length > 0 ? (
            <div
              className="timecurve-simple__buy-preview-bonuses"
              data-testid="timecurve-simple-buy-preview-bonuses"
            >
              {session.buyCharmBonusPreviewLines.map((line, i) => (
                <div key={`${i}:${line}`} className="timecurve-simple__buy-preview-bonus-line">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  const nonCl8yBlocked =
    session.payWith !== "cl8y" &&
    (session.kumbayaRoutingBlocker !== null ||
      session.swapQuoteFailed ||
      session.quotedPayInWei === undefined ||
      session.swapQuoteLoading);

  const buyOnCooldown = session.walletCooldownRemainingSec > 0;

  const buyDisabled =
    session.phase !== "saleActive" ||
    session.isWriting ||
    !session.walletConnected ||
    chainMismatch ||
    buyOnCooldown ||
    session.charmWadSelected === undefined ||
    nonCl8yBlocked ||
    session.buyFeeRoutingEnabled === false;

  const buyButtonMotion =
    prefersReducedMotion || buyOnCooldown ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.985 } };

  const stakePanelVisible =
    session.walletConnected &&
    session.charmWeightWad !== undefined &&
    (session.phase === "saleActive" ||
      session.phase === "saleEnded" ||
      session.phase === "saleExpiredAwaitingEnd");

  // Rate board (top of buy panel) — the **single most-important number on
  // the page** is the live current per-CHARM price in the selected pay asset
  // (it ticks up every block; waiting costs money). Live reads refresh on
  // every block via the hook's wagmi reads. Display uses `formatHeroRateFromWad`
  // (six significant figures, truncated toward zero, trailing zeros kept).
  const rateNowDisplay = useMemo(() => {
    if (session.pricePerCharmWad === undefined) {
      return { text: "—" as const, unit: " CL8Y" as const, loading: false as const };
    }
    if (session.payWith === "cl8y") {
      return {
        text: formatHeroRateFromWad(session.pricePerCharmWad),
        unit: " CL8Y" as const,
        loading: false as const,
      };
    }
    if (session.perCharmPayQuoteLoading) {
      if (session.payWith === "eth") {
        return { text: "…" as const, unit: " ETH" as const, loading: true as const };
      }
      return { text: "…" as const, unit: " USDM" as const, loading: true as const };
    }
    const quoted = session.quotedPerCharmPayInWei;
    const raw =
      quoted !== undefined
        ? quoted
        : fallbackPayTokenWeiForCl8y(session.pricePerCharmWad, session.payWith);
    if (session.payWith === "eth") {
      return {
        text: formatHeroRateFromWad(raw),
        unit: " ETH" as const,
        loading: false as const,
      };
    }
    return {
      text: formatHeroRateFromWad(raw),
      unit: " USDM" as const,
      loading: false as const,
    };
  }, [
    session.pricePerCharmWad,
    session.payWith,
    session.perCharmPayQuoteLoading,
    session.quotedPerCharmPayInWei,
  ]);

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
        session.payWith === key
          ? "timecurve-simple__rate-paywith-btn timecurve-simple__rate-paywith-btn--active"
          : "timecurve-simple__rate-paywith-btn"
      }
      aria-pressed={session.payWith === key}
      aria-label={`Show price in ${label}`}
      onClick={() => session.setPayWith(key as PayWithAsset)}
    >
      <img src={logo} alt="" width={16} height={16} decoding="async" aria-hidden="true" />
      {label}
    </button>
  ));

  const rateBoard = (
    <div
      className="timecurve-simple__rate-board timecurve-simple__rate-row timecurve-simple__rate-row--now"
      data-testid="timecurve-simple-rate-board"
      aria-live="polite"
    >
      <span className="timecurve-simple__rate-now-line">
        {/* CHARM coin glyph makes "what you're buying" readable before the
            user parses the label. Decorative; the label is the source of
            truth for assistive tech. */}
        <img
          className="timecurve-simple__rate-glyph"
          src={CHARM_TOKEN_LOGO}
          alt=""
          aria-hidden="true"
          decoding="async"
          width={24}
          height={24}
        />
        <span className="timecurve-simple__rate-label">1 CHARM =</span>
        {session.payWith !== "cl8y" && session.rateBoardKumbayaWarning && (
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
              <path d="M10 7v4.2" stroke="#5c4a00" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="10" cy="14.2" r="0.9" fill="#5c4a00" />
            </svg>
          </span>
        )}
        <strong
          key={`${priceTickKey}-${session.payWith}-${rateNowDisplay.text}`}
          className="timecurve-simple__rate-value timecurve-simple__rate-value--hero timecurve-simple__rate-value--tick"
          data-testid="timecurve-simple-rate-now"
          aria-busy={rateNowDisplay.loading}
        >
          {rateNowDisplay.text}
        </strong>
        <TimecurveSimpleRatePayTokenPicker payWith={session.payWith} setPayWith={session.setPayWith} />
        <span className="visually-hidden">{rateNowDisplay.unit.trim()}</span>
      </span>
    </div>
  );

  const timerHeroFoot =
    session.phase === "saleEnded"
      ? session.charmRedemptionEnabled === false
        ? "Redemptions await onchain go-live (operator / governance signoff)."
        : "Holders of CHARM can claim their DOUB share."
      : session.phase === "saleStartPending"
        ? "Stay on this page — it switches to Live automatically."
        : session.phase === "saleExpiredAwaitingEnd"
          ? "Anyone can call endSale() now — see the Arena view."
          : undefined;

  return (
    <div className="page timecurve-simple-page">
      <TimeCurveSubnav active="simple" />

      {/* Sale hub — timer + primary buy action share the spotlight row above the fold. */}
      <div className="timecurve-simple__hub">
        <PageSection
          title={timerSectionTitle}
          spotlight
          className="timecurve-simple__timer-panel"
          lede={heroNarrative}
        >
          <TimeCurveTimerHero
            secondsRemaining={heroSecondsRemaining}
            countdownKind={session.phase === "saleStartPending" ? "open" : "round"}
            foot={timerHeroFoot}
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
              key={lastExtension.pulseKey}
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
                  <AddressInline
                    address={lastExtension.buyer}
                    tailHexDigits={6}
                    size={14}
                    className="timecurve-simple__last-extension-addr"
                  />
                </>
              ) : (
                <>
                  Just +{lastExtension.secs}s by{" "}
                  <AddressInline
                    address={lastExtension.buyer}
                    tailHexDigits={6}
                    size={14}
                    className="timecurve-simple__last-extension-addr"
                  />
                </>
              )}
            </span>
          )}
        </PageSection>

        <PageSection
          title={
            session.phase === "saleEnded"
              ? "Redeem CHARM"
              : session.phase === "saleActive"
                ? undefined
                : "Buy CHARM"
          }
          spotlight
          className="timecurve-simple__buy-panel"
          lede={
            session.phase === "saleEnded"
              ? session.charmRedemptionEnabled === false
                ? "The sale is over. DOUB allocation redemptions are gated onchain until the owner enables them (issue #55)."
                : "The sale is over. Redeem CHARM to mint your DOUB share onchain."
              : session.phase === "saleActive"
                ? undefined
                : "The sale will open here when the timer hits zero."
          }
        >
          <ChainMismatchWriteBarrier testId="timecurve-simple-chain-write-gate">
          {/* Live rate board: current price (big, ticks every block) +
              at-launch chain (1 CHARM = N DOUB = M CL8Y at 1.275× anchor). */}
          {session.phase === "saleActive" && rateBoard}

          {!session.walletConnected && session.phase !== "loading" && (
            <div className="timecurve-simple__connect">
              <p className="timecurve-simple__connect-pitch">
                Connect your Wallet to earn CHARM, reserve your DOUB, and win prizes!
              </p>
              <WalletConnectButton />
            </div>
          )}

          {session.phase === "saleActive" && session.walletConnected && (
            <>
              {session.payWith !== "cl8y" && session.kumbayaRoutingBlocker && (
                <StatusMessage variant="error">{session.kumbayaRoutingBlocker}</StatusMessage>
              )}
              {session.payWith !== "cl8y" &&
                !session.kumbayaRoutingBlocker &&
                session.swapQuoteFailed && (
                  <StatusMessage variant="error">
                    Could not quote this route (no liquidity or misconfigured pools for this chain).
                  </StatusMessage>
                )}
              {session.payWith !== "cl8y" && !session.kumbayaRoutingBlocker && !session.swapQuoteFailed && (
                <p className="muted">
                  Kumbaya route uses a fixed <strong>3%</strong> max slippage cap on routed input.
                </p>
              )}
              {slider}
              <p className="muted timecurve-simple__pay-balance">
                {session.payWalletBalance.raw !== undefined ? (
                  <AmountDisplay
                    raw={String(session.payWalletBalance.raw)}
                    decimals={session.payWalletBalance.decimals}
                    leadingLabel={`YOUR ${session.payWalletBalance.symbol.toUpperCase()}:`}
                    valueMono={false}
                  />
                ) : (
                  <AmountTripleStack
                    rows={[
                      {
                        label: `YOUR ${session.payWalletBalance.symbol.toUpperCase()}:`,
                        value: "—",
                        monoValue: false,
                      },
                    ]}
                  />
                )}
              </p>
              {session.buyFeeRoutingEnabled === false && (
                <StatusMessage variant="muted">
                  Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable.
                </StatusMessage>
              )}
              <motion.button
                type="button"
                className={[
                  "btn-primary btn-primary--priority timecurve-simple__cta timecurve-simple__cta--arcade",
                  buyOnCooldown ? "timecurve-simple__cta--cooldown" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={buyDisabled}
                title={buyOnCooldown ? "Wallet buy cooldown (matches onchain pacing)" : undefined}
                onClick={() => void session.submitBuy()}
                {...buyButtonMotion}
              >
                {/* Inline CHARM coin glyph turns the CTA into a clear "do
                    the thing with the coin" arcade lever — newbies don't
                    need to read the label to know which button mints
                    CHARM. Decorative; label remains the source of truth. */}
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
                  {session.isWriting
                    ? "Submitting…"
                    : session.payWith !== "cl8y" && session.swapQuoteLoading
                      ? "Refreshing quote…"
                      : buyOnCooldown
                        ? `${formatMmSsCountdown(session.walletCooldownRemainingSec)} cooldown`
                        : session.buyCheckoutCharmWeightWad !== undefined
                          ? `Buy ${formatBuyCtaCharmAmountLabel(session.buyCheckoutCharmWeightWad)} CHARM`
                          : "Buy CHARM"}
                </span>
              </motion.button>
              {buyPreview}
              <details
                className="timecurve-simple__buy-advanced accordion-panel"
                data-testid="timecurve-simple-buy-advanced"
              >
                <summary>ADVANCED</summary>
                <div className="accordion-panel__content">
                  <div
                    className="timecurve-simple__rate-paywith timecurve-simple__rate-paywith--buy-heading timecurve-simple__rate-paywith--segmented"
                    role="group"
                    aria-label="Show live price in"
                  >
                    {rateBoardPayOptions}
                  </div>
                  {minMaxPill}
                  <div className="timecurve-simple__referral muted">
                    <label>
                      <input
                        type="checkbox"
                        checked={session.plantWarBowFlag}
                        onChange={(e) => session.setPlantWarBowFlag(e.target.checked)}
                      />{" "}
                      Plant WarBow flag (opt-in)
                    </label>
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      {warbowFlagPlantLine}
                    </p>
                    {session.plantWarBowFlag ? (
                      <p className="muted" style={{ marginTop: "0.5rem" }}>
                        This buy can put you in the global pending-flag slot. Another buyer after the silence window
                        may trigger Battle Point penalties if you do not claim in time. Leave unchecked for a plain
                        CHARM purchase.
                      </p>
                    ) : null}
                  </div>
                  <Cl8yTimeCurveUnlimitedApprovalFieldset
                    disabled={session.phase !== "saleActive" || !session.walletConnected}
                  />
                </div>
              </details>
              <TimeCurveBuyProjectedEffects
                className="timecurve-simple__buy-projected-effects"
                items={buyProjectedEffects}
              />
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
                  chainMismatch ||
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
          </ChainMismatchWriteBarrier>
        </PageSection>
      </div>

      <TimeCurveStakeAtLaunchSection
        visible={stakePanelVisible}
        charmWeightWad={session.charmWeightWad}
        launchCl8yValueWei={session.launchCl8yValueWei}
        payWith={session.payWith}
        payTokenDecimals={session.payTokenDecimals}
        stakeLaunchEquivPayWei={session.stakeLaunchEquivPayWei}
        stakeLaunchEquivQuoteLoading={session.stakeLaunchEquivQuoteLoading}
        decimals={session.decimals}
        charmsRedeemed={session.charmsRedeemed}
        expectedTokenFromCharms={session.expectedTokenFromCharms}
      />

      <TimeCurveSimplePodiumSection
        podiumRows={podiumReads.data}
        podiumLoading={podiumReads.isLoading}
        podiumPayoutPreview={podiumPayoutPreview}
        decimals={session.decimals}
        address={session.walletAddress}
        recentBuys={recentBuys}
        podiumNowUnixSec={tickerWallNowSec}
      />

      <TimeCurveSimpleAgentCard />
    </div>
  );
}

export default TimeCurveSimplePage;
