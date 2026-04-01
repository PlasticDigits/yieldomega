// SPDX-License-Identifier: AGPL-3.0-only

import { formatAmountTriple, parseBigIntString, type AmountTriple } from "@/lib/formatAmount";

export type AmountDisplayProps = {
  /** Integer amount in smallest units (wei). */
  raw: bigint | string;
  /** ERC-20 `decimals()` (or 18 for WAD fixed-point). */
  decimals: number;
};

function triple(raw: bigint, decimals: number): AmountTriple {
  return formatAmountTriple(raw, decimals);
}

export function AmountDisplay({ raw, decimals }: AmountDisplayProps) {
  const n = typeof raw === "string" ? parseBigIntString(raw) : raw;
  const t = triple(n, decimals);
  return (
    <span className="amount-triple">
      <span className="amount-triple__row">
        <span className="amount-triple__label">raw</span>
        <span className="mono amount-triple__value">{t.raw}</span>
      </span>
      <span className="amount-triple__row">
        <span className="amount-triple__label">decimal</span>
        <span className="amount-triple__value">{t.decimal}</span>
      </span>
      <span className="amount-triple__row">
        <span className="amount-triple__label">abbr</span>
        <span className="amount-triple__value">{t.abbrev}</span>
      </span>
    </span>
  );
}
