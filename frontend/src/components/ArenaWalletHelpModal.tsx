// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import type { WalletCharmCredHelpSection } from "@/pages/arena/walletCharmCredCopy";

type Props = {
  open: boolean;
  title: string;
  sections: readonly WalletCharmCredHelpSection[];
  onClose: () => void;
};

export function ArenaWalletHelpModal({ open, title, sections, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="feature-mechanic-modal"
      data-testid="arena-wallet-help-modal"
      onClose={onClose}
    >
      <form method="dialog" className="feature-mechanic-modal__panel">
        <div className="feature-mechanic-modal__content">
          <h2 className="feature-mechanic-modal__title">{title}</h2>
          {sections.map((section) => (
            <p key={section.heading} className="feature-mechanic-modal__body">
              <strong>{section.heading}</strong> — {section.body}
            </p>
          ))}
        </div>
        <footer className="feature-mechanic-modal__actions">
          <button type="submit" className="btn-secondary feature-mechanic-modal__action">
            Got it
          </button>
        </footer>
      </form>
    </dialog>
  );
}
