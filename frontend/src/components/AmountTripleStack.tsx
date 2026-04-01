// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

export type AmountTripleStackRow = {
  label: string;
  value: ReactNode;
  /** When true, value cell uses mono styling (raw wei, etc.). */
  monoValue?: boolean;
};

type AmountTripleStackProps = {
  rows: readonly AmountTripleStackRow[];
};

/** Raw / human / abbrev rows using only `span` so the block is valid inside `<p>` (see issue #9). */
export function AmountTripleStack({ rows }: AmountTripleStackProps) {
  return (
    <span className="amount-triple">
      {rows.map((row) => (
        <span key={row.label} className="amount-triple__row">
          <span className="amount-triple__label">{row.label}</span>
          <span className={row.monoValue ? "mono amount-triple__value" : "amount-triple__value"}>
            {row.value}
          </span>
        </span>
      ))}
    </span>
  );
}
