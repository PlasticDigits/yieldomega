// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { AddressInline } from "@/components/AddressInline";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import type { WalletFormatShort } from "@/lib/addressFormat";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import type { WarbowPendingRevengeItem } from "@/lib/indexerApi";
import type { WarbowPreflightNarrative } from "@/lib/timeCurveUx";
import { formatWarbowViewerBattlePointsDisplay } from "@/pages/timeCurveArena/arenaPageHelpers";
import { formatCountdown } from "@/pages/timecurve/formatTimer";

export type WarbowStealCandidate = {
  address: `0x${string}`;
  battlePoints: string;
  rank: number;
  source: "contract" | "indexer";
};

export type WarbowStealHeroRow = {
  candidate: WarbowStealCandidate;
  preflight: WarbowPreflightNarrative;
  victimAtDailyCap: boolean;
  /** Victim `stealsReceivedOnDay` when the per-candidate read is present. */
  victimStealsReceivedToday: bigint | undefined;
  maxStealsPerDay: bigint;
  /** Present after `warbowGuardUntil(victim)` read succeeds; drives hero-row guard label. */
  victimGuardedActive?: boolean;
  /** Discovery-only row: victim BP is below 2× yours; STEAL stays disabled in the hero list. */
  bpBelowStealThreshold?: boolean;
};

type Props = {
  saleActive: boolean;
  saleEnded: boolean;
  isConnected: boolean;
  address: string | undefined;
  formatWallet: WalletFormatShort;
  viewerBattlePoints: string | undefined;
  stealHeroRows: WarbowStealHeroRow[];
  attackerAtDailyStealCap: boolean;
  stealBypass: boolean;
  setStealBypass: (value: boolean) => void;
  stealBypassByVictim: Record<string, boolean>;
  setStealBypassForVictim: (victim: `0x${string}`, value: boolean) => void;
  runWarBowSteal: (opts?: { victim?: `0x${string}` }) => Promise<void>;
  runWarBowGuard: () => Promise<void>;
  runWarBowRevenge: (stealer: `0x${string}`) => Promise<void>;
  guardedActive: boolean;
  /** Interpolated chain "now" (sec) — same basis as arena `effectiveLedgerSec` for a smooth guard countdown. */
  guardChainNowSec: number;
  guardUntilSec: string;
  hasRevengeOpen: boolean;
  pendingRevengeTargets: readonly WarbowPendingRevengeItem[];
  revengeIndexerConfigured: boolean;
  revengeDeadlineSec: string;
  warbowGuardBurnWad: string;
  warbowBypassBurnWad: string;
  buyFeeRoutingEnabled: boolean | undefined;
  isWriting: boolean;
  /** Indexer ladder rank (1-based) when this wallet appears in the live overlay list; otherwise `null`. */
  warbowRank: number | null;
  /** `stealsCommittedByAttackerOnDay(viewer, utcDay)` when the read has settled; otherwise loading. */
  viewerStealsToday: bigint | undefined;
  /** Onchain `WARBOW_MAX_STEALS_PER_DAY` (typically 3). */
  warbowMaxStealsPerDay: number;
};

export function WarbowHeroActions({
  saleActive,
  saleEnded,
  isConnected,
  formatWallet,
  viewerBattlePoints: _viewerBattlePoints,
  stealHeroRows,
  attackerAtDailyStealCap,
  stealBypass,
  setStealBypass,
  stealBypassByVictim,
  setStealBypassForVictim,
  runWarBowSteal,
  runWarBowGuard,
  runWarBowRevenge,
  guardedActive,
  guardChainNowSec,
  guardUntilSec,
  hasRevengeOpen,
  pendingRevengeTargets,
  revengeIndexerConfigured,
  revengeDeadlineSec,
  warbowGuardBurnWad,
  warbowBypassBurnWad,
  buyFeeRoutingEnabled,
  isWriting,
  warbowRank,
  viewerStealsToday,
  warbowMaxStealsPerDay,
}: Props) {
  const writesPaused = buyFeeRoutingEnabled === false;
  const canPressWarbow = isConnected && saleActive && !writesPaused && !isWriting;
  const guardBurnCl8y = formatCompactFromRaw(BigInt(warbowGuardBurnWad), 18);
  const bypassBurnCl8y = formatCompactFromRaw(BigInt(warbowBypassBurnWad), 18);

  const viewerBpDisplay = useMemo(() => {
    if (_viewerBattlePoints === undefined || _viewerBattlePoints.trim() === "") {
      return undefined;
    }
    try {
      return BigInt(_viewerBattlePoints.trim());
    } catch {
      return undefined;
    }
  }, [_viewerBattlePoints]);

  const viewerBpSummaryLabel = useMemo(() => {
    if (viewerBpDisplay === undefined) {
      return "—";
    }
    return `${formatWarbowViewerBattlePointsDisplay(viewerBpDisplay)} BP`;
  }, [viewerBpDisplay]);

  const stealsTodayDisplay = useMemo(() => {
    const cap = BigInt(warbowMaxStealsPerDay);
    if (viewerStealsToday === undefined) {
      return `—/${formatLocaleInteger(cap)}`;
    }
    return `${formatLocaleInteger(viewerStealsToday)}/${formatLocaleInteger(cap)}`;
  }, [viewerStealsToday, warbowMaxStealsPerDay]);

  /** Matches onchain `block.timestamp / 86400` — whole seconds until next UTC day boundary. */
  const stealsRefreshCountdownLabel = useMemo(() => {
    const nowFloor = Math.floor(guardChainNowSec);
    if (!Number.isFinite(nowFloor)) {
      return formatCountdown(0);
    }
    const startOfUtcDay = Math.floor(nowFloor / 86_400) * 86_400;
    const endOfUtcDayExclusive = startOfUtcDay + 86_400;
    const remaining = endOfUtcDayExclusive - nowFloor;
    return formatCountdown(remaining);
  }, [guardChainNowSec]);

  const { guardHeadActive, guardHeadLabel } = useMemo(() => {
    const untilBn = BigInt(guardUntilSec);
    if (untilBn <= 0n) {
      return { guardHeadActive: false, guardHeadLabel: "INACTIVE" as const };
    }
    const nowFloor = BigInt(Math.floor(guardChainNowSec));
    if (nowFloor >= untilBn) {
      return { guardHeadActive: false, guardHeadLabel: "INACTIVE" as const };
    }
    const remaining = Number(untilBn - nowFloor);
    return { guardHeadActive: true, guardHeadLabel: formatCountdown(remaining) };
  }, [guardChainNowSec, guardUntilSec]);

  return (
    <section className="warbow-hero-actions" aria-label="WarBow hero actions" data-testid="warbow-hero-actions">
      {!isConnected ? <WalletConnectButton /> : null}

      {isConnected ? (
        <article
          className="warbow-hero-card warbow-hero-card--viewer-summary"
          aria-label="Your WarBow standing"
          data-testid="warbow-hero-viewer-summary"
        >
          <p className="warbow-hero-viewer-summary__line">
            YOUR RANK:{" "}
            <strong>{warbowRank != null ? `#${formatLocaleInteger(warbowRank)}` : "—"}</strong>
          </p>
          <p className="warbow-hero-viewer-summary__line">
            YOUR BP: <strong>{viewerBpSummaryLabel}</strong>
          </p>
          <p className="warbow-hero-viewer-summary__line">
            YOUR STEALS TODAY: <strong>{stealsTodayDisplay}</strong>
          </p>
          <p
            className="warbow-hero-viewer-summary__line"
            aria-live="polite"
            data-testid="warbow-hero-viewer-steals-refresh"
          >
            STEALS REFRESH IN: <strong>{stealsRefreshCountdownLabel}</strong>
          </p>
        </article>
      ) : null}

      {!saleActive && (
        <StatusMessage variant={saleEnded ? "muted" : "placeholder"}>
          {saleEnded
            ? "The live round is over. Steal and guard are closed; only onchain revenge state can remain relevant."
            : "WarBow actions unlock when the sale is live."}
        </StatusMessage>
      )}
      {writesPaused && (
        <StatusMessage variant="muted">
          Sale interactions are paused onchain (buys + WarBow CL8Y) until operators re-enable fee routing.
        </StatusMessage>
      )}

      <div className="warbow-hero-actions__grid">
        <article className="warbow-hero-card warbow-hero-card--steal">
          <div className="warbow-hero-card__lede warbow-hero-card__lede--tight">
            <div className="warbow-hero-card__head">
              <h3>Steal</h3>
            </div>
            <p className="muted">Steal 10% of BP from players with 2x your BP!</p>
            <p className="muted">You can only steal 1% from guarded players</p>
          </div>
          {attackerAtDailyStealCap && (
            <label className="warbow-hero-actions__checkbox">
              <input
                type="checkbox"
                checked={stealBypass}
                onChange={(e) => setStealBypass(e.target.checked)}
                disabled={!isConnected || !saleActive}
              />{" "}
              Pay {bypassBurnCl8y} CL8Y to bypass your wallet&apos;s daily steal cap
            </label>
          )}
          {stealHeroRows.length > 0 ? (
            <div
              className="warbow-hero-candidates warbow-chasing-pack-scroll"
              role="list"
              aria-label="Suggested WarBow steal targets and near-miss prospects"
            >
              {stealHeroRows.map(
                ({
                  candidate,
                  preflight,
                  victimAtDailyCap,
                  victimGuardedActive,
                  victimStealsReceivedToday,
                  maxStealsPerDay,
                  bpBelowStealThreshold = false,
                }) => {
                const victimKey = candidate.address.toLowerCase();
                const rowBypassChecked = stealBypassByVictim[victimKey] ?? false;
                const stealCapBlocked =
                  preflight.tone === "warning" && preflight.title === "Daily steal limit";
                return (
                  <div
                    key={`${candidate.source}-${candidate.address}`}
                    className="warbow-hero-candidate-row"
                    role="listitem"
                    data-testid={
                      bpBelowStealThreshold ? "warbow-hero-steal-prospect" : "warbow-hero-steal-candidate"
                    }
                  >
                    <div className="warbow-hero-candidate-row__top">
                      <div className="warbow-hero-candidate-row__main">
                        <span>
                          #{formatLocaleInteger(candidate.rank)}{" "}
                          <AddressInline
                            address={candidate.address}
                            formatWallet={formatWallet}
                            tailHexDigits={6}
                            size={16}
                          />
                        </span>
                        <strong>{formatLocaleInteger(BigInt(candidate.battlePoints))} BP</strong>
                        {bpBelowStealThreshold ? (
                          <span className="warbow-hero-candidate-row__guard-stack">
                            <span
                              className="warbow-hero-candidate-row__bp-too-low"
                              data-testid="warbow-hero-steal-candidate-bp-too-low"
                            >
                              Too low BP
                            </span>
                            <span
                              className="warbow-hero-candidate-row__guard-steals"
                              data-testid="warbow-hero-steal-candidate-steals-received"
                            >
                              {victimStealsReceivedToday !== undefined
                                ? `${formatLocaleInteger(victimStealsReceivedToday)}/${formatLocaleInteger(maxStealsPerDay)} steals`
                                : `—/${formatLocaleInteger(maxStealsPerDay)} steals`}
                            </span>
                          </span>
                        ) : victimGuardedActive !== undefined ? (
                          <span className="warbow-hero-candidate-row__guard-stack">
                            <span
                              className={
                                victimGuardedActive
                                  ? "warbow-hero-candidate-row__guard-status warbow-hero-candidate-row__guard-status--guarded"
                                  : "warbow-hero-candidate-row__guard-status warbow-hero-candidate-row__guard-status--unguarded"
                              }
                              data-testid="warbow-hero-steal-candidate-guard"
                            >
                              {victimGuardedActive ? "Guarded" : "Unguarded"}
                            </span>
                            <span
                              className="warbow-hero-candidate-row__guard-steals"
                              data-testid="warbow-hero-steal-candidate-steals-received"
                            >
                              {victimStealsReceivedToday !== undefined
                                ? `${formatLocaleInteger(victimStealsReceivedToday)}/${formatLocaleInteger(maxStealsPerDay)} steals`
                                : `—/${formatLocaleInteger(maxStealsPerDay)} steals`}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="warbow-hero-candidate-row__controls">
                        {!bpBelowStealThreshold && victimAtDailyCap && (
                          <label className="warbow-hero-candidate-row__bypass">
                            <input
                              type="checkbox"
                              checked={rowBypassChecked}
                              onChange={(e) => setStealBypassForVictim(candidate.address, e.target.checked)}
                              disabled={!isConnected || !saleActive}
                            />{" "}
                            Pay {bypassBurnCl8y} CL8Y
                          </label>
                        )}
                        <button
                          type="button"
                          className={
                            bpBelowStealThreshold
                              ? "btn-secondary btn-secondary--critical warbow-hero-candidate-row__steal warbow-hero-candidate-row__steal--prospect"
                              : "btn-secondary btn-secondary--critical warbow-hero-candidate-row__steal"
                          }
                          disabled={
                            bpBelowStealThreshold ||
                            !canPressWarbow ||
                            preflight.tone === "error" ||
                            stealCapBlocked
                          }
                          onClick={() =>
                            bpBelowStealThreshold ? undefined : void runWarBowSteal({ victim: candidate.address })
                          }
                          data-testid={`warbow-hero-steal-submit-${victimKey.slice(2, 10)}`}
                        >
                          STEAL
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <StatusMessage variant="muted">
              No indexed 2x BP steal target yet. The detailed WarBow section still accepts a manual address.
            </StatusMessage>
          )}
        </article>

        <article className="warbow-hero-card">
          <div className="warbow-hero-card__head">
            <h3>Guard</h3>
          </div>
          <div className="warbow-hero-card__guard-inline">
            <p className="muted">
              Burn {guardBurnCl8y} CL8Y to reduce incoming steals by 90% for 6
              hours.
            </p>
            <span
              className={
                guardHeadActive
                  ? "status-pill status-pill--info warbow-hero-card__guard-timer"
                  : "status-pill warbow-hero-card__guard-inactive"
              }
              aria-live={guardHeadActive ? "polite" : undefined}
              data-testid="warbow-hero-guard-status"
            >
              {guardHeadLabel}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={!canPressWarbow}
            onClick={() => void runWarBowGuard()}
            data-testid="warbow-hero-guard-submit"
          >
            {guardedActive ? "Extend guard" : "Activate guard"}
          </button>
        </article>

        <article className="warbow-hero-card warbow-hero-card--revenge">
          <div className="warbow-hero-card__head">
            <h3>Revenge</h3>
          </div>
          {hasRevengeOpen ? (
            <>
              <p className="muted">
                You have {pendingRevengeTargets.length} open counter-hit
                {pendingRevengeTargets.length === 1 ? "" : "s"}. Earliest expiry{" "}
                <UnixTimestampDisplay raw={revengeDeadlineSec} />.
              </p>
              <ul className="warbow-hero-revenge-list">
                {pendingRevengeTargets.map((row) => (
                  <li key={`${row.stealer}-${row.expiry_exclusive}`}>
                    <AddressInline address={row.stealer} formatWallet={formatWallet} tailHexDigits={6} size={16} />
                    <span className="muted">
                      {" "}
                      · until <UnixTimestampDisplay raw={row.expiry_exclusive} />
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-secondary--priority"
                      disabled={!canPressWarbow}
                      onClick={() => void runWarBowRevenge(row.stealer as `0x${string}`)}
                      data-testid="warbow-hero-revenge-submit"
                    >
                      Take revenge
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <StatusMessage variant="muted">
              {revengeIndexerConfigured
                ? "No revenge available"
                : "Set VITE_INDEXER_URL to list every pending stealer (per-slot windows; GitLab #135)."}
            </StatusMessage>
          )}
        </article>
      </div>
    </section>
  );
}
