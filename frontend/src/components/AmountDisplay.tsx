// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Renders **human-readable** token / fixed-point amounts only.
 *
 * **Policy:** we never show smallest-unit integers (wei / raw WAD) in the UI—only compact decimal
 * strings (`k` / `m` / `b` / `t` / `e±`, four significant figures). Call sites still pass the onchain
 * integer as `raw`; conversion happens here. See `docs/frontend/design.md` (“Amount display”).
 */

import { AmountTripleStack } from "@/components/AmountTripleStack";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { parseBigIntString } from "@/lib/formatAmount";

/** Compact `k` / `m` / `b` / `t` / `e±` display for wallet-sized token amounts (aligned with buy-hub derived numerics, GitLab #191). */
const AMOUNT_DISPLAY_COMPACT_SIGFIGS = 4;

export type AmountDisplayProps = {
  /**
   * Amount in the token’s smallest units (wei), base-10 string. Used only for conversion; **not** rendered.
   * (String avoids React dev/profiler `JSON.stringify` on props, which rejects `bigint`.)
   */
  raw: string;
  /** ERC-20 `decimals()` (or 18 for WAD fixed-point). */
  decimals: number;
  /**
   * Optional caption on the same row as the formatted amount (e.g. `YOUR CL8Y:`). Keeps phrasing-safe `<span>`s for `<p>` parents.
   */
  leadingLabel?: string;
  /**
   * When true, the formatted value uses monospace styling. Defaults to true; set false next to `leadingLabel` for sentence-style balances.
   */
  valueMono?: boolean;
};

export function AmountDisplay({ raw, decimals, leadingLabel, valueMono = true }: AmountDisplayProps) {
  const n = parseBigIntString(raw);
  const label = leadingLabel?.trim();
  return (
    <AmountTripleStack
      rows={[
        {
          ...(label ? { label } : {}),
          value: formatCompactFromRaw(n, decimals, { sigfigs: AMOUNT_DISPLAY_COMPACT_SIGFIGS }),
          monoValue: valueMono,
        },
      ]}
    />
  );
}
