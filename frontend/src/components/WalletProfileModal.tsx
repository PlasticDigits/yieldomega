// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useId, useRef } from "react";
import { explorerAddressUrl } from "@/lib/explorer";
import { indexerBaseUrl } from "@/lib/addresses";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { useWalletProfileBalances } from "@/hooks/useWalletProfileBalances";
import { useWalletStats } from "@/hooks/useWalletStats";
import { AddressInline } from "@/components/AddressInline";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  WalletProfileBalancesSection,
  WalletProfileCurrentScoresSection,
  WalletProfileErrorState,
  WalletProfileLoadingState,
  WalletProfileStatsBody,
} from "@/components/WalletProfileModalSections";

type Props = {
  address: string | null;
  onClose: () => void;
};

export function WalletProfileModal({ address, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const indexerUnset = !indexerBaseUrl();
  const { data, isLoading, isError } = useWalletStats(indexerUnset ? undefined : (address ?? undefined));
  const balances = useWalletProfileBalances(address ?? undefined);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (address) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    }
  }, [address]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el || !address) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [address, onClose]);

  if (!address) return null;

  return (
    <dialog
      ref={dialogRef}
      className="wallet-profile-modal"
      data-testid="wallet-profile-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal-panel wallet-profile-modal__panel" role="document">
        <header className="modal-panel__head wallet-profile-modal__header">
          <h2 id={titleId} className="modal-panel__title">
            Participant profile
          </h2>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>

        <div className="wallet-profile-modal__scroll">
          <div className="wallet-profile-modal__identity">
            <div className="wallet-profile-modal__identity-row">
              <p className="wallet-profile-modal__address">
                <AddressInline address={address} explorer={false} />
              </p>
              <span className="wallet-profile-modal__level-badge" data-testid="wallet-profile-level">
                {isLoading ? (
                  <EmptyDataPlaceholder>…</EmptyDataPlaceholder>
                ) : data?.level ? (
                  <>Lv {formatLocaleInteger(data.level)}</>
                ) : (
                  <EmptyDataPlaceholder>—</EmptyDataPlaceholder>
                )}
              </span>
            </div>
            <p className="wallet-profile-modal__explorer-link">
              <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer noopener">
                View on explorer
              </a>
            </p>
          </div>

          <div className="wallet-profile-modal__sections">
            <WalletProfileBalancesSection balances={balances} />
            <WalletProfileCurrentScoresSection data={data ?? undefined} isLoading={isLoading} />
            {isLoading ? <WalletProfileLoadingState /> : null}
            {!isLoading && (isError || indexerUnset) ? (
              <WalletProfileErrorState indexerUnset={indexerUnset} />
            ) : null}
            {!isLoading && !isError && !indexerUnset && data ? (
              <WalletProfileStatsBody data={data} />
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
