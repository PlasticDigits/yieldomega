// SPDX-License-Identifier: AGPL-3.0-only

import { AddressInline } from "@/components/AddressInline";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import type { WalletFormatShort } from "@/lib/addressFormat";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";
import type { WarbowPreflightNarrative } from "@/lib/timeCurveUx";

export type WarbowStealCandidate = {
  address: `0x${string}`;
  battlePoints: string;
  rank: number;
  source: "contract" | "indexer";
};

type Props = {
  saleActive: boolean;
  saleEnded: boolean;
  isConnected: boolean;
  address: string | undefined;
  formatWallet: WalletFormatShort;
  viewerBattlePoints: string | undefined;
  stealCandidates: WarbowStealCandidate[];
  stealVictim?: string;
  setStealVictimInput: (value: string) => void;
  victimStealsToday: string | undefined;
  victimBattlePoints: string | undefined;
  warbowMaxSteals: number;
  stealBypass: boolean;
  setStealBypass: (value: boolean) => void;
  stealPreflight: WarbowPreflightNarrative;
  warbowPreflightIssue: string | null;
  runWarBowSteal: () => Promise<void>;
  runWarBowGuard: () => Promise<void>;
  runWarBowRevenge: () => Promise<void>;
  guardedActive: boolean;
  guardUntilSec: string;
  hasRevengeOpen: boolean;
  pendingRevengeStealer: `0x${string}` | undefined;
  revengeDeadlineSec: string;
  warbowGuardBurnWad: string;
  warbowBypassBurnWad: string;
  buyFeeRoutingEnabled: boolean | undefined;
  isWriting: boolean;
};

export function WarbowHeroActions({
  saleActive,
  saleEnded,
  isConnected,
  address,
  formatWallet,
  viewerBattlePoints,
  stealCandidates,
  stealVictim,
  setStealVictimInput,
  victimStealsToday,
  victimBattlePoints,
  warbowMaxSteals,
  stealBypass,
  setStealBypass,
  stealPreflight,
  warbowPreflightIssue,
  runWarBowSteal,
  runWarBowGuard,
  runWarBowRevenge,
  guardedActive,
  guardUntilSec,
  hasRevengeOpen,
  pendingRevengeStealer,
  revengeDeadlineSec,
  warbowGuardBurnWad,
  warbowBypassBurnWad,
  buyFeeRoutingEnabled,
  isWriting,
}: Props) {
  const writesPaused = buyFeeRoutingEnabled === false;
  const selectedVictim = stealVictim?.toLowerCase();
  const canPressWarbow = isConnected && saleActive && !writesPaused && !isWriting;
  const guardBurnCl8y = formatCompactFromRaw(BigInt(warbowGuardBurnWad), 18);
  const bypassBurnCl8y = formatCompactFromRaw(BigInt(warbowBypassBurnWad), 18);

  return (
    <section className="warbow-hero-actions" aria-label="WarBow hero actions" data-testid="warbow-hero-actions">
      <div className="warbow-hero-actions__wallet">
        <div>
          <span className="warbow-hero-actions__eyebrow">Wallet context</span>
          {isConnected ? (
            <strong>
              <AddressInline address={address} formatWallet={formatWallet} fallback="Connected wallet" size={16} />
            </strong>
          ) : (
            <strong>Connect before PvP</strong>
          )}
        </div>
        {isConnected ? (
          <span className="status-pill status-pill--info">
            Your BP {viewerBattlePoints !== undefined ? formatLocaleInteger(BigInt(viewerBattlePoints)) : "—"}
          </span>
        ) : (
          <WalletConnectButton />
        )}
      </div>

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
          <div className="warbow-hero-card__head">
            <span className="warbow-hero-actions__eyebrow">Primary PvP</span>
            <h3>Steal</h3>
          </div>
          <p className="muted">
            Pick an indexed rival with enough BP, then the live contract reads check the 2x rule and UTC-day cap before
            signing.
          </p>
          {stealCandidates.length > 0 ? (
            <div className="warbow-hero-candidates" role="list" aria-label="Suggested WarBow steal targets">
              {stealCandidates.map((candidate) => {
                const selected = selectedVictim === candidate.address.toLowerCase();
                return (
                  <button
                    key={`${candidate.source}-${candidate.address}`}
                    type="button"
                    className={
                      selected
                        ? "warbow-hero-candidate warbow-hero-candidate--selected"
                        : "warbow-hero-candidate"
                    }
                    aria-pressed={selected}
                    onClick={() => setStealVictimInput(candidate.address)}
                    disabled={!isConnected || !saleActive}
                    data-testid="warbow-hero-steal-candidate"
                  >
                    <span>
                      #{formatLocaleInteger(candidate.rank)}{" "}
                      <AddressInline address={candidate.address} formatWallet={formatWallet} size={16} />
                    </span>
                    <strong>{formatLocaleInteger(BigInt(candidate.battlePoints))} BP</strong>
                    <small>{candidate.source === "contract" ? "podium read" : "indexed ladder"}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <StatusMessage variant="muted">
              No indexed 2x BP steal target yet. The detailed WarBow section still accepts a manual address.
            </StatusMessage>
          )}
          {stealVictim && (
            <>
              <div className="warbow-hero-actions__mini-stats">
                <span>
                  Victim BP{" "}
                  <strong>{victimBattlePoints !== undefined ? formatLocaleInteger(BigInt(victimBattlePoints)) : "—"}</strong>
                </span>
                <span>
                  Steals today{" "}
                  <strong>
                    {victimStealsToday !== undefined
                      ? `${formatLocaleInteger(BigInt(victimStealsToday))} / ${formatLocaleInteger(warbowMaxSteals)}`
                      : "—"}
                  </strong>
                </span>
              </div>
              <StatusMessage variant={stealPreflight.tone === "error" ? "error" : "muted"}>
                <strong>{stealPreflight.title}</strong> · {warbowPreflightIssue ?? stealPreflight.detail}
              </StatusMessage>
            </>
          )}
          <label className="warbow-hero-actions__checkbox">
            <input
              type="checkbox"
              checked={stealBypass}
              onChange={(e) => setStealBypass(e.target.checked)}
              disabled={!isConnected || !saleActive}
            />{" "}
            Pay bypass burn if this victim already hit the cap (
            {bypassBurnCl8y} CL8Y)
          </label>
          <button
            type="button"
            className="btn-secondary btn-secondary--critical"
            disabled={!canPressWarbow || !stealVictim || stealPreflight.tone === "error"}
            onClick={() => void runWarBowSteal()}
            data-testid="warbow-hero-steal-submit"
          >
            Attempt steal
          </button>
        </article>

        <article className="warbow-hero-card">
          <div className="warbow-hero-card__head">
            <span className="warbow-hero-actions__eyebrow">Defense</span>
            <h3>Guard</h3>
          </div>
          <p className="muted">
            Burn {guardBurnCl8y} CL8Y to make incoming steals drain the guarded
            1% branch.
          </p>
          {guardedActive && (
            <StatusMessage variant="muted">
              Guard active until <UnixTimestampDisplay raw={guardUntilSec} />.
            </StatusMessage>
          )}
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
            <span className="warbow-hero-actions__eyebrow">Counterpunch</span>
            <h3>Revenge</h3>
          </div>
          {hasRevengeOpen && pendingRevengeStealer ? (
            <>
              <p className="muted">
                Pending stealer{" "}
                <AddressInline address={pendingRevengeStealer} formatWallet={formatWallet} size={16} /> · expires{" "}
                <UnixTimestampDisplay raw={revengeDeadlineSec} />.
              </p>
              <button
                type="button"
                className="btn-secondary btn-secondary--priority"
                disabled={!canPressWarbow}
                onClick={() => void runWarBowRevenge()}
                data-testid="warbow-hero-revenge-submit"
              >
                Take revenge
              </button>
            </>
          ) : (
            <StatusMessage variant="muted">
              No revenge slot is open for this wallet. A successful steal against you opens one pending stealer.
            </StatusMessage>
          )}
        </article>
      </div>
    </section>
  );
}
