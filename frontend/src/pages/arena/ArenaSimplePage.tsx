// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AmountTripleStack } from "@/components/AmountTripleStack";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { ArenaBuySpendRangeInput } from "@/components/ArenaBuySpendRangeInput";
import { ArenaDoubUnlimitedApprovalFieldset } from "@/components/ArenaDoubUnlimitedApprovalFieldset";
import { Cl8yAcquireExternalLinks } from "@/components/Cl8yAcquireExternalLinks";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { erc20Abi } from "@/lib/abis";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { fetchTimecurveBuys, type BuyItem } from "@/lib/indexerApi";
import {
  formatBuyCtaCharmAmountLabel,
  formatBuyHubDerivedCompact,
  formatBuyHubLaunchVsClearingGainPercentLabel,
  formatHeroRateFromWad,
} from "@/lib/timeArenaBuyHubFormat";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import { payTokenOptionsForSimpleBuy } from "@/lib/arenaPayTokenOptions";
import type { PayTokenOption } from "@/lib/arenaPayTokenOptions";
import { CHARM_TOKEN_LOGO } from "@/lib/tokenMedia";
import { formatUnits } from "viem";
import { ARENA_CRED_WAD } from "@/lib/arenaCredBurn";
import {
  participantLaunchValueCl8yWei,
  podiumCategorySlices,
  podiumPlacementShares,
} from "@/lib/timeArenaPodiumMath";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { formatMmSsCountdown } from "@/pages/arena/formatTimer";
import { phaseNarrative } from "@/pages/arena/arenaSimplePhase";
import { ArenaSubnav } from "@/pages/arena/ArenaSubnav";
import { ArenaTimerHero } from "@/pages/arena/ArenaTimerHero";
import { useArenaSaleSession } from "@/pages/arena/useArenaSaleSession";
import { WarbowClaimFlagButton } from "@/components/WarbowClaimFlagButton";
import { useArenaSimplePageSfx } from "@/pages/arena/useArenaSimplePageSfx";
import { FooterSiteLinksCard } from "@/components/FooterSiteLinksCard";
import { ArenaSimpleAgentCard } from "@/pages/arena/ArenaSimpleAgentCard";
import { ArenaBuyProjectedEffects } from "@/pages/arena/ArenaBuyProjectedEffects";
import { ArenaSimplePodiumSection } from "@/pages/arena/ArenaSimplePodiumSection";
import { buildArenaBuyProjectedEffectLines } from "@/pages/arena/arenaBuyProjectedEffects";
import {
  usePodiumReads,
  useWarbowPodiumLiveInvalidation,
} from "@/pages/arena/usePodiumReads";
import { mergeBuysNewestFirst } from "@/lib/arenaPageHelpers";
import { getRpcBackoffPollMs } from "@/lib/rpcConnectivity";
import { warbowFlagPlantMutedLine } from "@/lib/warbowFlagPlantCopy";

/** Indexer page size for Simple head poll (podium ages, SFX, timer extension chip). */
const SIMPLE_RECENT_BUYS_PAGE_LIMIT = 15;

/**
 * Last good RPC/indexer inputs for projected-effects chips — avoids pill flicker when
 * multicall rows briefly go missing between refetches (MegaETH throttling).
 */
type SimpleProjectedEffectsLatch = {
  saleCountdownSec: number | undefined;
  timerExtensionPreviewSec: number | undefined;
  charmWadSelected: bigint | undefined;
  buyCheckoutCharmWeightWad: bigint | undefined;
  estimatedSpendWei: bigint | undefined;
  activeDefendedStreak: bigint | undefined;
  warbowPendingFlagOwner: HexAddress | undefined;
};

function emptySimpleProjectedEffectsLatch(): SimpleProjectedEffectsLatch {
  return {
    saleCountdownSec: undefined,
    timerExtensionPreviewSec: undefined,
    charmWadSelected: undefined,
    buyCheckoutCharmWeightWad: undefined,
    estimatedSpendWei: undefined,
    activeDefendedStreak: undefined,
    warbowPendingFlagOwner: undefined,
  };
}

function TimecurveSimpleRatePayTokenPicker({
  payWith,
  setPayWith,
  options,
}: {
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
  options: readonly PayTokenOption[];
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuSurfaceRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const active = options.find((o) => o.value === payWith) ?? options[0]!;

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
    <div ref={rootRef} className="arena-simple__rate-pay-picker">
      <button
        ref={triggerRef}
        type="button"
        className="arena-simple__rate-pay-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={
          open
            ? `${active.label} selected. Close pay token menu.`
            : `Pay with ${active.label}. Open menu to change pay token.`
        }
        data-testid="arena-simple-rate-pay-picker-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <img
          className="arena-simple__rate-pay-logo"
          src={active.logo}
          alt=""
          width={28}
          height={28}
          decoding="async"
          aria-hidden="true"
        />
        <span className="arena-simple__rate-pay-picker-chevron" aria-hidden="true">
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
              className="arena-simple__rate-pay-picker-menu"
              role="listbox"
              aria-label="Pay token"
              style={{
                position: "fixed",
                top: menuBox.top,
                left: menuBox.left,
                minWidth: menuBox.minWidth,
              }}
            >
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={payWith === o.value}
                  className={
                    payWith === o.value
                      ? "arena-simple__rate-pay-picker-option arena-simple__rate-pay-picker-option--active"
                      : "arena-simple__rate-pay-picker-option"
                  }
                  data-testid={`arena-simple-rate-pay-option-${o.value}`}
                  onClick={() => {
                    setPayWith(o.value);
                    setOpen(false);
                  }}
                >
                  <img src={o.logo} alt="" width={22} height={22} decoding="async" aria-hidden="true" />
                  <span className="arena-simple__rate-pay-picker-label">{o.label}</span>
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
  options,
}: {
  payWith: PayWithAsset;
  setPayWith: (p: PayWithAsset) => void;
  disabled: boolean;
  options: readonly PayTokenOption[];
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const comboboxRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const active = options.find((o) => o.value === payWith) ?? options[0]!;

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
    <div ref={rootRef} className="arena-simple__amount-suffix arena-simple__amount-token-dropdown">
      <button
        ref={comboboxRef}
        type="button"
        className="arena-simple__amount-token-combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={`Pay with ${active.label} (change spend token)`}
        data-testid="arena-simple-amount-pay-token"
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
          className="arena-simple__amount-token-dropdown-icon"
          src={active.logo}
          alt=""
          width={16}
          height={16}
          decoding="async"
          aria-hidden="true"
        />
        <span className="arena-simple__amount-token-combobox-label">{active.label}</span>
        <span className="arena-simple__amount-token-combobox-chevron" aria-hidden="true">
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
        <div id={listboxId} className="arena-simple__amount-token-list" role="listbox" aria-label="Spend token">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === payWith}
              data-pay-token-value={o.value}
              className={
                o.value === payWith
                  ? "arena-simple__amount-token-option arena-simple__amount-token-option--active"
                  : "arena-simple__amount-token-option"
              }
              onClick={() => {
                setPayWith(o.value);
                setOpen(false);
                comboboxRef.current?.focus();
              }}
            >
              <img
                className="arena-simple__amount-token-dropdown-icon"
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
 * {@link useArenaSaleSession}, which delegates writes to the same
 * `TimeCurve` ABI used by the Arena view, so the contract remains the single
 * source of truth (see `docs/frontend/timecurve-views.md`).
 */
export function ArenaSimplePage({ mountAsArenaV2 = false }: { mountAsArenaV2?: boolean }) {
  const tc = addresses.timeArena;
  const session = useArenaSaleSession(tc, { forceArenaV2: mountAsArenaV2 });
  const payTokenOptions = useMemo(
    () => payTokenOptionsForSimpleBuy({ isArenaV2: session.isArenaV2 }),
    [session.isArenaV2],
  );
  const simpleProjectedEffectsLatchRef = useRef<SimpleProjectedEffectsLatch>(
    emptySimpleProjectedEffectsLatch(),
  );
  const { mismatch: chainMismatch } = useWalletTargetChainMismatch();
  const prefersReducedMotion = useReducedMotion();
  const [buyFeedRefreshNonce, setBuyFeedRefreshNonce] = useState(0);
  const queryClient = useQueryClient();

  const timerSectionTitle =
    session.phase === "saleStartPending" ? "Arena Opens In" : "Time left";

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

  useEffect(() => {
    if (session.phase !== "saleActive" || !session.walletConnected) {
      simpleProjectedEffectsLatchRef.current = emptySimpleProjectedEffectsLatch();
      return;
    }
    const c = simpleProjectedEffectsLatchRef.current;
    if (session.saleCountdownSec !== undefined) c.saleCountdownSec = session.saleCountdownSec;
    if (session.timerExtensionPreviewSec !== undefined) c.timerExtensionPreviewSec = session.timerExtensionPreviewSec;
    if (session.charmWadSelected !== undefined) c.charmWadSelected = session.charmWadSelected;
    if (session.buyCheckoutCharmWeightWad !== undefined) c.buyCheckoutCharmWeightWad = session.buyCheckoutCharmWeightWad;
    if (session.estimatedSpendWei !== undefined) c.estimatedSpendWei = session.estimatedSpendWei;
    if (session.activeDefendedStreak !== undefined) c.activeDefendedStreak = session.activeDefendedStreak;
    if (session.warbowPendingFlagOwner !== undefined) c.warbowPendingFlagOwner = session.warbowPendingFlagOwner;
  }, [
    session.activeDefendedStreak,
    session.buyCheckoutCharmWeightWad,
    session.charmWadSelected,
    session.estimatedSpendWei,
    session.phase,
    session.saleCountdownSec,
    session.timerExtensionPreviewSec,
    session.walletConnected,
    session.warbowPendingFlagOwner,
  ]);

  const podiumReads = usePodiumReads(tc);
  const { data: podiumPoolBalance } = useReadContract({
    address: session.acceptedAsset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args:
      session.acceptedAsset && session.podiumPoolAddress
        ? [session.podiumPoolAddress]
        : undefined,
    query: {
      enabled: Boolean(session.acceptedAsset && session.podiumPoolAddress),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
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

  useArenaSimplePageSfx({
    recentBuys,
    walletAddress: session.walletAddress,
    saleCountdownSec: session.saleCountdownSec,
    phase: session.phase,
    reduceMotion: Boolean(prefersReducedMotion),
  });

  const spendAssetLabel =
    session.payWith === "cl8y"
      ? "CL8Y"
      : session.payWith === "cred"
        ? "CRED"
        : session.payWith === "eth"
          ? "ETH"
          : "USDM";

  const buyProjectedEffects = useMemo(() => {
    const latch = simpleProjectedEffectsLatchRef.current;
    return buildArenaBuyProjectedEffectLines({
      charmWadSelected: session.charmWadSelected ?? latch.charmWadSelected,
      charmWeightTotalWad: session.buyCheckoutCharmWeightWad ?? latch.buyCheckoutCharmWeightWad,
      estimatedSpendWei: session.estimatedSpendWei ?? latch.estimatedSpendWei,
      decimals: session.decimals,
      spendAssetLabel,
      secondsRemaining: session.saleCountdownSec ?? latch.saleCountdownSec,
      timerExtensionPreview: session.timerExtensionPreviewSec ?? latch.timerExtensionPreviewSec,
      activeDefendedStreak: session.activeDefendedStreak ?? latch.activeDefendedStreak,
      recentBuys,
      previewPolicy: session.buyPreviewPolicy,
      plantWarBowFlag: session.plantWarBowFlag,
      flagOwnerAddr: session.warbowPendingFlagOwner ?? latch.warbowPendingFlagOwner,
      flagPlantAtSec: session.warbowPendingFlagPlantAt,
      walletAddress: session.walletAddress,
      formatRivalWallet: (addr) => shortAddress(addr),
    });
  }, [
    recentBuys,
    session.activeDefendedStreak,
    session.buyCheckoutCharmWeightWad,
    session.buyPreviewPolicy,
    session.charmWadSelected,
    session.decimals,
    session.estimatedSpendWei,
    session.plantWarBowFlag,
    session.saleCountdownSec,
    session.timerExtensionPreviewSec,
    session.walletAddress,
    session.warbowPendingFlagOwner,
    session.warbowPendingFlagPlantAt,
    spendAssetLabel,
  ]);

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
  // helper caption; math lives in `timeArenaPodiumMath` (see tests there).
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

  /** Holds the last non-null gain label while checkout reads settle — avoids parentheses mount/unmount flicker. */
  const [heldBuyPreviewGainLabel, setHeldBuyPreviewGainLabel] = useState<string | null>(null);
  useLayoutEffect(() => {
    const previewOk =
      session.charmWadSelected !== undefined &&
      buyAddsCl8yAtLaunch !== undefined &&
      buyAddsCl8yAtLaunch > 0n;
    if (!previewOk) {
      setHeldBuyPreviewGainLabel(null);
      return;
    }
    if (buyPreviewLaunchGainLabel) {
      setHeldBuyPreviewGainLabel(buyPreviewLaunchGainLabel);
    }
  }, [session.charmWadSelected, buyAddsCl8yAtLaunch, buyPreviewLaunchGainLabel]);

  const buyPreviewGainLabelUi = buyPreviewLaunchGainLabel ?? heldBuyPreviewGainLabel;

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
    session.payWith === "cl8y"
      ? "CL8Y"
      : session.payWith === "cred"
        ? "CRED"
        : session.payWith === "eth"
          ? "ETH"
          : "USDM";

  const slider = session.cl8ySpendBounds ? (
    <div
      className={`arena-simple__slider-row arena-simple__slider-row--pay-${session.payWith}`}
    >
      <ArenaBuySpendRangeInput
        min={0}
        max={10000}
        step={1}
        value={session.spendSliderPermille}
        onChange={(e) => session.setSpendFromSliderPermille(Number(e.target.value))}
        aria-label={`${paySpendSuffix} spend slider (targets CL8Y sale band)`}
        disabled={session.phase !== "saleActive" || !session.walletConnected}
      />
      <div className="arena-simple__amount-input">
        <input
          type="text"
          inputMode="decimal"
          aria-label={`Exact ${paySpendSuffix} spend`}
          className="form-input arena-simple__amount-field"
          value={session.spendInputStr}
          onChange={(e) => session.setSpendFromInput(e.target.value)}
          onFocus={() => session.setSpendFromInputFocus()}
          onBlur={() => {
            void session.setSpendFromInputBlur();
          }}
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
          options={payTokenOptions}
        />
      </div>
    </div>
  ) : null;

  const insufficientCl8yGate =
    session.cl8yCheckoutBoundsGate.kind === "insufficient_cl8y"
      ? session.cl8yCheckoutBoundsGate
      : null;
  const insufficientCl8yForBuy =
    session.payWith === "cl8y" && insufficientCl8yGate !== null;

  const insufficientCredGate =
    session.credCheckoutBoundsGate.kind === "insufficient_cred"
      ? session.credCheckoutBoundsGate
      : null;
  const insufficientCredForBuy =
    session.payWith === "cred" && insufficientCredGate !== null;

  const minMaxPill = session.cl8ySpendBounds ? (
    <span className="arena-simple__minmax arena-simple__minmax--rate-card">
      {session.payWith === "cl8y" ? (
        <>
          Buy Limits:&nbsp;
          <span className="arena-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.minS, session.decimals)}</strong>
            <span className="arena-simple__minmax-suffix">min</span>
          </span>
          <span className="arena-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.maxS, session.decimals)}</strong>
            <span className="arena-simple__minmax-suffix">max</span>
          </span>
        </>
      ) : session.bandBoundaryQuotesLoading ||
        session.quotedBandMinPayInWei === undefined ||
        session.quotedBandMaxPayInWei === undefined ? (
        <>
          Buy Limits:&nbsp;
          <span className="arena-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.minS, session.decimals)}</strong>
            <span className="arena-simple__minmax-suffix">min</span>
          </span>
          <span className="arena-simple__minmax-pair">
            <strong>{formatBuyHubDerivedCompact(session.cl8ySpendBounds.maxS, session.decimals)}</strong>
            <span className="arena-simple__minmax-suffix">max</span>
          </span>
        </>
      ) : (
        <>
          Buy Limits:&nbsp;≈&nbsp;
          <span className="arena-simple__minmax-pair">
            <strong>
              {formatBuyHubDerivedCompact(session.quotedBandMinPayInWei, session.payTokenDecimals)}
            </strong>
            <span className="arena-simple__minmax-suffix">min</span>
          </span>
          <span className="arena-simple__minmax-pair">
            <strong>
              {formatBuyHubDerivedCompact(session.quotedBandMaxPayInWei, session.payTokenDecimals)}
            </strong>
            <span className="arena-simple__minmax-suffix">max</span>
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
  ) : insufficientCl8yForBuy ? (
    <span
      className="arena-simple__minmax arena-simple__minmax--rate-card arena-simple__minmax--blocked"
      data-testid="arena-simple-buy-limits-insufficient-cl8y"
    >
      Buy Limits:&nbsp;
      <strong>
        {formatBuyHubDerivedCompact(
          insufficientCl8yGate.minSpendWei,
          session.decimals,
        )}
      </strong>
      <span className="arena-simple__minmax-suffix">min</span>
      <span className="muted"> (not enough CL8Y in wallet)</span>
    </span>
  ) : (
    <span className="arena-simple__minmax arena-simple__minmax--rate-card">Loading buy limits…</span>
  );

  const buyPreview = insufficientCl8yForBuy ? (
    <div
      className="arena-simple__buy-preview arena-simple__buy-preview--blocked"
      data-testid="arena-simple-buy-preview-insufficient-cl8y"
    >
      <p className="arena-simple__buy-preview-blocked-lede">
        Not enough CL8Y in your wallet to buy. The live minimum is{" "}
        <strong>
          {formatBuyHubDerivedCompact(
            insufficientCl8yGate.minSpendWei,
            session.decimals,
          )}{" "}
          CL8Y
        </strong>
        ; you have{" "}
        <strong>
          {formatBuyHubDerivedCompact(
            insufficientCl8yGate.walletBalanceWei,
            session.decimals,
          )}{" "}
          CL8Y
        </strong>
        .
      </p>
      <Cl8yAcquireExternalLinks
        cl8yToken={session.acceptedAsset}
        buyTestId="arena-simple-buy-cl8y-kumbaya-link"
        bridgeTestId="arena-simple-bridge-cl8y-link"
      />
    </div>
  ) : insufficientCredForBuy ? (
    <div
      className="arena-simple__buy-preview arena-simple__buy-preview--blocked"
      data-testid="arena-simple-buy-preview-insufficient-cred"
    >
      <p className="arena-simple__buy-preview-blocked-lede">
        Not enough Play CRED to burn for this CHARM. This buy needs{" "}
        <strong>
          {formatUnits(insufficientCredGate.requiredCredWei, 18)} CRED
        </strong>
        ; you have{" "}
        <strong>{formatUnits(insufficientCredGate.walletBalanceWei, 18)} CRED</strong>.
      </p>
    </div>
  ) : session.payWith === "cred" && session.credBalanceWei !== undefined ? (
    <div className="arena-simple__buy-preview" data-testid="arena-simple-buy-preview-cred">
      <p className="muted">
        Wallet CRED: <strong>{formatUnits(session.credBalanceWei, 18)}</strong>
        {session.requiredCredBurnWei !== undefined ? (
          <>
            {" · "}
            Burn for this buy:{" "}
            <strong>{formatUnits(session.requiredCredBurnWei, 18)} CRED</strong>
          </>
        ) : (
          " · Pick a CHARM amount to see burn."
        )}
      </p>
    </div>
  ) : session.charmWadSelected === undefined ? (
      <div className="arena-simple__buy-preview arena-simple__buy-preview--loading">
        Loading CHARM preview…
      </div>
    ) : buyAddsCl8yAtLaunch !== undefined && buyAddsCl8yAtLaunch > 0n ? (
      <div className="arena-simple__buy-preview" data-testid="arena-simple-buy-preview">
        <div
          className="arena-simple__buy-preview-approx"
          aria-label="Approximate CL8Y at launch"
        >
          <div className="arena-simple__buy-preview-approx-main">
            <span className="arena-simple__buy-preview-approx-symbol" aria-hidden>
              ≈
            </span>
            <span className="arena-simple__buy-preview-approx-value">
              {"Worth: "}
              {formatBuyHubDerivedCompact(buyAddsCl8yAtLaunch, session.decimals)}
            </span>
            <span className="arena-simple__buy-preview-approx-unit">CL8Y</span>
            <span
              className={
                buyPreviewGainLabelUi
                  ? "arena-simple__buy-preview-gain"
                  : "arena-simple__buy-preview-gain arena-simple__buy-preview-gain--reserved"
              }
              aria-hidden={!buyPreviewGainLabelUi}
              aria-label={
                buyPreviewGainLabelUi
                  ? "Estimated percent gain: CL8Y at launch versus implied CL8Y spend for this CHARM size"
                  : undefined
              }
            >
              {buyPreviewGainLabelUi ? `(${buyPreviewGainLabelUi})` : "\u00A0"}
            </span>
          </div>
          {session.buyCharmBonusPreviewLines.length > 0 ? (
            <div
              className="arena-simple__buy-preview-bonuses"
              data-testid="arena-simple-buy-preview-bonuses"
            >
              {session.buyCharmBonusPreviewLines.map((line, i) => (
                <div key={`${i}:${line}`} className="arena-simple__buy-preview-bonus-line">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  const payUsesKumbaya = session.payWith === "eth" || session.payWith === "usdm";
  const nonCl8yBlocked =
    payUsesKumbaya &&
    (session.kumbayaRoutingBlocker !== null ||
      session.swapQuoteFailed ||
      session.quotedPayInWei === undefined ||
      session.swapQuoteLoading);

  const buyOnCooldown = session.walletCooldownRemainingSec > 0;

  const buyDisabled =
    session.phase !== "saleActive" ||
    session.buySubmitBusy ||
    session.isWriting ||
    !session.walletConnected ||
    chainMismatch ||
    buyOnCooldown ||
    session.charmWadSelected === undefined ||
    nonCl8yBlocked ||
    insufficientCredForBuy ||
    (session.payWith === "cred" && session.credCheckoutBoundsGate.kind === "unavailable") ||
    (session.arenaPaused ?? session.buyFeeRoutingEnabled === false);

  const buyButtonMotion =
    prefersReducedMotion || buyOnCooldown ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.985 } };

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
    if (session.payWith === "cred") {
      if (
        session.requiredCredBurnWei === undefined ||
        session.charmWadSelected === undefined ||
        session.charmWadSelected <= 0n
      ) {
        return { text: "…" as const, unit: " CRED" as const, loading: true as const };
      }
      const perCharm =
        (session.requiredCredBurnWei * ARENA_CRED_WAD) / session.charmWadSelected;
      return {
        text: formatHeroRateFromWad(perCharm),
        unit: " CRED" as const,
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
    session.requiredCredBurnWei,
    session.charmWadSelected,
  ]);

  const rateBoardPayOptions = payTokenOptions.map((o) => (
    <button
      key={o.value}
      type="button"
      data-testid={`arena-paywith-${o.value}`}
      className={
        session.payWith === o.value
          ? "arena-simple__rate-paywith-btn arena-simple__rate-paywith-btn--active"
          : "arena-simple__rate-paywith-btn"
      }
      aria-pressed={session.payWith === o.value}
      aria-label={`Show price in ${o.label}`}
      onClick={() => session.setPayWith(o.value)}
    >
      <img src={o.logo} alt="" width={16} height={16} decoding="async" aria-hidden="true" />
      {o.label}
    </button>
  ));

  const rateBoard = (
    <div
      className="arena-simple__rate-board arena-simple__rate-row arena-simple__rate-row--now"
      data-testid="arena-simple-rate-board"
      aria-live="polite"
    >
      <span className="arena-simple__rate-now-line">
        {/* CHARM coin glyph makes "what you're buying" readable before the
            user parses the label. Decorative; the label is the source of
            truth for assistive tech. */}
        <img
          className="arena-simple__rate-glyph"
          src={CHARM_TOKEN_LOGO}
          alt=""
          aria-hidden="true"
          decoding="async"
          width={24}
          height={24}
        />
        <span className="arena-simple__rate-label">1 CHARM =</span>
        {session.payWith !== "cl8y" && session.rateBoardKumbayaWarning && (
          <span
            className="arena-simple__kumbaya-route-warn"
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
        <span className="arena-simple__rate-hero-tick-isolate">
          <strong
            key={`${priceTickKey}-${session.payWith}-${rateNowDisplay.text}`}
            className="arena-simple__rate-value arena-simple__rate-value--hero arena-simple__rate-value--tick"
            data-testid="arena-simple-rate-now"
            aria-busy={rateNowDisplay.loading}
          >
            {rateNowDisplay.text}
          </strong>
        </span>
        <TimecurveSimpleRatePayTokenPicker
          payWith={session.payWith}
          setPayWith={session.setPayWith}
          options={payTokenOptions}
        />
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
    <div className="page arena-simple-page">
      <ArenaSubnav active="simple" />

      {/* Sale hub — timer + primary buy action share the spotlight row above the fold. */}
      <div className="arena-simple__hub">
        <PageSection
          title={timerSectionTitle}
          spotlight
          className="arena-simple__timer-panel"
          lede={heroNarrative}
        >
          <ArenaTimerHero
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
                  ? "arena-simple__last-extension arena-simple__last-extension--reset"
                  : "arena-simple__last-extension"
              }
              aria-live="polite"
              data-testid="arena-simple-last-extension"
            >
              <span className="arena-simple__last-extension-dot" aria-hidden="true" />
              Just +{formatLocaleInteger(lastExtension.secs)}s by{" "}
              <AddressInline
                address={lastExtension.buyer}
                tailHexDigits={6}
                size={14}
                className="arena-simple__last-extension-addr"
              />
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
          className="arena-simple__buy-panel"
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
          <ChainMismatchWriteBarrier testId="arena-simple-chain-write-gate">
          {/* Live rate board: current price (big, ticks every block) +
              at-launch chain (1 CHARM = N DOUB = M CL8Y at 1.275× anchor). */}
          {session.phase === "saleActive" && rateBoard}

          {!session.walletConnected && session.phase !== "loading" && (
            <div className="arena-simple__connect">
              <p className="arena-simple__connect-pitch">
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
              <p className="muted arena-simple__pay-balance">
                {session.payWalletBalance.raw !== undefined ? (
                  <span className="arena-simple__pay-balance-row">
                    <AmountDisplay
                      raw={String(session.payWalletBalance.raw)}
                      decimals={session.payWalletBalance.decimals}
                      leadingLabel={`YOUR ${session.payWalletBalance.symbol.toUpperCase()}:`}
                      valueMono={false}
                    />
                    {session.payWith === "cl8y" && (
                      <button
                        type="button"
                        className="arena-simple__balance-refresh"
                        aria-label="Refresh CL8Y balance"
                        disabled={session.walletBalanceRefreshing}
                        onClick={() => session.refetchWalletBalance()}
                      >
                        {session.walletBalanceRefreshing ? "…" : "↻"}
                      </button>
                    )}
                  </span>
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
              {(session.arenaPaused ?? session.buyFeeRoutingEnabled === false) && (
                <StatusMessage variant="muted">
                  {session.arenaPaused
                    ? "Time Arena is paused onchain — buys and WarBow DOUB spend are disabled until operators unpause."
                    : "Sale interactions are paused onchain (buys + WarBow CL8Y spend) until operators re-enable."}
                </StatusMessage>
              )}
              <motion.button
                type="button"
                className={[
                  "btn-primary btn-primary--priority arena-simple__cta arena-simple__cta--arcade",
                  buyOnCooldown ? "arena-simple__cta--cooldown" : "",
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
                  className="arena-simple__cta-glyph"
                  src={CHARM_TOKEN_LOGO}
                  alt=""
                  aria-hidden="true"
                  width={28}
                  height={28}
                  decoding="async"
                />
                <span className="arena-simple__cta-label">
                  {session.buySubmitBusy || session.isWriting
                    ? "Processing transaction…"
                    : payUsesKumbaya && session.swapQuoteLoading
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
                className="arena-simple__buy-advanced accordion-panel"
                data-testid="arena-simple-buy-advanced"
              >
                <summary>ADVANCED</summary>
                <div className="accordion-panel__content">
                  <div
                    className="arena-simple__rate-paywith arena-simple__rate-paywith--buy-heading arena-simple__rate-paywith--segmented"
                    role="group"
                    aria-label="Show live price in"
                  >
                    {rateBoardPayOptions}
                  </div>
                  {minMaxPill}
                  <div className="arena-simple__referral muted">
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
                  {session.payWith !== "cred" ? (
                    <ArenaDoubUnlimitedApprovalFieldset
                      disabled={session.phase !== "saleActive" || !session.walletConnected}
                    />
                  ) : null}
                </div>
              </details>
              <ArenaBuyProjectedEffects
                className="arena-simple__buy-projected-effects"
                items={buyProjectedEffects}
              />
              {session.buyError && (
                <StatusMessage variant="error">
                  {session.buyError}{" "}
                  <button
                    type="button"
                    className="btn-secondary arena-simple__error-dismiss"
                    onClick={() => session.clearBuyError()}
                  >
                    dismiss
                  </button>
                </StatusMessage>
              )}

              {session.showWarbowClaimFlagButton && session.chainNowSec !== undefined && (
                <WarbowClaimFlagButton
                  canClaimWarBowFlag={session.canClaimWarBowFlag}
                  ledgerNowSec={session.chainNowSec}
                  flagSilenceEndSec={session.warbowFlagSilenceEndSec}
                  saleActive={session.phase === "saleActive"}
                  buyFeeRoutingEnabled={session.buyFeeRoutingEnabled}
                  arenaPaused={session.arenaPaused}
                  isConnected={session.walletConnected}
                  isWriting={session.isWriting || session.buySubmitBusy}
                  onClaim={() => void session.submitClaimWarBowFlag()}
                  className="btn-secondary btn-secondary--priority arena-simple__claim-flag-cta"
                  testId="arena-simple-claim-flag-submit"
                />
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
                className="btn-primary arena-simple__cta"
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

      <ArenaSimplePodiumSection
        podiumRows={podiumReads.data}
        podiumLoading={podiumReads.isLoading}
        podiumPayoutPreview={podiumPayoutPreview}
        decimals={session.decimals}
        address={session.walletAddress}
        recentBuys={recentBuys}
        podiumNowUnixSec={tickerWallNowSec}
      />

      <ArenaSimpleAgentCard />
      <FooterSiteLinksCard />
    </div>
  );
}

export default ArenaSimplePage;
