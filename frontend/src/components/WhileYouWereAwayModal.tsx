// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useId, useMemo, useRef } from "react";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { formatElapsedSinceMs } from "@/lib/arenaSessionClose";
import type { ArenaSessionSummary } from "@/lib/indexerApi";
import { walletProfilePodiumLabel } from "@/lib/walletProfileFormat";

type Props = {
  summary: ArenaSessionSummary;
  connectedWallet?: string;
  onDismiss: (suppressForSession?: boolean) => void;
};

function normalizeAddr(addr: string | null | undefined): string | null {
  if (!addr?.trim()) return null;
  const w = addr.trim().toLowerCase();
  if (!w.startsWith("0x") || w.length !== 42) return null;
  if (w === "0x0000000000000000000000000000000000000000") return null;
  return w;
}

export function WhileYouWereAwayModal({ summary, connectedWallet, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const connected = normalizeAddr(connectedWallet);
  const walletSummary = summary.wallet_summary;

  const elapsedLabel = useMemo(
    () => formatElapsedSinceMs(Number(summary.elapsed_ms)),
    [summary.elapsed_ms],
  );

  const walletWins = useMemo(() => {
    if (!connected) return [] as Array<{ podium: string; rank: number; prize: string }>;
    const wins: Array<{ podium: string; rank: number; prize: string }> = [];
    for (const epoch of summary.podium_epochs_ended ?? []) {
      for (const winner of epoch.winners ?? []) {
        if (normalizeAddr(winner.address) === connected) {
          wins.push({
            podium: walletProfilePodiumLabel(epoch.podium),
            rank: winner.rank,
            prize: winner.prize_doub_wad,
          });
        }
      }
    }
    return wins;
  }, [connected, summary.podium_epochs_ended]);

  const rankDelta = walletSummary?.rank_delta ? Number(walletSummary.rank_delta) : null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onDismiss(false);
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onDismiss]);

  return (
    <dialog
      ref={dialogRef}
      className="while-you-were-away-modal"
      data-testid="while-you-were-away-modal"
      aria-labelledby={titleId}
      onClose={() => onDismiss(false)}
    >
      <form method="dialog" className="while-you-were-away-modal__panel">
        <header className="while-you-were-away-modal__header">
          <p className="while-you-were-away-modal__eyebrow">Session recap</p>
          <h2 id={titleId} className="while-you-were-away-modal__title">
            While You Were Away
          </h2>
          <p className="while-you-were-away-modal__elapsed" data-testid="wywa-elapsed">
            Away for {elapsedLabel}
          </p>
        </header>

        <div className="while-you-were-away-modal__content">
          <section className="while-you-were-away-modal__stats" aria-label="Arena activity summary">
            <div className="while-you-were-away-modal__stat">
              <span className="while-you-were-away-modal__stat-label">Buys</span>
              <span className="while-you-were-away-modal__stat-value">{summary.total_buys}</span>
            </div>
            <div className="while-you-were-away-modal__stat">
              <span className="while-you-were-away-modal__stat-label">Podium updates</span>
              <span className="while-you-were-away-modal__stat-value">{summary.podium_updates}</span>
            </div>
            <div className="while-you-were-away-modal__stat">
              <span className="while-you-were-away-modal__stat-label">Unique players</span>
              <span className="while-you-were-away-modal__stat-value">{summary.unique_players}</span>
            </div>
          </section>

          {walletSummary && connected ? (
            <section className="while-you-were-away-modal__wallet" aria-label="Your wallet summary">
              <h3 className="while-you-were-away-modal__section-title">Your wallet</h3>
              <ul className="while-you-were-away-modal__list">
                <li>
                  Buys since last visit: <strong>{walletSummary.buy_count}</strong>
                </li>
                {rankDelta != null && rankDelta !== 0 ? (
                  <li data-testid="wywa-rank-delta">
                    Spend rank {rankDelta > 0 ? "up" : "down"} by{" "}
                    <strong>{Math.abs(rankDelta)}</strong>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {walletWins.length > 0 ? (
            <section
              className="while-you-were-away-modal__congrats"
              data-testid="wywa-congrats"
              aria-label="Podium wins"
            >
              <h3 className="while-you-were-away-modal__section-title">Congratulations!</h3>
              <ul className="while-you-were-away-modal__list">
                {walletWins.map((win) => (
                  <li key={`${win.podium}-${win.rank}`}>
                    #{win.rank} on {win.podium} — <AmountDisplay raw={win.prize} decimals={18} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(summary.podium_epochs_ended?.length ?? 0) > 0 ? (
            <section className="while-you-were-away-modal__epochs" aria-label="Podium epoch endings">
              <h3 className="while-you-were-away-modal__section-title">Podium epochs ended</h3>
              <ul className="while-you-were-away-modal__epoch-list">
                {summary.podium_epochs_ended.map((epoch) => (
                  <li key={`${epoch.podium}-${epoch.epoch}`} className="while-you-were-away-modal__epoch">
                    <div className="while-you-were-away-modal__epoch-head">
                      <strong>{walletProfilePodiumLabel(epoch.podium)}</strong>
                      <span className="while-you-were-away-modal__epoch-label">epoch {epoch.epoch}</span>
                    </div>
                    <ul className="while-you-were-away-modal__winners">
                      {epoch.winners.map((winner) => (
                        <li key={`${epoch.epoch}-${winner.rank}`}>
                          #{winner.rank}{" "}
                          {winner.address ? (
                            <AddressInline address={winner.address} />
                          ) : (
                            "—"
                          )}{" "}
                          · <AmountDisplay raw={winner.prize_doub_wad} decimals={18} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="while-you-were-away-modal__actions">
          <button
            type="button"
            className="btn-ghost while-you-were-away-modal__action"
            onClick={() => onDismiss(true)}
          >
            Don&apos;t show again
          </button>
          <button type="submit" className="btn-primary while-you-were-away-modal__action">
            Back to play
          </button>
        </footer>
      </form>
    </dialog>
  );
}
