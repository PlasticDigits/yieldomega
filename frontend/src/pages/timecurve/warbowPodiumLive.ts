// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useRef } from "react";
import { useReadContracts } from "wagmi";
import { timeCurveReadAbi } from "@/lib/abis";
import type { PodiumReadRow } from "./usePodiumReads";

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

/** Replace WarBow podium BP digits with on-chain `battlePoints(addr)` when all three reads succeed. */
export function overlayWarbowPodiumBpValues(
  rows: readonly PodiumReadRow[],
  bpReads: readonly ContractReadRow[] | undefined,
): readonly PodiumReadRow[] {
  if (rows.length < 2 || !bpReads || bpReads.length !== 3) {
    return rows;
  }

  const overlayValues: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const row = bpReads[i];
    if (row?.status !== "success" || typeof row.result !== "bigint") {
      return rows;
    }
    overlayValues.push(row.result.toString());
  }

  const warbow = rows[1];
  const next = [...rows];
  next[1] = {
    winners: warbow.winners,
    values: [overlayValues[0], overlayValues[1], overlayValues[2]] as const,
  };
  return next;
}

/** Overlay indexed leaderboard BP with on-chain reads when every row has a successful `battlePoints` read. */
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

/**
 * Merge on-chain `battlePoints` into indexer leaderboard rows. `bpReads` must align with
 * `items` sorted by `buyer` (case-insensitive), not the ladder display order — keeps batched
 * reads keyed only by address set so indexer row reorder between polls does not reset wagmi.
 */
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

/** Overlay indexed WarBow leaderboard rows with live on-chain `battlePoints` reads. */
export function useWarbowLeaderboardBpOverlay<T extends { buyer: string; battle_points_after: string }>(
  tc: `0x${string}` | undefined,
  items: readonly T[] | null | undefined,
): readonly T[] | null {
  const itemCount = items?.length ?? 0;
  const buyerReadKey = useMemo(
    () =>
      items?.length
        ? [...items].map((row) => row.buyer.toLowerCase()).sort().join("|")
        : "",
    [items],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const contracts = useMemo(() => {
    if (!tc || !buyerReadKey) {
      return [];
    }
    const cur = itemsRef.current;
    if (!cur?.length) {
      return [];
    }
    const sorted = [...cur].sort((a, b) => a.buyer.toLowerCase().localeCompare(b.buyer.toLowerCase()));
    return sorted.map((row) => ({
      address: tc,
      abi: timeCurveReadAbi,
      functionName: "battlePoints" as const,
      args: [row.buyer as `0x${string}`] as const,
    }));
  }, [tc, buyerReadKey]);

  const reads = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: {
      enabled: Boolean(tc) && itemCount > 0,
      refetchInterval: 1000,
      placeholderData: (previous) => previous,
    },
  });

  return useMemo(() => {
    if (!items?.length) {
      return items ?? null;
    }
    return mergeWarbowLeaderboardBpFromSortedReads(items, reads.data as readonly ContractReadRow[] | undefined);
  }, [items, reads.data]);
}
