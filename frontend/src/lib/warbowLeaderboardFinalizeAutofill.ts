// SPDX-License-Identifier: AGPL-3.0-only

import { getAddress, isAddress, type Hex } from "viem";
import type { WarbowLeaderboardItem } from "@/lib/indexerApi";

export const WARBOW_PROTOCOL_TOP_DISPLAY = 5;
export const WARBOW_PROTOCOL_FINALIZE_SLOTS = 3;

export type WarbowLeaderboardRankedRow = {
  rank: number;
  address: Hex;
  battlePoints: bigint;
};

/** Parses indexer leaderboard rows into ranked, checksummed entries (skips malformed rows). */
export function parseWarbowLeaderboardTop(
  items: readonly WarbowLeaderboardItem[],
  displayCount = WARBOW_PROTOCOL_TOP_DISPLAY,
): WarbowLeaderboardRankedRow[] {
  const out: WarbowLeaderboardRankedRow[] = [];
  for (const item of items) {
    if (out.length >= displayCount) {
      break;
    }
    const raw = item.buyer.trim();
    if (!isAddress(raw)) {
      continue;
    }
    let address: Hex;
    try {
      address = getAddress(raw);
    } catch {
      continue;
    }
    out.push({
      rank: out.length + 1,
      address,
      battlePoints: BigInt(item.battle_points_after),
    });
  }
  return out;
}

/** Maps ranked leaderboard rows to the three `finalizeWarbowPodium` address inputs. */
export function warbowFinalizeSlotsFromLeaderboard(
  ranked: readonly WarbowLeaderboardRankedRow[],
): [string, string, string] {
  return [
    ranked[0]?.address ?? "",
    ranked[1]?.address ?? "",
    ranked[2]?.address ?? "",
  ];
}
