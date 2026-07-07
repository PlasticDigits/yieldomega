// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useAccount } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PlayerIdentity } from "@/components/arena";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatWarbowViewerBattlePointsDisplay } from "@/lib/arenaPageHelpers";
import { formatLocaleInteger, formatUnixSecIsoUtc } from "@/lib/formatAmount";
import { WarbowClaimFlagButton } from "@/components/WarbowClaimFlagButton";
import { WARBOW_FLAG_SILENCE_SEC } from "@/lib/arenaWarbowConstants";
import { warbowClaimFlagSilenceRemainingSec } from "@/lib/warbowClaimFlagState";
import { formatCountdown } from "@/pages/arena/formatTimer";
import { useArenaPendingRevengeTargets } from "@/hooks/useArenaPendingRevengeTargets";
import { ArenaLevelGate } from "@/components/ArenaLevelGate";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import {
  type ArenaFeatureKey,
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  shouldShowLevelLock,
} from "@/lib/arenaProgression";
import {
  type IndexerWarbowHeroHead,
  useArenaWarbowHero,
} from "@/pages/arena/useArenaWarbowHero";
import type { SaleSessionPhase } from "@/pages/arena/arenaSimplePhase";
import { moveWarbowTargetListIndex } from "@/pages/arena/warbowTargetListKeyboard";
import { WarbowHeroSubcardHelpButton } from "@/pages/arena/WarbowHeroSubcardHelpButton";
import {
  type WarbowHeroSubcardHelpTopic,
  warbowHeroSubcardHelpCopy,
} from "@/pages/arena/warbowHeroSubcardHelpCopy";
import { WarbowHeroSubcardHelpModal } from "@/components/WarbowHeroSubcardHelpModal";

function targetIsInsideAddressAction(target: EventTarget | null): boolean {
  return Boolean(
    target && (target as HTMLElement).closest?.("a[href], .address-inline__profile-btn"),
  );
}

type Props = {
  phase: SaleSessionPhase;
  playerLevel?: bigint | number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
  /** Opens wallet profile modal on rival identity click ([#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258) · [#318](https://gitlab.com/PlasticDigits/yieldomega/-/issues/318)). */
  onOpenWalletProfile?: (address: string) => void;
  warbowTargets?: readonly WarbowTarget[];
  /** Indexer-sourced viewer BP when `VITE_INDEXER_URL` is set ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
  indexerViewerBattlePoints?: bigint;
  /** Indexer head + wallet guard for display when browser RPC is inactive (#301). */
  indexerWarbowHead?: IndexerWarbowHeroHead;
  plantWarBowFlag?: boolean;
  onPlantWarBowFlagChange?: (checked: boolean) => void;
  plantFlagDisabled?: boolean;
  /** Viewer holds a planted flag — show silence countdown + claim CTA in this card. */
  showClaimFlagControl?: boolean;
  canClaimWarBowFlag?: boolean;
  flagSilenceEndSec?: bigint;
  ledgerNowSec?: number;
  onClaimFlag?: () => void | Promise<void>;
  claimFlagWriting?: boolean;
};

const WARBOW_FLAG_SILENCE_MINUTES = WARBOW_FLAG_SILENCE_SEC / 60;

export type WarbowTarget = {
  address: `0x${string}`;
  battlePoints?: string;
  source: "podium" | "recent";
  rank?: number;
};

type TargetFilter = "eligible" | "podium" | "recent" | "all";
type TargetSort = "bp-desc" | "bp-asc" | "source";

function parseBp(raw: string | undefined): bigint | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function isEligibleTarget(target: WarbowTarget, viewerBattlePoints: string | undefined): boolean {
  const viewer = parseBp(viewerBattlePoints);
  const targetBp = parseBp(target.battlePoints);
  if (viewer === undefined || targetBp === undefined || viewer === 0n) return false;
  return targetBp >= viewer * 2n && targetBp <= viewer * 10n;
}

export function ArenaWarbowHeroPanel({
  phase,
  playerLevel,
  onFeatureHelp,
  onOpenWalletProfile,
  warbowTargets = [],
  indexerViewerBattlePoints,
  indexerWarbowHead,
  plantWarBowFlag = false,
  onPlantWarBowFlagChange,
  plantFlagDisabled = true,
  showClaimFlagControl = false,
  canClaimWarBowFlag = false,
  flagSilenceEndSec = 0n,
  ledgerNowSec,
  onClaimFlag,
  claimFlagWriting = false,
}: Props) {
  const { address } = useAccount();
  const w = useArenaWarbowHero(phase, { indexerViewerBattlePoints, indexerWarbowHead });
  const { pendingRevengeTargets, hasRevengeOpen, revengeIndexerConfigured } =
    useArenaPendingRevengeTargets(address);
  const viewerBattlePointsDisplay = formatWarbowViewerBattlePointsDisplay(
    parseBp(w.viewerBattlePoints),
  );
  const warbowFlagUnlocked =
    playerLevel !== undefined && isFeatureUnlocked(playerLevel, "warbow_flag");
  const showWarbowFlagLevelLock =
    playerLevel !== undefined &&
    shouldShowLevelLock(playerLevel, FEATURE_UNLOCK_LEVEL.warbow_flag);
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("eligible");
  const [targetSort, setTargetSort] = useState<TargetSort>("bp-desc");
  const [subcardHelpTopic, setSubcardHelpTopic] = useState<WarbowHeroSubcardHelpTopic | null>(
    null,
  );
  const targetOptionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selectedTarget = w.stealVictimInput.trim();
  const visibleTargets = useMemo(() => {
    const filtered = warbowTargets.filter((target) => {
      if (sameAddress(target.address, w.stealVictimInput)) return true;
      if (targetFilter === "all") return true;
      if (targetFilter === "podium") return target.source === "podium";
      if (targetFilter === "recent") return target.source === "recent";
      return isEligibleTarget(target, w.viewerBattlePoints);
    });
    return [...filtered].sort((a, b) => {
      if (targetSort === "source") {
        const sourceDelta = (a.source === "podium" ? 0 : 1) - (b.source === "podium" ? 0 : 1);
        if (sourceDelta !== 0) return sourceDelta;
        return (a.rank ?? 99) - (b.rank ?? 99);
      }
      const aBp = parseBp(a.battlePoints);
      const bBp = parseBp(b.battlePoints);
      if (aBp === undefined && bBp === undefined) return (a.rank ?? 99) - (b.rank ?? 99);
      if (aBp === undefined) return 1;
      if (bBp === undefined) return -1;
      if (aBp === bBp) return (a.rank ?? 99) - (b.rank ?? 99);
      return targetSort === "bp-asc" ? (aBp < bBp ? -1 : 1) : (aBp > bBp ? -1 : 1);
    });
  }, [targetFilter, targetSort, warbowTargets, w.stealVictimInput, w.viewerBattlePoints]);

  const selectedTargetIndex = useMemo(() => {
    if (!selectedTarget) return 0;
    const idx = visibleTargets.findIndex((target) => sameAddress(target.address, selectedTarget));
    return idx >= 0 ? idx : 0;
  }, [selectedTarget, visibleTargets]);

  const focusWarbowTargetAt = (index: number) => {
    const target = visibleTargets[index];
    if (!target) return;
    w.setStealVictimInput(target.address);
    targetOptionRefs.current[index]?.focus();
  };

  const onWarbowTargetListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moved = moveWarbowTargetListIndex(
      event.key,
      selectedTargetIndex,
      visibleTargets.length,
    );
    if (!moved) return;
    event.preventDefault();
    focusWarbowTargetAt(moved.index);
  };

  if (!w.ready) return null;

  const stealCost = formatCompactFromRaw(BigInt(w.stealDoubWad), 18, { sigfigs: 4 });
  const guardCost = formatCompactFromRaw(BigInt(w.guardDoubWad), 18, { sigfigs: 4 });
  const bypassCost = formatCompactFromRaw(BigInt(w.bypassDoubWad), 18, { sigfigs: 4 });
  const revengeCost = formatCompactFromRaw(BigInt(w.revengeDoubWad), 18, { sigfigs: 4 });

  const guardRemaining =
    w.chainNowSec !== undefined && w.guardedActive
      ? Math.max(0, Number(BigInt(w.guardUntilSec) - BigInt(Math.floor(w.chainNowSec))))
      : undefined;

  const flagLedgerNowSec = ledgerNowSec ?? w.chainNowSec;
  const flagSilenceRemainingSec =
    showClaimFlagControl && flagLedgerNowSec !== undefined
      ? warbowClaimFlagSilenceRemainingSec(flagLedgerNowSec, flagSilenceEndSec)
      : undefined;

  const subcardHelpCopy = useMemo(() => {
    if (!subcardHelpTopic) return null;
    return warbowHeroSubcardHelpCopy(subcardHelpTopic, {
      stealCostLabel: stealCost,
      guardCostLabel: guardCost,
      bypassCostLabel: bypassCost,
      revengeCostLabel: revengeCost,
      maxStealsPerDay: w.maxStealsPerDay,
    });
  }, [
    subcardHelpTopic,
    stealCost,
    guardCost,
    bypassCost,
    revengeCost,
    w.maxStealsPerDay,
  ]);

  return (
    <ArenaLevelGate
      playerLevel={playerLevel}
      feature="warbow"
      className="warbow-hero-actions-wrap"
      testId="warbow-hero-level-gate"
    >
    <section
      className="warbow-hero-actions"
      aria-label="WarBow hero actions"
      data-testid="warbow-hero-actions"
    >
      {onFeatureHelp ? (
        <button
          type="button"
          className="warbow-hero-card__help warbow-hero-actions__help"
          aria-label="Open WarBow tutorial"
          data-testid="warbow-hero-help"
          onClick={() => onFeatureHelp("warbow")}
        >
          ?
        </button>
      ) : null}

      {!w.isConnected ? <WalletConnectButton /> : null}

      {w.isConnected && (
        <article className="warbow-hero-card warbow-hero-card--viewer-summary" data-testid="warbow-hero-viewer-summary">
          <p className="warbow-hero-viewer-summary__line">
            YOUR BP: <strong>{viewerBattlePointsDisplay}</strong>
          </p>
          <p className="warbow-hero-viewer-summary__line">
            GUARD:{" "}
            <strong>
              {w.guardedActive && guardRemaining !== undefined
                ? formatCountdown(guardRemaining)
                : "INACTIVE"}
            </strong>
          </p>
          {showClaimFlagControl && flagSilenceRemainingSec !== undefined ? (
            <p
              className="warbow-hero-viewer-summary__line"
              data-testid="warbow-hero-viewer-summary-flag"
            >
              FLAG:{" "}
              <strong>
                {canClaimWarBowFlag
                  ? "claim now"
                  : `${formatCountdown(flagSilenceRemainingSec)} until claim`}
              </strong>
            </p>
          ) : null}
        </article>
      )}

      {!w.saleActive && phase !== "loading" && (
        <StatusMessage variant="muted">WarBow actions unlock when Time Arena is live.</StatusMessage>
      )}
      {w.arenaPaused && (
        <StatusMessage variant="muted">
          Time Arena is paused onchain — WarBow DOUB spend is disabled until operators unpause.
        </StatusMessage>
      )}

      <div className="warbow-hero-actions__grid">
        <article className="warbow-hero-card warbow-hero-card--steal">
          <WarbowHeroSubcardHelpButton topic="steal" label="Steal" onOpen={setSubcardHelpTopic} />
          <div className="warbow-hero-card__head">
            <h3>Steal</h3>
            <span className="status-pill status-pill--warning" data-testid="warbow-hero-steal-cost">
              {stealCost} DOUB
            </span>
          </div>
          <div className="warbow-target-toolbar" aria-label="WarBow target filters">
            <label>
              <span>Show</span>
              <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value as TargetFilter)}>
                <option value="eligible">Eligible</option>
                <option value="podium">Podium</option>
                <option value="recent">Recent</option>
                <option value="all">All</option>
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={targetSort} onChange={(event) => setTargetSort(event.target.value as TargetSort)}>
                <option value="bp-desc">BP high</option>
                <option value="bp-asc">BP low</option>
                <option value="source">Source</option>
              </select>
            </label>
          </div>
          {visibleTargets.length > 0 ? (
            <div
              className="warbow-target-list"
              role="listbox"
              aria-label="WarBow steal targets"
              onKeyDown={onWarbowTargetListKeyDown}
            >
              {visibleTargets.map((target, index) => {
                const selected = sameAddress(selectedTarget, target.address);
                const eligible = isEligibleTarget(target, w.viewerBattlePoints);
                const targetBp = parseBp(target.battlePoints);
                const rovingTabIndex = selected || (!selectedTarget && index === 0) ? 0 : -1;
                return (
                  <div
                    key={`${target.source}-${target.address}`}
                    ref={(el) => {
                      targetOptionRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={selected}
                    tabIndex={rovingTabIndex}
                    className={[
                      "warbow-target-row",
                      selected ? "warbow-target-row--selected" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={(event: MouseEvent<HTMLDivElement>) => {
                      if (targetIsInsideAddressAction(event.target)) return;
                      w.setStealVictimInput(target.address);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        w.setStealVictimInput(target.address);
                      }
                    }}
                    data-testid={`warbow-target-${target.address.toLowerCase()}`}
                  >
                    <span className="warbow-target-row__main">
                      <PlayerIdentity
                        address={target.address}
                        tailHexDigits={6}
                        size={18}
                        className="warbow-target-row__identity"
                        onOpenProfile={onOpenWalletProfile}
                      />
                      <span className="warbow-target-row__meta">
                        {target.source === "podium" && target.rank ? `#${target.rank} WarBow` : "Recent buyer"}
                      </span>
                    </span>
                    <span className={eligible ? "warbow-target-row__bp warbow-target-row__bp--eligible" : "warbow-target-row__bp"}>
                      {targetBp !== undefined
                        ? `${formatLocaleInteger(targetBp)} BP`
                        : "BP read on click"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <StatusMessage variant="muted">No indexed WarBow targets yet.</StatusMessage>
          )}
          {w.isConnected && w.saleActive && (
            <ChainMismatchWriteBarrier>
              {w.stealVictimFormatError && (
                <StatusMessage variant="error">{w.stealVictimFormatError}</StatusMessage>
              )}
              <p className="warbow-target-selection">
                Target:{" "}
                <strong>
                  {w.stealVictim ? (
                    <PlayerIdentity
                      address={w.stealVictim}
                      tailHexDigits={6}
                      size={16}
                      onOpenProfile={onOpenWalletProfile}
                    />
                  ) : (
                    "Select a rival"
                  )}
                </strong>
              </p>
              <label className="warbow-hero-actions__checkbox">
                <input
                  type="checkbox"
                  checked={w.stealBypass}
                  onChange={(e) => w.setStealBypass(e.target.checked)}
                  disabled={!w.canPress}
                />{" "}
                Pay {bypassCost} DOUB bypass if victim hit daily cap ({formatLocaleInteger(w.maxStealsPerDay)}/day)
              </label>
              <button
                type="button"
                className="btn-secondary btn-secondary--critical"
                disabled={!w.canPress || !w.stealVictim}
                onClick={() => void w.runWarBowSteal()}
                data-testid="warbow-hero-steal-submit"
              >
                Steal
              </button>
            </ChainMismatchWriteBarrier>
          )}
        </article>

        <article className="warbow-hero-card">
          <WarbowHeroSubcardHelpButton topic="guard" label="Guard" onOpen={setSubcardHelpTopic} />
          <div className="warbow-hero-card__head">
            <h3>Guard</h3>
            <span className="status-pill status-pill--info" data-testid="warbow-hero-guard-cost">
              {guardCost} DOUB
            </span>
          </div>
          <p className="muted">6h shield · 1% incoming drain.</p>
          {w.isConnected && w.saleActive && (
            <ChainMismatchWriteBarrier>
              <button
                type="button"
                className="btn-secondary"
                disabled={!w.canPress}
                onClick={() => void w.runWarBowGuard()}
                data-testid="warbow-hero-guard-submit"
              >
                Activate guard
              </button>
            </ChainMismatchWriteBarrier>
          )}
        </article>

        <article className="warbow-hero-card warbow-hero-card--revenge">
          <WarbowHeroSubcardHelpButton topic="revenge" label="Revenge" onOpen={setSubcardHelpTopic} />
          <div className="warbow-hero-card__head">
            <h3>Revenge</h3>
            <span className="status-pill status-pill--info" data-testid="warbow-hero-revenge-cost">
              {revengeCost} DOUB
            </span>
          </div>
          {!w.isConnected ? (
            <p className="muted">Connect a wallet to see open revenge windows.</p>
          ) : !revengeIndexerConfigured ? (
            <p className="muted">
              Set <span className="mono">VITE_INDEXER_URL</span> for pending revenge windows.
            </p>
          ) : hasRevengeOpen ? (
            <ul className="warbow-hero-revenge-list" data-testid="warbow-hero-revenge-list">
              {pendingRevengeTargets.map((row) => {
                const expirySec = Number(row.expiry_exclusive);
                const nowSec = w.chainNowSec ?? Math.floor(Date.now() / 1000);
                const remainingSec = Math.max(0, expirySec - nowSec);
                return (
                  <li key={`${row.stealer}-${row.steal_seq}`}>
                    <PlayerIdentity
                      address={row.stealer as `0x${string}`}
                      onOpenProfile={onOpenWalletProfile}
                      size={16}
                    />
                    <span className="mono muted" title={formatUnixSecIsoUtc(BigInt(row.expiry_exclusive))}>
                      {formatCountdown(remainingSec)}
                    </span>
                    {w.isConnected && w.saleActive && (
                      <ChainMismatchWriteBarrier>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!w.canPress}
                          onClick={() => void w.runWarBowRevenge(row.stealer as `0x${string}`)}
                          data-testid={`warbow-hero-revenge-${row.stealer.toLowerCase()}`}
                        >
                          Revenge
                        </button>
                      </ChainMismatchWriteBarrier>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No open revenge windows for this wallet.</p>
          )}
          {w.isConnected && w.saleActive && hasRevengeOpen && w.stealVictim && (
            <ChainMismatchWriteBarrier>
              <button
                type="button"
                className="btn-secondary"
                disabled={!w.canPress}
                onClick={() => void w.runWarBowRevenge(w.stealVictim!)}
                data-testid="warbow-hero-revenge-selected-target"
              >
                Revenge selected steal target
              </button>
            </ChainMismatchWriteBarrier>
          )}
        </article>

        <article className="warbow-hero-card warbow-hero-card--claim-flag" title="Flag claim costs 0 DOUB when the silence window is satisfied.">
          <WarbowHeroSubcardHelpButton topic="flag" label="Flag" onOpen={setSubcardHelpTopic} />
          <div className="warbow-hero-card__head">
            <h3>Flag</h3>
            <span className="status-pill status-pill--success" data-testid="warbow-hero-flag-cost">
              0 DOUB
            </span>
          </div>
          <p className="muted">Claim after {WARBOW_FLAG_SILENCE_MINUTES} minutes of silence.</p>
          {showClaimFlagControl && flagSilenceRemainingSec !== undefined && (
            <p className="warbow-hero-flag-silence" data-testid="warbow-hero-flag-silence-countdown">
              {canClaimWarBowFlag ? (
                <>
                  Silence complete — <strong>claim now</strong> before another buy clears your slot.
                </>
              ) : (
                <>
                  Your flag is active. Silence ends in{" "}
                  <strong className="mono">{formatCountdown(flagSilenceRemainingSec)}</strong>
                </>
              )}
            </p>
          )}
          {showClaimFlagControl && flagLedgerNowSec !== undefined && w.isConnected && w.saleActive && (
            <ChainMismatchWriteBarrier>
              <WarbowClaimFlagButton
                canClaimWarBowFlag={canClaimWarBowFlag}
                ledgerNowSec={flagLedgerNowSec}
                flagSilenceEndSec={flagSilenceEndSec}
                saleActive={w.saleActive}
                arenaPaused={w.arenaPaused}
                isConnected={w.isConnected}
                isWriting={claimFlagWriting || w.isWriting}
                onClaim={() => void onClaimFlag?.()}
                testId="warbow-hero-claim-flag-submit"
              />
            </ChainMismatchWriteBarrier>
          )}
          {w.isConnected && w.saleActive ? (
            !warbowFlagUnlocked && showWarbowFlagLevelLock ? (
              <LockedUntilLevel
                requiredLevel={FEATURE_UNLOCK_LEVEL.warbow_flag}
                variant="compact"
                className="warbow-hero-card__plant-flag-gate"
                testId="arena-simple-warbow-flag-gate"
                overlayTestId="arena-simple-warbow-flag-lock"
              >
                <label className="warbow-hero-actions__checkbox">
                  <input type="checkbox" checked={false} disabled data-testid="arena-simple-warbow-flag-toggle" />{" "}
                  Plant Flag on Next Buy
                </label>
              </LockedUntilLevel>
            ) : (
              <ChainMismatchWriteBarrier>
                <label className="warbow-hero-actions__checkbox">
                  <input
                    type="checkbox"
                    checked={plantWarBowFlag}
                    disabled={plantFlagDisabled}
                    onChange={(e) => onPlantWarBowFlagChange?.(e.target.checked)}
                    data-testid="arena-simple-warbow-flag-toggle"
                  />{" "}
                  Plant Flag on Next Buy
                </label>
              </ChainMismatchWriteBarrier>
            )
          ) : null}
        </article>
      </div>

      {w.pvpErr && (
        <StatusMessage variant="error">
          {w.pvpErr}{" "}
          <button type="button" className="btn-secondary" onClick={w.clearPvpErr}>
            dismiss
          </button>
        </StatusMessage>
      )}

      <p className="visually-hidden" aria-hidden="true">
        Onchain costs: steal <AmountDisplay raw={w.stealDoubWad} decimals={18} /> guard{" "}
        <AmountDisplay raw={w.guardDoubWad} decimals={18} /> revenge{" "}
        <AmountDisplay raw={w.revengeDoubWad} decimals={18} />
      </p>
      <WarbowHeroSubcardHelpModal
        copy={subcardHelpCopy}
        onClose={() => setSubcardHelpTopic(null)}
      />
    </section>
    </ArenaLevelGate>
  );
}
