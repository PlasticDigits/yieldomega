// SPDX-License-Identifier: AGPL-3.0-only

import type { PodiumReadRow } from "./usePodiumReads";

/** WarBow podium row uses indexer `WARBOW_BP_OBSERVATIONS_UNION` values as-is ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)). */
export function overlayWarbowPodiumBpValues(
  rows: readonly PodiumReadRow[],
  _bpReads?: unknown,
): readonly PodiumReadRow[] {
  return rows;
}

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

/** @deprecated Indexer-primary display — kept for unit tests of merge helper semantics. */
export function overlayWarbowLeaderboardBp<T extends { buyer: string; battle_points_after: string }>(
  items: readonly T[] | null | undefined,
  bpReads: readonly ContractReadRow[] | undefined,
): readonly T[] | null {
  if (!items?.length || !bpReads || bpReads.length !== items.length) {
    return items ?? null;
  }
  const merged: T[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const read = bpReads[i];
    if (read?.status !== "success" || typeof read.result !== "bigint") {
      return items;
    }
    merged.push({ ...items[i], battle_points_after: read.result.toString() });
  }
  return merged;
}

/** Merge helper retained for tests; production uses indexer leaderboard BP directly ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)). */
export function mergeWarbowLeaderboardBpFromSortedReads<
  T extends { buyer: string; battle_points_after: string },
>(items: readonly T[], bpReads: readonly ContractReadRow[] | undefined): readonly T[] {
  if (!items.length || !bpReads?.length) {
    return items;
  }
  const sorted = [...items].sort((a, b) => a.buyer.toLowerCase().localeCompare(b.buyer.toLowerCase()));
  if (bpReads.length !== sorted.length) {
    return items;
  }
  const byBuyer = new Map<string, bigint>();
  for (let i = 0; i < sorted.length; i += 1) {
    const read = bpReads[i];
    if (read?.status !== "success" || typeof read.result !== "bigint") {
      return items;
    }
    byBuyer.set(sorted[i]!.buyer.toLowerCase(), read.result);
  }
  return items.map((row) => {
    const bp = byBuyer.get(row.buyer.toLowerCase());
    return bp === undefined ? row : { ...row, battle_points_after: bp.toString() };
  });
}
