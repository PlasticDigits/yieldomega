// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  testId: string;
  headline: string;
  needLabel: string;
  haveLabel: string;
  detail?: string;
  actions?: ReactNode;
};

/** Compact action-adjacent gate when the wallet cannot cover the live buy minimum. */
export function ArenaBuyPreviewBlocked({
  testId,
  headline,
  needLabel,
  haveLabel,
  detail,
  actions,
}: Props) {
  return (
    <div
      className="arena-simple__buy-preview arena-simple__buy-preview--blocked"
      data-testid={testId}
      role="note"
      aria-label={detail ?? `${headline}. Need ${needLabel}. Have ${haveLabel}.`}
    >
      <div className="arena-simple__buy-preview-blocked-card">
        <p className="arena-simple__buy-preview-blocked-headline">{headline}</p>
        <p className="arena-simple__buy-preview-blocked-meta">
          <span>
            Need <strong>{needLabel}</strong>
          </span>
          <span className="arena-simple__buy-preview-blocked-sep" aria-hidden="true">
            ·
          </span>
          <span>
            Have <strong>{haveLabel}</strong>
          </span>
        </p>
      </div>
      {actions}
    </div>
  );
}
