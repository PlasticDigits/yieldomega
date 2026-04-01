// SPDX-License-Identifier: AGPL-3.0-only

import { AmountTripleStack } from "@/components/AmountTripleStack";
import { formatAmountTriple, parseBigIntString } from "@/lib/formatAmount";

export type AmountDisplayProps = {
  /** Integer amount in smallest units (wei). */
  raw: bigint | string;
  /** ERC-20 `decimals()` (or 18 for WAD fixed-point). */
  decimals: number;
};

export function AmountDisplay({ raw, decimals }: AmountDisplayProps) {
  const n = typeof raw === "string" ? parseBigIntString(raw) : raw;
  const t = formatAmountTriple(n, decimals);
  return (
    <AmountTripleStack
      rows={[
        { label: "raw", value: t.raw, monoValue: true },
        { label: "decimal", value: t.decimal },
        { label: "abbr", value: t.abbrev },
      ]}
    />
  );
}
