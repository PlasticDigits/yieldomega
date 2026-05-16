// SPDX-License-Identifier: AGPL-3.0-only

import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import type { BuyItem } from "@/lib/indexerApi";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Plain-text score line for Simple reserve podium rows (shown under the address).
 * Last Buy uses the first three `recentBuys` rows when buyer order matches the podium slot
 * (same head ordering as indexer last-buy prediction).
 */
export function formatSimplePodiumScoreLine(
  categoryIndex: number,
  placeIndex: number,
  opts: {
    winner: string;
    winnerReady: boolean;
    valueRaw: string;
    nowUnixSec: number;
    recentBuys?: readonly BuyItem[] | null;
  },
): string {
  if (!opts.winnerReady) {
    return "Score: —";
  }
  const w = opts.winner.trim().toLowerCase();
  if (!w || w === ZERO) {
    return "Score: —";
  }

  if (categoryIndex === 0) {
    const b = opts.recentBuys?.[placeIndex];
    if (!b?.block_timestamp?.trim()) {
      return "Score: —";
    }
    if (b.buyer.trim().toLowerCase() !== w) {
      return "Score: —";
    }
    try {
      const t = Number(BigInt(b.block_timestamp.trim()));
      if (!Number.isFinite(t)) {
        return "Score: —";
      }
      const delta = Math.max(0, Math.floor(opts.nowUnixSec) - t);
      return `Score: ${delta.toLocaleString()} seconds ago`;
    } catch {
      return "Score: —";
    }
  }

  let digits = "0";
  try {
    digits = rawToBigIntForFormat(opts.valueRaw || "0").toString();
  } catch {
    digits = "0";
  }

  if (categoryIndex === 1) {
    return `Score: ${digits} Battle Points`;
  }
  if (categoryIndex === 2) {
    return `Score: ${digits} sequential buys`;
  }
  if (categoryIndex === 3) {
    return `Score: ${digits}s added`;
  }
  return "Score: —";
}
