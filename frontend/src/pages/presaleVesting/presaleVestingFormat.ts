// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";

export function formatDoubHuman(wei: bigint): string {
  const s = formatUnits(wei, 18);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

export function dualWallClockLines(unixSec: bigint): { local: string; utc: string } {
  const d = new Date(Number(unixSec) * 1000);
  return {
    local: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" }),
    utc: d.toUTCString(),
  };
}
