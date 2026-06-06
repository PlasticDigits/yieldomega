// SPDX-License-Identifier: AGPL-3.0-only

import { AmountDisplay } from "@/components/AmountDisplay";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { formatMmSsCountdown } from "@/pages/arena/formatTimer";
import type { SaleSessionPhase } from "@/pages/arena/arenaSimplePhase";
import { useArenaWarbowHero } from "@/pages/arena/useArenaWarbowHero";

type Props = {
  phase: SaleSessionPhase;
};

export function ArenaWarbowHeroPanel({ phase }: Props) {
  const w = useArenaWarbowHero(phase);
  if (!w.ready) return null;

  const stealCost = formatCompactFromRaw(BigInt(w.stealDoubWad), 18, { sigfigs: 4 });
  const guardCost = formatCompactFromRaw(BigInt(w.guardDoubWad), 18, { sigfigs: 4 });
  const bypassCost = formatCompactFromRaw(BigInt(w.bypassDoubWad), 18, { sigfigs: 4 });
  const revengeCost = formatCompactFromRaw(BigInt(w.revengeDoubWad), 18, { sigfigs: 4 });

  const guardRemaining =
    w.chainNowSec !== undefined && w.guardedActive
      ? Math.max(0, Number(BigInt(w.guardUntilSec) - BigInt(Math.floor(w.chainNowSec))))
      : undefined;

  return (
    <section
      className="warbow-hero-actions"
      aria-label="WarBow hero actions"
      data-testid="warbow-hero-actions"
    >
      {!w.isConnected ? <WalletConnectButton /> : null}

      {w.isConnected && (
        <article className="warbow-hero-card warbow-hero-card--viewer-summary" data-testid="warbow-hero-viewer-summary">
          <p className="warbow-hero-viewer-summary__line">
            YOUR BP: <strong>{w.viewerBattlePoints ?? "—"}</strong>
          </p>
          <p className="warbow-hero-viewer-summary__line">
            GUARD:{" "}
            <strong>
              {w.guardedActive && guardRemaining !== undefined
                ? formatMmSsCountdown(guardRemaining)
                : "INACTIVE"}
            </strong>
          </p>
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
          <div className="warbow-hero-card__head">
            <h3>Steal</h3>
            <span className="status-pill status-pill--warning" data-testid="warbow-hero-steal-cost">
              {stealCost} DOUB
            </span>
          </div>
          <p className="muted">Drain 10% BP from a victim in the 2×–10× band (1% if guarded).</p>
          {w.isConnected && w.saleActive && (
            <ChainMismatchWriteBarrier>
              <label className="form-label">
                <span>Victim address</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0x…"
                  value={w.stealVictimInput}
                  onChange={(e) => w.setStealVictimInput(e.target.value)}
                  spellCheck={false}
                  data-testid="warbow-hero-steal-victim"
                />
              </label>
              {w.stealVictimFormatError && (
                <StatusMessage variant="error">{w.stealVictimFormatError}</StatusMessage>
              )}
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
                disabled={!w.canPress}
                onClick={() => void w.runWarBowSteal()}
                data-testid="warbow-hero-steal-submit"
              >
                Steal
              </button>
            </ChainMismatchWriteBarrier>
          )}
        </article>

        <article className="warbow-hero-card">
          <div className="warbow-hero-card__head">
            <h3>Guard</h3>
            <span className="status-pill status-pill--info" data-testid="warbow-hero-guard-cost">
              {guardCost} DOUB
            </span>
          </div>
          <p className="muted">6h shield — next steal against you drains 1% instead of 10%.</p>
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
          <div className="warbow-hero-card__head">
            <h3>Revenge</h3>
            <span className="status-pill status-pill--info" data-testid="warbow-hero-revenge-cost">
              {revengeCost} DOUB
            </span>
          </div>
          <p className="muted">
            One-shot counter-steal when indexed revenge windows are open. Enter stealer address:
          </p>
          {w.isConnected && w.saleActive && (
            <ChainMismatchWriteBarrier>
              <button
                type="button"
                className="btn-secondary"
                disabled={!w.canPress || !w.stealVictim}
                onClick={() => w.stealVictim && void w.runWarBowRevenge(w.stealVictim)}
                data-testid="warbow-hero-revenge-submit"
              >
                Revenge stealer
              </button>
            </ChainMismatchWriteBarrier>
          )}
        </article>

        <article className="warbow-hero-card warbow-hero-card--claim-flag" title="Flag claim costs 0 DOUB when the silence window is satisfied.">
          <div className="warbow-hero-card__head">
            <h3>Flag</h3>
            <span className="status-pill status-pill--success" data-testid="warbow-hero-flag-cost">
              0 DOUB
            </span>
          </div>
          <p className="muted">Hold silence, then claim BP.</p>
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
    </section>
  );
}
