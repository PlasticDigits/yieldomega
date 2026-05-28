// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import { explorerAddressUrl } from "@/lib/explorer";
import { useWalletStats } from "@/hooks/useWalletStats";
import { AddressInline } from "@/components/AddressInline";

type Props = {
  address: string | null;
  onClose: () => void;
};

export function WalletProfileModal({ address, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { data, isLoading, isError } = useWalletStats(address ?? undefined);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (address) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [address]);

  if (!address) return null;

  return (
    <dialog
      ref={dialogRef}
      className="wallet-profile-modal"
      data-testid="wallet-profile-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="wallet-profile-modal__panel" role="document">
        <header className="wallet-profile-modal__header">
          <h2>Participant profile</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <p className="wallet-profile-modal__address">
          <AddressInline address={address} explorer={false} />
        </p>
        <p>
          <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer noopener">
            View on explorer
          </a>
        </p>

        {isLoading ? <p aria-live="polite">Loading stats…</p> : null}
        {isError ? <p role="alert">Stats unavailable (indexer offline or empty).</p> : null}

        {data ? (
          <div className="wallet-profile-modal__sections">
            <section>
              <h3>Overview</h3>
              <ul>
                <li>Buys: {data.buy_count}</li>
                <li>DOUB spent: {data.total_spent_doub}</li>
                <li>Level: {data.level}</li>
              </ul>
            </section>
            <section>
              <h3>WarBow</h3>
              <p>Steals: {data.warbow_steals}</p>
            </section>
            <section>
              <h3>CRED</h3>
              <p>Claimed: {data.cred_claimed}</p>
            </section>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
