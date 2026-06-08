// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useWatchContractEvent } from "wagmi";
import {
  timeArenaBuyEventAbi,
  timeArenaWarbowBpEventAbi,
} from "@/lib/abis";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchArenaPodiums, type ArenaPodiumApiRow } from "@/lib/indexerApi";
import {
  INDEXER_EVENT_COALESCE_MS,
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";
import { PODIUM_CONTRACT_CATEGORY_INDEX } from "./podiumCopy";

export const ARENA_PODIUMS_QUERY_KEY = ["arena-podiums"] as const;

export type PodiumReadRow = {
  winners: [`0x${string}`, `0x${string}`, `0x${string}`];
  /** Base-10 onchain podium scores as strings (React props JSON-safe). */
  values: readonly [string, string, string];
  /** Head `lastBuyEpoch` (cat 0) or `podiumEpoch[cat]` when indexer provides it ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)). */
  epoch?: string;
};

function asPodiumRow(winnersIn: string[], valuesIn: string[]): PodiumReadRow {
  const pad = (i: number) => {
    const w = (winnersIn[i] ?? "").trim();
    if (!w || w === "0x") {
      return "0x0000000000000000000000000000000000000000" as `0x${string}`;
    }
    return w as `0x${string}`;
  };
  const vpad = (i: number) => valuesIn[i] ?? "0";
  return {
    winners: [pad(0), pad(1), pad(2)],
    values: [vpad(0), vpad(1), vpad(2)] as const,
  };
}

export type PodiumPayoutPreviewRow = { places: readonly [string, string, string] };
export type PodiumPayoutPreview = readonly PodiumPayoutPreviewRow[];

function buildPayoutPreviewFromIndexerRows(
  rows: readonly ArenaPodiumApiRow[],
): PodiumPayoutPreview | null {
  if (rows.length === 0) {
    return null;
  }
  const hasPrizeField = rows.some((row) => row.prize_places_doub_wad !== undefined);
  if (!hasPrizeField) {
    return null;
  }
  const preview: PodiumPayoutPreviewRow[] = [];
  for (const row of rows) {
    const cat = row.category_index;
    const prizes = row.prize_places_doub_wad;
    if (cat === undefined || cat < 0 || cat > 3 || !prizes || prizes.length < 3) {
      continue;
    }
    preview[cat] = { places: [prizes[0]!, prizes[1]!, prizes[2]!] as const };
  }
  for (let cat = 0; cat < 4; cat += 1) {
    if (!preview[cat]) {
      preview[cat] = { places: ["0", "0", "0"] as const };
    }
  }
  return preview;
}

function rowsFromIndexerData(raw: readonly ArenaPodiumApiRow[]): PodiumReadRow[] {
  return [0, 1, 2, 3].map((i) => {
    const row = asPodiumRow(raw[i]?.winners ?? [], raw[i]?.values ?? []);
    const ep = raw[i]?.epoch;
    return ep != null && ep !== "" ? { ...row, epoch: ep } : row;
  });
}

const EMPTY_PODIUM_ROWS: PodiumReadRow[] = PODIUM_CONTRACT_CATEGORY_INDEX.map(() =>
  asPodiumRow([], []),
);

/**
 * Invalidate live reads when WarBow-related Time Arena logs arrive (BP-moving txs, guard activations).
 * Shared by Simple (podium panel + buy feed) and Arena (WarBow leaderboard + battle feed).
 *
 * Disabled under indexer-first policy ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)):
 * indexer polls + coalesced HTTP invalidation cover live WarBow without browser RPC subscriptions.
 */
export function useWarbowBpMovingEventWatch(
  tc: `0x${string}` | undefined,
  onBpMovingEvent: () => void,
) {
  const rpcEventsEnabled = false;

  const handleLogs = useCallback(() => {
    onBpMovingEvent();
  }, [onBpMovingEvent]);

  useWatchContractEvent({
    address: tc,
    abi: timeArenaBuyEventAbi,
    eventName: "Buy",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });

  useWatchContractEvent({
    address: tc,
    abi: timeArenaWarbowBpEventAbi,
    eventName: "WarBowSteal",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeArenaWarbowBpEventAbi,
    eventName: "WarBowRevenge",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeArenaWarbowBpEventAbi,
    eventName: "WarBowFlagClaimed",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeArenaWarbowBpEventAbi,
    eventName: "WarBowFlagPenalized",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeArenaWarbowBpEventAbi,
    eventName: "WarBowGuardActivated",
    enabled: rpcEventsEnabled,
    onLogs: handleLogs,
  });
}

/** Simple page: refresh buy feed + invalidate indexer podium query on every BP-moving event. */
export function useWarbowPodiumLiveInvalidation(
  tc: `0x${string}` | undefined,
  queryClient: QueryClient,
  setBuyFeedRefreshNonce: Dispatch<SetStateAction<number>>,
) {
  const lastCoalesceWallMsRef = useRef(0);
  const onBpMovingEvent = useCallback(() => {
    const now = Date.now();
    if (now - lastCoalesceWallMsRef.current < INDEXER_EVENT_COALESCE_MS) {
      return;
    }
    lastCoalesceWallMsRef.current = now;
    setBuyFeedRefreshNonce((n) => n + 1);
    if (indexerBaseUrl()) {
      void queryClient.invalidateQueries({ queryKey: ARENA_PODIUMS_QUERY_KEY });
    }
  }, [queryClient, setBuyFeedRefreshNonce]);

  useWarbowBpMovingEventWatch(tc, onBpMovingEvent);
}

/** Indexer-only podium head reads — no browser RPC mirror ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
export function usePodiumReads(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());

  const indexerQuery = useQuery({
    queryKey: ARENA_PODIUMS_QUERY_KEY,
    queryFn: async () => {
      const body = await fetchArenaPodiums();
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    enabled: indexerOn && Boolean(tc),
    staleTime: 0,
    refetchInterval: () => getIndexerBackoffPollMs(1000),
    placeholderData: (previousData) => previousData,
  });

  const rows: PodiumReadRow[] = useMemo(() => {
    if (!indexerOn) {
      return EMPTY_PODIUM_ROWS;
    }
    return rowsFromIndexerData(indexerQuery.data?.rows ?? []);
  }, [indexerOn, indexerQuery.data]);

  const podiumPayoutPreview: PodiumPayoutPreview | null | undefined = useMemo(() => {
    if (!indexerOn) {
      return null;
    }
    if (indexerQuery.isLoading && !indexerQuery.data) {
      return undefined;
    }
    return buildPayoutPreviewFromIndexerRows(indexerQuery.data?.rows ?? []);
  }, [indexerOn, indexerQuery.data, indexerQuery.isLoading]);

  if (indexerOn) {
    return {
      data: rows,
      podiumPayoutPreview,
      isLoading: indexerQuery.isLoading,
      isFetching: indexerQuery.isFetching,
      refetch: indexerQuery.refetch,
      source: "indexer" as const,
    };
  }

  return {
    data: rows,
    podiumPayoutPreview: null,
    isLoading: false,
    isFetching: false,
    refetch: async () => undefined,
    source: "unavailable" as const,
  };
}
