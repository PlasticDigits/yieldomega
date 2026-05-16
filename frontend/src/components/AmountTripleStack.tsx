// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

export type AmountTripleStackRow = {
  /** Omitted or empty: no label cell (primary formatted line often needs no tag). */
  label?: string;
  value: ReactNode;
  /** When true, value cell uses mono styling (long decimal strings, hashes, etc.). */
  monoValue?: boolean;
};

type AmountTripleStackProps = {
  rows: readonly AmountTripleStackRow[];
};

/** Label/value rows using only `span` so the block is valid inside `<p>` (see GitLab #9). */
export function AmountTripleStack({ rows }: AmountTripleStackProps) {
  return (
    <span className="amount-triple">
      {rows.map((row, i) => (
        <span key={row.label?.trim() ? row.label : `row-${i}`} className="amount-triple__row">
          {row.label?.trim() ? <span className="amount-triple__label">{row.label}</span> : null}
          <span className={row.monoValue ? "mono amount-triple__value" : "amount-triple__value"}>
            {row.value}
          </span>
        </span>
      ))}
    </span>
  );
}
