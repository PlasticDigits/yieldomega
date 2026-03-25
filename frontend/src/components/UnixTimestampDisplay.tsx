// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import { abbreviateDecimalString, formatUnixSec } from "@/lib/formatAmount";

export function UnixTimestampDisplay({ raw }: { raw: bigint }) {
  const secStr = formatUnits(raw, 0);
  const abbrev = abbreviateDecimalString(secStr);
  return (
    <div className="amount-triple">
      <div className="amount-triple__row">
        <span className="amount-triple__label">raw</span>
        <span className="mono amount-triple__value">{raw.toString()}</span>
      </div>
      <div className="amount-triple__row">
        <span className="amount-triple__label">local</span>
        <span className="amount-triple__value">{formatUnixSec(raw)}</span>
      </div>
      <div className="amount-triple__row">
        <span className="amount-triple__label">abbr</span>
        <span className="amount-triple__value">{abbrev}</span>
      </div>
    </div>
  );
}
