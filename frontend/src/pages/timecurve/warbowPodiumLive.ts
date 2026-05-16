// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
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

/** Overlay indexed WarBow leaderboard rows with live on-chain `battlePoints` reads. */
export function useWarbowLeaderboardBpOverlay<T extends { buyer: string; battle_points_after: string }>(
  tc: `0x${string}` | undefined,
  items: readonly T[] | null | undefined,
): readonly T[] | null {
  const itemCount = items?.length ?? 0;
  const buyerKey = items?.map((row) => row.buyer.toLowerCase()).join("|") ?? "";

  const contracts = useMemo(() => {
    if (!tc || !items?.length) {
      return [];
    }
    return items.map((row) => ({
      address: tc,
      abi: timeCurveReadAbi,
      functionName: "battlePoints" as const,
      args: [row.buyer as `0x${string}`] as const,
    }));
  }, [tc, buyerKey, itemCount, items]);

  const reads = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: {
      enabled: Boolean(tc) && itemCount > 0,
      refetchInterval: 1000,
    },
  });

  return useMemo(
    () => overlayWarbowLeaderboardBp(items, reads.data as readonly ContractReadRow[] | undefined),
    [items, reads.data],
  );
}
