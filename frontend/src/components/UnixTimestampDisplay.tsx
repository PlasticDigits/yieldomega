// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Renders **human-readable** wall-clock times only.
 *
 * **Policy:** we never show raw unix seconds in the UI—only locale-formatted local time and a UTC
 * ISO-8601 string. The unix instant is passed as `raw` for conversion only. See
 * `docs/frontend/design.md` (“Timestamps”).
 */

import { AmountTripleStack } from "@/components/AmountTripleStack";
import { formatUnixSec, formatUnixSecIsoUtc } from "@/lib/formatAmount";

export type UnixTimestampDisplayProps = {
  /** Unix time in seconds. Used only for conversion; **not** rendered. */
  raw: bigint;
};

export function UnixTimestampDisplay({ raw }: UnixTimestampDisplayProps) {
  return (
    <AmountTripleStack
      rows={[
        { label: "local", value: formatUnixSec(raw) },
        { label: "utc", value: formatUnixSecIsoUtc(raw), monoValue: true },
      ]}
    />
  );
}
