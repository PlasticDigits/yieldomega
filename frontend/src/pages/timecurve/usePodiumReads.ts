// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import { timeCurveReadAbi } from "@/lib/abis";
import { indexerBaseUrl } from "@/lib/addresses";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { fetchTimecurvePodiums } from "@/lib/indexerApi";
import { reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { PODIUM_CONTRACT_CATEGORY_INDEX } from "./podiumCopy";

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

/** Prefer indexer head cache (~1s RPC poll server-side); fall back to direct reads when `VITE_INDEXER_URL` is unset. */
export function usePodiumReads(tc: `0x${string}` | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());

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
    query: { enabled: Boolean(tc) && !indexerOn },
  });

  if (indexerOn) {
    const raw = indexerQuery.data?.rows ?? [];
    const rows: PodiumReadRow[] = [0, 1, 2, 3].map((i) =>
      asPodiumRow(raw[i]?.winners ?? [], raw[i]?.values ?? []),
    );
    const lastBuyPredictionActive = indexerQuery.data ? !indexerQuery.data.sale_ended : false;

    return {
      data: rows,
      lastBuyPredictionActive,
      isLoading: indexerQuery.isPending,
      isFetching: indexerQuery.isFetching,
      refetch: indexerQuery.refetch,
      source: "indexer" as const,
    };
  }

  const rawData = rpc.data as readonly ContractReadRow[] | undefined;
  const rows: PodiumReadRow[] =
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
    }) ?? [];

  return {
    data: rows,
    lastBuyPredictionActive: false,
    isLoading: rpc.isPending,
    isFetching: rpc.isFetching,
    refetch: rpc.refetch,
    source: "rpc" as const,
  };
}
