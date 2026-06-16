// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Renders **human-readable** wall-clock times only.
 *
 * **Policy:** we never show raw unix seconds in the UI—only locale-formatted local time and a
 * human-readable UTC line. The unix instant is passed as `raw` for conversion only. ISO-8601 is
 * kept on the UTC row `title` for copy/paste. See `docs/frontend/design.md` (“Timestamps”).
 */

import { AmountTripleStack } from "@/components/AmountTripleStack";
import { formatUnixSec, formatUnixSecIsoUtc, formatUnixSecUtcDisplay } from "@/lib/formatAmount";

export type UnixTimestampDisplayProps = {
  /** Unix time in seconds (base-10 string). Used only for conversion; **not** rendered. */
  raw: string;
  /** Tighter two-line layout for stat cards and dense protocol surfaces. */
  compact?: boolean;
};

export function UnixTimestampDisplay({ raw, compact = false }: UnixTimestampDisplayProps) {
  const sec = BigInt(raw);
  const isoUtc = formatUnixSecIsoUtc(sec);
  const utcDisplay = formatUnixSecUtcDisplay(sec);

  return (
    <AmountTripleStack
      className={compact ? "unix-timestamp--compact" : undefined}
      rows={[
        { label: compact ? undefined : "local", value: formatUnixSec(sec) },
        {
          label: compact ? undefined : "utc",
          value: (
            <span title={isoUtc === "—" ? undefined : isoUtc}>{utcDisplay}</span>
          ),
        },
      ]}
    />
  );
}
