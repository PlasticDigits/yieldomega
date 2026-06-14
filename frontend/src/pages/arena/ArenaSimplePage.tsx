// SPDX-License-Identifier: AGPL-3.0-only

import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AmountTripleStack } from "@/components/AmountTripleStack";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { ArenaBuySpendRangeInput } from "@/components/ArenaBuySpendRangeInput";
import { Cl8yAcquireExternalLinks } from "@/components/Cl8yAcquireExternalLinks";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import {
  fetchArenaBuysAsBuyItems,
  fetchArenaWarbowLatestBp,
  type BuyItem,
} from "@/lib/indexerApi";
import {
  formatBuyCtaCharmAmountLabel,
  formatBuyHubDerivedCompact,
} from "@/lib/timeArenaBuyHubFormat";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";
import { payTokenOptionsForSimpleBuy } from "@/lib/arenaPayTokenOptions";
import type { PayTokenOption } from "@/lib/arenaPayTokenOptions";
import { CHARM_TOKEN_LOGO } from "@/lib/tokenMedia";
import { formatUnits, isAddress, zeroAddress } from "viem";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { formatMmSsCountdown } from "@/pages/arena/formatTimer";
import { phaseNarrative } from "@/pages/arena/arenaSimplePhase";
import { FeatureMechanicModal } from "@/components/FeatureMechanicModal";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import {
  type ArenaFeatureKey,
  FEATURE_UNLOCK_LEVEL,
  featureKeyForUnlockLevel,
  isFeatureUnlocked,
  readFeatureTutorialSeen,
} from "@/lib/arenaProgression";
import { useArenaPlayerLevel } from "@/hooks/useArenaPlayerLevel";
import { invalidateArenaWalletStatsQueries } from "@/hooks/useWalletStats";
import { useAccount } from "wagmi";
import { ArenaTimerPanelEpochCorner } from "@/pages/arena/ArenaTimerPanelEpochCorner";
import { ArenaTimerPanelHelpCorner } from "@/pages/arena/ArenaTimerPanelHelpCorner";
import { ArenaTimerPodiumCarousel } from "@/pages/arena/ArenaTimerPodiumCarousel";
import { useTimerPodiumSlideMeta } from "@/pages/arena/useTimerPodiumSlideMeta";
import { ArenaTimerChips } from "@/pages/arena/ArenaTimerChips";
import { ArenaTimerHero } from "@/pages/arena/ArenaTimerHero";
import { ArenaCharmCredCard } from "@/pages/arena/ArenaCharmCredCard";
import { ArenaWarbowGatePreview } from "@/pages/arena/ArenaWarbowGatePreview";
import {
  ArenaWarbowHeroPanel,
  type WarbowTarget,
} from "@/pages/arena/ArenaWarbowHeroPanel";
import type { IndexerWarbowHeroHead } from "@/pages/arena/useArenaWarbowHero";
import { useArenaSaleSession } from "@/pages/arena/useArenaSaleSession";
import { WarbowClaimFlagButton } from "@/components/WarbowClaimFlagButton";
import { useArenaSimplePageSfx } from "@/pages/arena/useArenaSimplePageSfx";
import { FooterSiteLinksCard } from "@/components/FooterSiteLinksCard";
import { ArenaBuyProjectedEffectsPills } from "@/pages/arena/ArenaBuyProjectedEffectsPills";
import { buildArenaBuyProjectedEffectLines } from "@/pages/arena/arenaBuyProjectedEffects";
import {
  type PodiumReadRow,
  usePodiumReads,
  useWarbowPodiumLiveInvalidation,
} from "@/pages/arena/usePodiumReads";
import {
  mergeBuysNewestFirst,
  parseNonNegativeUnixSec,
  resolveIndexerViewerWarbowBattlePoints,
} from "@/lib/arenaPageHelpers";
import { ArenaShell } from "@/components/glass";

/** Indexer page size for Simple head poll (podium ages, SFX). */
const SIMPLE_RECENT_BUYS_PAGE_LIMIT = 15;
const WARBOW_PODIUM_SLOT = 1;
const ZERO_ADDRESS_LOWER = zeroAddress.toLowerCase();

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

function buildWarbowTargets(
  podiumRows: readonly PodiumReadRow[] | undefined,
  recentBuys: readonly BuyItem[] | null,
  viewerAddress: string | undefined,
  warbowBpByAddress?: ReadonlyMap<string, string>,
): WarbowTarget[] {
  const viewer = viewerAddress?.toLowerCase();
  const byAddress = new Map<string, WarbowTarget>();

  const add = (address: string | undefined, target: Omit<WarbowTarget, "address">) => {
    const raw = address?.trim();
    if (!raw || !isAddress(raw)) return;
    const lower = raw.toLowerCase();
    if (lower === ZERO_ADDRESS_LOWER || lower === viewer) return;
    const battlePoints = target.battlePoints ?? warbowBpByAddress?.get(lower);
    const nextTarget = { ...target, battlePoints };
    const existing = byAddress.get(lower);
    if (!existing || (nextTarget.source === "podium" && existing.source !== "podium")) {
      byAddress.set(lower, { address: raw as `0x${string}`, ...nextTarget });
      return;
    }
    if (existing.battlePoints === undefined && nextTarget.battlePoints !== undefined) {
      byAddress.set(lower, { ...existing, battlePoints: nextTarget.battlePoints });
    }
  };

  const warbowRow = podiumRows?.[WARBOW_PODIUM_SLOT];
  warbowRow?.winners.forEach((winner, index) => {
    add(winner, {
      battlePoints: warbowRow.values[index],
      source: "podium",
      rank: index + 1,
    });
  });

  for (const buy of recentBuys ?? []) {
    add(buy.buyer, {
      battlePoints: buy.battle_points_after,
      source: "recent",
    });
  }

  return [...byAddress.values()].slice(0, 24);
}

function ArenaSimpleAmountPayTokenSelect({
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
    <div
      ref={rootRef}
      className="arena-simple__amount-suffix arena-simple__amount-token-dropdown"
      data-open={open && !disabled ? "" : undefined}
    >
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
 * Default `/arena` view — Arena v2 **always-on DOUB** sale. Surfaces time remaining,
 * the primary buy action, live per-CHARM DOUB price, and checkout preview (XP gain,
 * timer, and podium effects). Contract state comes from {@link useArenaSaleSession}
 * (`TimeArena` reads/writes; see `docs/frontend/arena-views.md`).
 */
export function ArenaSimplePage({
  mountAsArenaV2 = false,
  playFirst = false,
  onOpenWalletProfile,
}: {
  mountAsArenaV2?: boolean;
  /** Homepage `/` — gameplay above the fold with tighter shell spacing. */
  playFirst?: boolean;
  /** Opens wallet profile modal on participant address click (#258). */
  onOpenWalletProfile?: (address: string) => void;
}) {
  const tc = addresses.timeArena;
  const session = useArenaSaleSession(tc, { forceArenaV2: mountAsArenaV2 });
  const payTokenOptions = useMemo(
    () => payTokenOptionsForSimpleBuy({ isArenaV2: session.isArenaV2 }),
    [session.isArenaV2],
  );
  const primarySpendAssetLabel = session.isArenaV2 ? "DOUB" : "CL8Y";
  const simpleProjectedEffectsLatchRef = useRef<SimpleProjectedEffectsLatch>(
    emptySimpleProjectedEffectsLatch(),
  );
  const { mismatch: chainMismatch } = useWalletTargetChainMismatch();
  const prefersReducedMotion = useReducedMotion();
  const [buyFeedRefreshNonce, setBuyFeedRefreshNonce] = useState(0);
  const prevBuySubmitBusyRef = useRef(false);
  const queryClient = useQueryClient();

  const { address: connectedAddress } = useAccount();
  const { levelBigint: playerLevelRaw, stats: playerWalletStats } =
    useArenaPlayerLevel(connectedAddress);
  const [featureModal, setFeatureModal] = useState<ArenaFeatureKey | null>(null);
  const prevLevelRef = useRef<number | undefined>(undefined);
  const warbowUnlocked =
    playerLevelRaw !== undefined && isFeatureUnlocked(playerLevelRaw as bigint, "warbow");
  const warbowFlagUnlocked =
    playerLevelRaw !== undefined && isFeatureUnlocked(playerLevelRaw as bigint, "warbow_flag");
  const warbowFlagDisabled =
    !session.walletConnected ||
    session.phase !== "saleActive" ||
    session.arenaPaused === true ||
    !warbowFlagUnlocked;

  useEffect(() => {
    if (playerLevelRaw !== undefined && !warbowFlagUnlocked && session.plantWarBowFlag) {
      session.setPlantWarBowFlag(false);
    }
  }, [playerLevelRaw, session, warbowFlagUnlocked]);

  useEffect(() => {
    if (playerLevelRaw === undefined) return;
    const lvl = Number(playerLevelRaw);
    const prev = prevLevelRef.current;
    prevLevelRef.current = lvl;
    if (prev === undefined || lvl <= prev) return;
    for (let unlock = prev + 1; unlock <= lvl; unlock += 1) {
      const key = featureKeyForUnlockLevel(unlock);
      if (key && !readFeatureTutorialSeen(key)) {
        setFeatureModal(key);
        break;
      }
    }
  }, [playerLevelRaw]);

  const openFeatureHelp = useCallback((feature: ArenaFeatureKey) => {
    setFeatureModal(feature);
  }, []);

  const podiumReads = usePodiumReads(tc);

  const [podiumCarouselIndex, setPodiumCarouselIndex] = useState(0);

  const heroSecondsRemaining =
    session.phase === "saleActive"
      ? session.saleCountdownSec
      : session.preStartCountdownSec;

  const heroNarrative =
    session.phase === "saleStartPending" ? phaseNarrative(session.phase) : undefined;

  const podiumSlideMeta = useTimerPodiumSlideMeta(podiumCarouselIndex, {
    phase: session.phase,
    decimals: session.decimals,
    podiumPayoutPreview: podiumReads.podiumPayoutPreview,
    lastBuyCountdownSec: heroSecondsRemaining,
    walletConnected: session.walletConnected,
    playerLevel: playerLevelRaw,
  });

  const timerSectionTitle = podiumSlideMeta.title;
  const heroCountdownSec =
    session.phase === "saleActive" ? podiumSlideMeta.countdownSec : heroSecondsRemaining;
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

  const [recentBuys, setRecentBuys] = useState<BuyItem[] | null>(null);
  const [warbowTargetBpByAddress, setWarbowTargetBpByAddress] = useState<
    ReadonlyMap<string, string>
  >(() => new Map());
  /** Wall clock for podium “time since buy” copy; decoupled from chain time. */
  const [tickerWallNowSec, setTickerWallNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useWarbowPodiumLiveInvalidation(tc, queryClient, setBuyFeedRefreshNonce);

  useEffect(() => {
    const wasBusy = prevBuySubmitBusyRef.current;
    prevBuySubmitBusyRef.current = session.buySubmitBusy;
    if (wasBusy && !session.buySubmitBusy && session.buyError === null) {
      setBuyFeedRefreshNonce((n) => n + 1);
      invalidateArenaWalletStatsQueries(queryClient);
    }
  }, [queryClient, session.buyError, session.buySubmitBusy]);

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

  const buyProjectedEffects = useMemo(() => {
    const latch = simpleProjectedEffectsLatchRef.current;
    return buildArenaBuyProjectedEffectLines({
      charmWadSelected: session.charmWadSelected ?? latch.charmWadSelected,
      charmWeightTotalWad: session.buyCheckoutCharmWeightWad ?? latch.buyCheckoutCharmWeightWad,
      secondsRemaining: session.saleCountdownSec ?? latch.saleCountdownSec,
      timerExtensionPreview: session.timerExtensionPreviewSec ?? latch.timerExtensionPreviewSec,
      activeDefendedStreak: session.activeDefendedStreak ?? latch.activeDefendedStreak,
      recentBuys,
      previewPolicy: session.buyPreviewPolicy,
      plantWarBowFlag: session.plantWarBowFlag,
      flagOwnerAddr: session.warbowPendingFlagOwner ?? latch.warbowPendingFlagOwner,
      flagPlantAtSec: session.warbowPendingFlagPlantAt,
      walletAddress: session.walletAddress,
      playerLevel: playerLevelRaw,
      xpTowardNext:
        playerWalletStats?.xp_toward_next !== undefined
          ? BigInt(playerWalletStats.xp_toward_next)
          : undefined,
      formatRivalWallet: (addr) => shortAddress(addr),
    });
  }, [
    recentBuys,
    playerLevelRaw,
    playerWalletStats?.xp_toward_next,
    session.activeDefendedStreak,
    session.buyCheckoutCharmWeightWad,
    session.buyPreviewPolicy,
    session.charmWadSelected,
    session.plantWarBowFlag,
    session.saleCountdownSec,
    session.timerExtensionPreviewSec,
    session.walletAddress,
    session.warbowPendingFlagOwner,
    session.warbowPendingFlagPlantAt,
  ]);

  useEffect(() => {
    if (!indexerBaseUrl()) {
      setRecentBuys(null);
      setWarbowTargetBpByAddress(new Map());
      return;
    }
    let cancelled = false;
    let timeoutId = 0;

    const tick = async () => {
      try {
        const buys = await fetchArenaBuysAsBuyItems(SIMPLE_RECENT_BUYS_PAGE_LIMIT, 0);
        if (cancelled) return;
        const ok = buys != null;
        reportIndexerFetchAttempt(ok);
        if (ok) {
          setRecentBuys((prev) => mergeBuysNewestFirst(buys.items, prev));
          const bpPage = await fetchArenaWarbowLatestBp(buys.items.map((buy) => buy.buyer));
          if (cancelled) return;
          const nextBp = new Map<string, string>();
          for (const row of bpPage.items) {
            const player = row.player?.trim().toLowerCase();
            const bp = row.battle_points?.trim();
            if (player && bp) {
              nextBp.set(player, bp);
            }
          }
          setWarbowTargetBpByAddress(nextBp);
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

  const warbowTargets = useMemo(
    () =>
      buildWarbowTargets(
        podiumReads.data,
        recentBuys,
        session.walletAddress,
        warbowTargetBpByAddress,
      ),
    [podiumReads.data, recentBuys, session.walletAddress, warbowTargetBpByAddress],
  );

  const indexerWarbowHead = useMemo((): IndexerWarbowHeroHead | undefined => {
    if (!indexerBaseUrl()) return undefined;
    return {
      chainNowSec: session.chainNowSec,
      paused: session.arenaPaused,
      guardUntilSec: parseNonNegativeUnixSec(playerWalletStats?.warbow_guard_until),
    };
  }, [playerWalletStats?.warbow_guard_until, session.arenaPaused, session.chainNowSec]);

  const indexerViewerWarbowBattlePoints = useMemo(() => {
    if (!indexerBaseUrl()) return undefined;
    return resolveIndexerViewerWarbowBattlePoints(session.walletAddress, {
      recentBuys,
      podiumRows: podiumReads.data,
      walletWarbowBattlePoints: playerWalletStats?.warbow_battle_points,
    });
  }, [recentBuys, podiumReads.data, playerWalletStats?.warbow_battle_points, session.walletAddress]);

  const paySpendSuffix =
    session.payWith === "cl8y"
      ? primarySpendAssetLabel
      : session.payWith === "cred"
        ? "CRED"
        : session.payWith === "eth"
          ? "ETH"
          : "USDM";

  const spendControlsDisabled =
    session.phase !== "saleActive" || !session.walletConnected;

  const payBalance = (
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
              aria-label={`Refresh ${primarySpendAssetLabel} balance`}
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
  );

  const slider = session.cl8ySpendBounds ? (
    <div className="arena-simple__swap-pay">
      <div
        className={`arena-simple__swap-field arena-simple__swap-field--pay arena-simple__swap-field--pay-${session.payWith}`}
      >
        <div className="arena-simple__swap-field-head">
          <span>You pay</span>
        </div>
        <div className="arena-simple__swap-field-body">
          <div className="arena-simple__pay-row">
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
              disabled={spendControlsDisabled}
            />
            <div className="arena-simple__pay-token-stack">
              <ArenaSimpleAmountPayTokenSelect
                payWith={session.payWith}
                setPayWith={session.setPayWith}
                disabled={spendControlsDisabled}
                options={payTokenOptions}
              />
              {payBalance}
            </div>
          </div>
        </div>
        <div className="arena-simple__swap-field-footer">
          <div
            className={`arena-simple__pay-slider-row arena-simple__pay-slider-row--pay-${session.payWith}`}
          >
            <ArenaBuySpendRangeInput
              className="arena-simple__pay-slider"
              min={0}
              max={10000}
              step={1}
              value={session.spendSliderPermille}
              onChange={(e) => session.setSpendFromSliderPermille(Number(e.target.value))}
              aria-label={`${paySpendSuffix} spend slider (targets CHARM buy band)`}
              disabled={spendControlsDisabled}
            />
            <div className="arena-simple__pay-slider-minmax">
              <button
                type="button"
                className="arena-simple__pay-slider-bound"
                aria-label={`Set minimum ${paySpendSuffix} spend`}
                disabled={spendControlsDisabled}
                onClick={() => session.setSpendFromSliderPermille(0)}
              >
                MIN
              </button>
              <button
                type="button"
                className="arena-simple__pay-slider-bound"
                aria-label={`Set maximum ${paySpendSuffix} spend`}
                disabled={spendControlsDisabled}
                onClick={() => session.setSpendFromSliderPermille(10000)}
              >
                MAX
              </button>
            </div>
          </div>
        </div>
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

  const buyPreview = insufficientCl8yForBuy ? (
    <div
      className="arena-simple__buy-preview arena-simple__buy-preview--blocked"
      data-testid="arena-simple-buy-preview-insufficient-cl8y"
    >
      <p className="arena-simple__buy-preview-blocked-lede">
        Not enough {primarySpendAssetLabel} in your wallet to buy. The live minimum is{" "}
        <strong>
          {formatBuyHubDerivedCompact(
            insufficientCl8yGate.minSpendWei,
            session.decimals,
          )}{" "}
          {primarySpendAssetLabel}
        </strong>
        ; you have{" "}
        <strong>
          {formatBuyHubDerivedCompact(
            insufficientCl8yGate.walletBalanceWei,
            session.decimals,
          )}{" "}
          {primarySpendAssetLabel}
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
  ) : session.charmWadSelected === undefined ? (
      <div className="arena-simple__buy-preview arena-simple__buy-preview--loading">
        Loading CHARM preview…
      </div>
    ) : (
      <>
        <ArenaBuyProjectedEffectsPills lines={buyProjectedEffects} />
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
      </>
    );

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
    session.arenaPaused === true;

  const buyButtonMotion =
    prefersReducedMotion || buyOnCooldown ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.985 } };

  const buyCharmButton = (
    <motion.button
      type="button"
      data-testid="arena-simple-buy-charm"
      className={[
        "btn-primary btn-primary--priority arena-simple__cta arena-simple__cta--arcade",
        buyOnCooldown ? "arena-simple__cta--cooldown" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={buyDisabled}
      title={buyOnCooldown ? "Wallet buy cooldown (matches onchain pacing)" : undefined}
      aria-label={
        session.buySubmitBusy || session.isWriting
          ? "Processing CHARM buy transaction"
          : buyOnCooldown
            ? `Buy CHARM on cooldown (${formatMmSsCountdown(session.walletCooldownRemainingSec)} remaining)`
            : `Buy CHARM with ${paySpendSuffix}`
      }
      onClick={() => void session.submitBuy()}
      {...buyButtonMotion}
    >
      <span className="arena-simple__cta-label">
        {session.buySubmitBusy || session.isWriting
          ? "Processing transaction…"
          : payUsesKumbaya && session.swapQuoteLoading
            ? "Refreshing quote…"
            : buyOnCooldown
              ? `${formatMmSsCountdown(session.walletCooldownRemainingSec)} cooldown`
              : "Buy"}
      </span>
    </motion.button>
  );

  const receiveCharmLabel =
    session.buyCheckoutCharmWeightWad !== undefined
      ? formatBuyCtaCharmAmountLabel(session.buyCheckoutCharmWeightWad)
      : session.charmWadSelected !== undefined
        ? formatBuyCtaCharmAmountLabel(session.charmWadSelected)
        : "—";

  const receiveCharmBalance = (
    <p className="muted arena-simple__receive-balance">
      {session.charmWalletBalanceWad !== undefined ? (
        <span className="arena-simple__receive-balance-row">
          <AmountDisplay
            raw={String(session.charmWalletBalanceWad)}
            decimals={18}
            leadingLabel="YOUR CHARM:"
            valueMono={false}
          />
          <button
            type="button"
            className="arena-simple__balance-refresh"
            aria-label="Refresh CHARM balance"
            disabled={session.charmWalletBalanceRefreshing}
            onClick={() => session.refetchCharmWalletBalance()}
          >
            {session.charmWalletBalanceRefreshing ? "…" : "↻"}
          </button>
        </span>
      ) : (
        <AmountTripleStack
          rows={[
            {
              label: "YOUR CHARM:",
              value: "—",
              monoValue: false,
            },
          ]}
        />
      )}
    </p>
  );

  const receiveField =
    session.phase === "saleActive" && session.walletConnected ? (
      <div className="arena-simple__swap-field arena-simple__swap-field--receive" data-testid="arena-simple-buy-receive">
        <div className="arena-simple__swap-field-head">
          <span>You receive</span>
        </div>
        <div className="arena-simple__swap-field-body">
          <div className="arena-simple__receive-row">
            <strong className="arena-simple__receive-amount">{receiveCharmLabel}</strong>
            <div className="arena-simple__receive-token-stack">
              <span className="arena-simple__receive-token">
                <img
                  className="arena-simple__receive-token-logo"
                  src={CHARM_TOKEN_LOGO}
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={24}
                  decoding="async"
                />
                CHARM
              </span>
              {receiveCharmBalance}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const timerHeroFoot =
    session.phase === "saleStartPending"
      ? "Stay on this page — it switches to Live automatically."
      : undefined;

  const timerPanelLocked =
    session.phase === "saleActive" && Boolean(podiumReads.data) && podiumSlideMeta.locked;
  const timerEpochCorner = (
    <ArenaTimerPanelEpochCorner
      podiumLabel={podiumSlideMeta.slot.label}
      epoch={podiumReads.data?.[podiumSlideMeta.slot.categoryIndex]?.epoch}
    />
  );
  const timerHelpCorner =
    session.phase === "saleActive" && podiumReads.data ? (
      <ArenaTimerPanelHelpCorner
        podiumLabel={podiumSlideMeta.slot.label}
        feature={podiumSlideMeta.slot.feature}
        onFeatureHelp={openFeatureHelp}
      />
    ) : null;
  const timerCarousel =
    session.phase === "saleActive" && podiumReads.data ? (
      <ArenaTimerPodiumCarousel
        panelHeader={
          <ArenaTimerHero
            secondsRemaining={heroCountdownSec}
            countdownKind="round"
            foot={timerHeroFoot}
          />
        }
        activeIndex={podiumCarouselIndex}
        onActiveIndexChange={setPodiumCarouselIndex}
        address={session.walletAddress}
        decimals={session.decimals}
        podiumRows={podiumReads.data}
        podiumPayoutPreview={podiumReads.podiumPayoutPreview}
        recentBuys={recentBuys}
        podiumNowUnixSec={tickerWallNowSec}
        locked={false}
        lockedForConnection={podiumSlideMeta.lockedForConnection}
        requiredLevel={podiumSlideMeta.slot.requiredLevel}
        categoryIndex={podiumSlideMeta.slot.categoryIndex}
        onOpenWalletProfile={onOpenWalletProfile}
        surface={timerPanelLocked ? "blur" : "full"}
      />
    ) : null;

  const timerStack = (
    <div className="arena-simple__timer-panel-stack">
      {timerCarousel ?? (
        <ArenaTimerHero
          secondsRemaining={heroCountdownSec}
          countdownKind={session.phase === "saleStartPending" ? "open" : "round"}
          foot={timerHeroFoot}
        />
      )}
    </div>
  );

  const timerPanelBody = timerPanelLocked ? (
    <>
      <div className="arena-simple__timer-panel-lock-frame">
        <LockedUntilLevel
          requiredLevel={podiumSlideMeta.slot.requiredLevel}
          className="arena-simple__timer-panel-lock"
          overlayTestId={`arena-timer-podium-lock-${podiumSlideMeta.slot.categoryIndex}`}
          title={podiumSlideMeta.lockedForConnection ? "Connect wallet" : undefined}
          detail={
            podiumSlideMeta.lockedForConnection
              ? "Connect wallet to buy CHARM."
              : "Buy CHARM to level up this wallet and activate this podium."
          }
        >
          <div className="arena-simple__timer-panel-lock-content">
            <div className="section-heading arena-simple__timer-panel-lock-heading">
              <div className="section-heading__copy">
                <h2>{timerSectionTitle}</h2>
              </div>
            </div>
            {timerEpochCorner}
            {timerStack}
          </div>
        </LockedUntilLevel>

        <div className="arena-simple__timer-panel-lock-chrome">
          <div className="section-heading arena-simple__timer-panel-lock-chrome-heading" aria-hidden="true">
            <div className="section-heading__copy">
              <h2>{timerSectionTitle}</h2>
            </div>
          </div>
          <div className="arena-simple__timer-panel-stack">
            {timerCarousel ? cloneElement(timerCarousel, { surface: "chrome" }) : null}
          </div>
        </div>
      </div>
      {timerHelpCorner}
    </>
  ) : (
    <>
      {timerEpochCorner}
      {timerStack}
      {timerHelpCorner}
    </>
  );

  return (
    <ArenaShell playFirst={playFirst}>
    <div
      className="page arena-simple-page arena-command-console glass-arena-console"
      data-testid="arena-command-console"
    >
      <div className="arena-command-console__grid">
        <div
          className="arena-command-console__primary-column"
          data-testid="arena-command-console-primary"
        >
          <div className="arena-simple__timer-row" aria-label="Arena podium timers">
            <PageSection
              title={timerPanelLocked ? undefined : timerSectionTitle}
              spotlight
              className={[
                "arena-simple__timer-panel",
                timerPanelLocked ? "arena-simple__timer-panel--slide-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              lede={timerPanelLocked ? undefined : heroNarrative}
            >
              {timerPanelBody}
            </PageSection>
          </div>

          <ChainMismatchWriteBarrier
            testId="arena-simple-chain-write-gate"
            className="arena-simple__buy-panel"
          >
          {!session.walletConnected && session.phase !== "loading" && (
            <div className="arena-simple__connect">
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
                  Routed buys use a fixed <strong>3%</strong> max slippage cap.
                </p>
              )}
              <div className="arena-simple__swap-stack">
                {slider}
                {slider && receiveField ? (
                  <div className="arena-simple__swap-direction" aria-hidden="true">
                    <span className="arena-simple__swap-direction-badge">
                      <svg
                        className="arena-simple__swap-direction-icon"
                        viewBox="0 0 24 24"
                        width={11}
                        height={11}
                        aria-hidden="true"
                      >
                        <path
                          d="M12 5v12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                        />
                        <path
                          d="M7 14l5 5 5-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                ) : null}
                {receiveField ? (
                  <div className="arena-simple__receive-slot">
                    {receiveField}
                    <div className="arena-simple__buy-cta-row">
                      <div className="arena-simple__buy-cta-effects">{buyPreview}</div>
                      <div className="arena-simple__buy-cta-anchor">{buyCharmButton}</div>
                    </div>
                  </div>
                ) : null}
              </div>
              {session.arenaPaused === true && (
                <StatusMessage variant="muted">
                  Time Arena is paused onchain — buys and WarBow DOUB spend are disabled until operators unpause.
                </StatusMessage>
              )}
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

          {session.phase === "saleStartPending" && (
            <StatusMessage variant="muted">
              The sale has not opened yet. The Buy CHARM action will unlock automatically when the
              countdown above reaches zero.
            </StatusMessage>
          )}

          </ChainMismatchWriteBarrier>
        </div>

        {!warbowUnlocked ? (
          <div
            className="arena-command-console__hub-warbow"
            data-testid="arena-command-console-warbow"
          >
            <LockedUntilLevel
              requiredLevel={FEATURE_UNLOCK_LEVEL.warbow}
              className="arena-simple__warbow-gate arena-level-gate arena-level-gate--locked"
              testId="warbow-hero-level-gate"
              overlayTestId="warbow-hero-level-lock"
              detail="Buy CHARM to activate this mechanic."
            >
              <ArenaWarbowGatePreview />
            </LockedUntilLevel>
          </div>
        ) : null}

        <div className="arena-command-console__side-rail">
          <ArenaCharmCredCard recentBuys={recentBuys} podiumRows={podiumReads.data} />
          <ArenaTimerChips
            playerLevel={playerLevelRaw}
            address={session.walletAddress}
            decimals={session.decimals}
            podiumRows={podiumReads.data}
            podiumPayoutPreview={podiumReads.podiumPayoutPreview}
            recentBuys={recentBuys}
            activeDefendedStreak={session.activeDefendedStreak}
            podiumNowUnixSec={tickerWallNowSec}
            onFeatureHelp={openFeatureHelp}
            onOpenWalletProfile={onOpenWalletProfile}
          />
        </div>
      </div>

      {warbowUnlocked ? (
        <div
          className="arena-command-console__warbow-lane"
          data-testid="arena-command-console-warbow"
        >
          <ArenaWarbowHeroPanel
            phase={session.phase}
            playerLevel={playerLevelRaw}
            onFeatureHelp={openFeatureHelp}
            warbowTargets={warbowTargets}
            indexerViewerBattlePoints={indexerViewerWarbowBattlePoints}
            indexerWarbowHead={indexerWarbowHead}
            plantWarBowFlag={session.plantWarBowFlag}
            onPlantWarBowFlagChange={session.setPlantWarBowFlag}
            plantFlagDisabled={warbowFlagDisabled}
          />
        </div>
      ) : null}

      <FooterSiteLinksCard />
      <FeatureMechanicModal feature={featureModal} onClose={() => setFeatureModal(null)} />
    </div>
    </ArenaShell>
  );
}

export default ArenaSimplePage;
