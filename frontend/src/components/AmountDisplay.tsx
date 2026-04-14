// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Renders **human-readable** token / fixed-point amounts only.
 *
 * **Policy:** we never show smallest-unit integers (wei / raw WAD) in the UI—only formatted decimal
 * strings and compact abbreviations. Call sites still pass the onchain integer as `raw`; conversion
 * happens here. See `docs/frontend/design.md` (“Amount display”).
 */

import { AmountTripleStack } from "@/components/AmountTripleStack";
import { formatAmountTriple, parseBigIntString } from "@/lib/formatAmount";

export type AmountDisplayProps = {
  /**
   * Amount in the token’s smallest units (wei), base-10 string. Used only for conversion; **not** rendered.
   * (String avoids React dev/profiler `JSON.stringify` on props, which rejects `bigint`.)
   */
  raw: string;
  /** ERC-20 `decimals()` (or 18 for WAD fixed-point). */
  decimals: number;
};

export function AmountDisplay({ raw, decimals }: AmountDisplayProps) {
  const n = parseBigIntString(raw);
  const t = formatAmountTriple(n, decimals);
  return (
    <AmountTripleStack
      rows={[
        { label: "decimal", value: t.decimal, monoValue: true },
        { label: "abbr", value: t.abbrev },
      ]}
    />
  );
}
