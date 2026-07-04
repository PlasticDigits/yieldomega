// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import type { WarbowHeroSubcardHelpCopy } from "@/pages/arena/warbowHeroSubcardHelpCopy";

type Props = {
  copy: WarbowHeroSubcardHelpCopy | null;
  onClose: () => void;
};

export function WarbowHeroSubcardHelpModal({ copy, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (copy) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [copy]);

  if (!copy) return null;

  return (
    <dialog
      ref={dialogRef}
      className="feature-mechanic-modal"
      data-testid="warbow-hero-subcard-help-modal"
      onClose={onClose}
    >
      <form method="dialog" className="feature-mechanic-modal__panel">
        <div className="feature-mechanic-modal__content">
          <h2 className="feature-mechanic-modal__title">{copy.title}</h2>
          {copy.body.map((paragraph) => (
            <p key={paragraph} className="feature-mechanic-modal__body">
              {paragraph}
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
