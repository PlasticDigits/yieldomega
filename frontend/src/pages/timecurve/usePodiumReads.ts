// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useBlock, useReadContracts, useWatchContractEvent } from "wagmi";
import { zeroAddress } from "viem";
import {
  timeCurveBuyEventAbi,
  timeCurveReadAbi,
  timeCurveWarbowBpEventAbi,
} from "@/lib/abis";
import { indexerBaseUrl } from "@/lib/addresses";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fetchTimecurvePodiums } from "@/lib/indexerApi";
import { reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { PODIUM_CONTRACT_CATEGORY_INDEX } from "./podiumCopy";
import { overlayWarbowPodiumBpValues } from "./warbowPodiumLive";

export const TIMECURVE_PODIUMS_QUERY_KEY = ["timecurve-podiums"] as const;

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
 * Invalidate live reads when WarBow-related TimeCurve logs arrive (BP-moving txs, guard activations).
 * Shared by Simple (podium panel + buy feed) and Arena (WarBow leaderboard + battle feed).
 */
export function useWarbowBpMovingEventWatch(
  tc: `0x${string}` | undefined,
  onBpMovingEvent: () => void,
) {
  const handleLogs = useCallback(() => {
    onBpMovingEvent();
  }, [onBpMovingEvent]);

  useWatchContractEvent({
    address: tc,
    abi: timeCurveBuyEventAbi,
    eventName: "Buy",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });

  useWatchContractEvent({
    address: tc,
    abi: timeCurveWarbowBpEventAbi,
    eventName: "WarBowSteal",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeCurveWarbowBpEventAbi,
    eventName: "WarBowRevenge",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeCurveWarbowBpEventAbi,
    eventName: "WarBowFlagClaimed",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeCurveWarbowBpEventAbi,
    eventName: "WarBowFlagPenalized",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });
  useWatchContractEvent({
    address: tc,
    abi: timeCurveWarbowBpEventAbi,
    eventName: "WarBowGuardActivated",
    enabled: Boolean(tc),
    onLogs: handleLogs,
  });
}

/** Simple page: refresh buy feed + invalidate indexer podium query on every BP-moving event. */
export function useWarbowPodiumLiveInvalidation(
  tc: `0x${string}` | undefined,
  queryClient: QueryClient,
  setBuyFeedRefreshNonce: Dispatch<SetStateAction<number>>,
) {
  const onBpMovingEvent = useCallback(() => {
    setBuyFeedRefreshNonce((n) => n + 1);
    if (indexerBaseUrl()) {
      void queryClient.invalidateQueries({ queryKey: TIMECURVE_PODIUMS_QUERY_KEY });
    }
  }, [queryClient, setBuyFeedRefreshNonce]);

  useWarbowBpMovingEventWatch(tc, onBpMovingEvent);
}

/** Prefer indexer head cache (~1s RPC poll server-side); fall back to direct reads when `VITE_INDEXER_URL` is unset. */
export function usePodiumReads(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());
  const { data: latestBlock } = useBlock({ watch: true });

  const indexerQuery = useQuery({
    queryKey: TIMECURVE_PODIUMS_QUERY_KEY,
    queryFn: async () => {
      const body = await fetchTimecurvePodiums();
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    enabled: indexerOn && Boolean(tc),
    staleTime: 0,
    refetchInterval: 1000,
  });

  const contracts = tc
    ? PODIUM_CONTRACT_CATEGORY_INDEX.map((category) => ({
        address: tc,
        abi: timeCurveReadAbi,
        functionName: "podium" as const,
        args: [category],
      }))
    : [];

  const rpc = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: {
      enabled: Boolean(tc) && !indexerOn,
      refetchInterval: 1000,
    },
  });

  const baseRows: PodiumReadRow[] = useMemo(() => {
    if (indexerOn) {
      return rowsFromIndexerData(indexerQuery.data?.rows ?? []);
    }
    return rowsFromRpcData(rpc.data as readonly ContractReadRow[] | undefined);
  }, [indexerOn, indexerQuery.data, rpc.data]);

  const warbowWinners = baseRows[1]?.winners;
  const warbowBpContracts = useMemo(() => {
    if (!tc || !warbowWinners) {
      return [];
    }
    return warbowWinners.map((addr) => ({
      address: tc,
      abi: timeCurveReadAbi,
      functionName: "battlePoints" as const,
      args: [addr] as const,
    }));
  }, [tc, warbowWinners?.[0], warbowWinners?.[1], warbowWinners?.[2]]);

  const warbowBpReads = useReadContracts({
    contracts: warbowBpContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc) && warbowBpContracts.length === 3,
      refetchInterval: 1000,
    },
  });

  const rows = useMemo(
    () =>
      overlayWarbowPodiumBpValues(
        baseRows,
        warbowBpReads.data as readonly ContractReadRow[] | undefined,
      ),
    [baseRows, warbowBpReads.data, latestBlock?.number],
  );

  if (indexerOn) {
    return {
      data: rows,
      isLoading: indexerQuery.isPending,
      isFetching: indexerQuery.isFetching,
      refetch: indexerQuery.refetch,
      source: "indexer" as const,
    };
  }

  return {
    data: rows,
    isLoading: rpc.isPending,
    isFetching: rpc.isFetching,
    refetch: rpc.refetch,
    source: "rpc" as const,
  };
}
