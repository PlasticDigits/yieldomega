// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useReadContracts, useWatchContractEvent } from "wagmi";
import { zeroAddress } from "viem";
import {
  timeArenaBuyEventAbi,
  timeArenaReadAbi,
  timeArenaWarbowBpEventAbi,
} from "@/lib/abis";
import { indexerBaseUrl } from "@/lib/addresses";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fetchArenaPodiums } from "@/lib/indexerApi";
import {
  INDEXER_EVENT_COALESCE_MS,
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";
import { useRpcBackoffPollInterval, useRpcConnectivity } from "@/hooks/useRpcConnectivity";
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { rpcBackedReadQueryOptions } from "@/lib/rpcReadQueryOptions";
import { PODIUM_CONTRACT_CATEGORY_INDEX } from "./podiumCopy";

export const ARENA_PODIUMS_QUERY_KEY = ["arena-podiums"] as const;

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

export type PodiumReadRow = {
  winners: [`0x${string}`, `0x${string}`, `0x${string}`];
  /** Base-10 onchain podium scores as strings (React props JSON-safe). */
  values: readonly [string, string, string];
};

function asPodiumRow(winnersIn: string[], valuesIn: string[]): PodiumReadRow {
  const pad = (i: number) => {
    const w = (winnersIn[i] ?? "").trim();
    if (!w || w === "0x") {
      return zeroAddress;
    }
    return w as `0x${string}`;
  };
  const vpad = (i: number) => valuesIn[i] ?? "0";
  return {
    winners: [pad(0), pad(1), pad(2)],
    values: [vpad(0), vpad(1), vpad(2)] as const,
  };
}

function rowsFromIndexerData(
  raw: readonly { winners?: string[]; values?: string[] }[],
): PodiumReadRow[] {
  return [0, 1, 2, 3].map((i) => asPodiumRow(raw[i]?.winners ?? [], raw[i]?.values ?? []));
}

function rowsFromRpcData(rawData: readonly ContractReadRow[] | undefined): PodiumReadRow[] {
  return (
    rawData?.map((r) => {
      if (r.status !== "success") {
        return asPodiumRow([], []);
      }
      const result = r.result as readonly [readonly `0x${string}`[], readonly (bigint | string)[]];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const values = result[1];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [
          rawToBigIntForFormat(values[0]).toString(),
          rawToBigIntForFormat(values[1]).toString(),
          rawToBigIntForFormat(values[2]).toString(),
        ] as const,
      };
    }) ?? []
  );
}

/**
 * Invalidate live reads when WarBow-related Time Arena logs arrive (BP-moving txs, guard activations).
 * Shared by Simple (podium panel + buy feed) and Arena (WarBow leaderboard + battle feed).
 *
 * Skipped when **`VITE_INDEXER_URL`** is set (indexer polls + coalesced HTTP refresh cover live WarBow)
 * or when shared RPC health is offline-tier ([#221](https://gitlab.com/PlasticDigits/yieldomega/-/issues/221)).
 */
export function useWarbowBpMovingEventWatch(
  tc: `0x${string}` | undefined,
  onBpMovingEvent: () => void,
) {
  const indexerOn = Boolean(indexerBaseUrl());
  const { isOffline: isRpcOffline } = useRpcConnectivity();
  const rpcEventsEnabled = Boolean(tc) && !indexerOn && !isRpcOffline;

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

/** Prefer indexer head cache (~1s RPC poll server-side); fall back to direct reads when `VITE_INDEXER_URL` is unset. */
export function usePodiumReads(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());
  const { isOffline: isRpcOffline } = useRpcConnectivity();
  const rpcPollMs = useRpcBackoffPollInterval(1000);

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

  const contracts = tc
    ? PODIUM_CONTRACT_CATEGORY_INDEX.map((category) => ({
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "podium" as const,
        args: [category],
      }))
    : [];

  const rpc = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: {
      enabled: Boolean(tc) && !indexerOn,
      ...rpcBackedReadQueryOptions(rpcPollMs, isRpcOffline),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: rpc.isFetched,
    isFetching: rpc.isFetching,
    isError: rpc.isError,
    isSuccess: rpc.isSuccess,
    error: rpc.error,
  });

  const rows: PodiumReadRow[] = useMemo(() => {
    if (indexerOn) {
      return rowsFromIndexerData(
        (indexerQuery.data?.rows ?? []) as readonly {
          winners?: string[];
          values?: string[];
        }[],
      );
    }
    return rowsFromRpcData(rpc.data as readonly ContractReadRow[] | undefined);
  }, [indexerOn, indexerQuery.data, rpc.data]);

  if (indexerOn) {
    return {
      data: rows,
      isLoading: indexerQuery.isLoading,
      isFetching: indexerQuery.isFetching,
      refetch: indexerQuery.refetch,
      source: "indexer" as const,
    };
  }

  return {
    data: rows,
    isLoading: rpc.isLoading,
    isFetching: rpc.isFetching,
    refetch: rpc.refetch,
    source: "rpc" as const,
  };
}
