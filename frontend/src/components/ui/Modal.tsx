// SPDX-License-Identifier: AGPL-3.0-only

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export type ModalProps = {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  /** Stacking: detail sits above list. */
  layer?: "list" | "detail";
};

export function Modal({ open, title, titleId, onClose, children, layer = "list" }: ModalProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`modal-overlay modal-overlay--${layer}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__head">
          <h2 className="modal-panel__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
