// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import { AmountTripleStack } from "@/components/AmountTripleStack";
import { abbreviateDecimalString, formatUnixSec } from "@/lib/formatAmount";

export function UnixTimestampDisplay({ raw }: { raw: bigint }) {
  const secStr = formatUnits(raw, 0);
  const abbrev = abbreviateDecimalString(secStr);
  return (
    <AmountTripleStack
      rows={[
        { label: "raw", value: raw.toString(), monoValue: true },
        { label: "local", value: formatUnixSec(raw) },
        { label: "abbr", value: abbrev },
      ]}
    />
  );
}
