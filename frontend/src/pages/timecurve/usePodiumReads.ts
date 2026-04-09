// SPDX-License-Identifier: AGPL-3.0-only

import { useReadContracts } from "wagmi";
import { timeCurveReadAbi } from "@/lib/abis";
import { rawToBigIntForFormat } from "@/lib/compactNumberFormat";

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

export type PodiumReadRow = {
  winners: [`0x${string}`, `0x${string}`, `0x${string}`];
  values: readonly [bigint, bigint, bigint];
};

export function usePodiumReads(tc: `0x${string}` | undefined) {
  const contracts = tc
    ? ([
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [0],
        },
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [1],
        },
        {
          address: tc,
          abi: timeCurveReadAbi,
          functionName: "podium" as const,
          args: [2],
        },
      ] as const)
    : [];
  const { data: rawData, isPending } = useReadContracts({
    contracts: contracts as readonly unknown[],
    query: { enabled: Boolean(tc) },
  });
  const data = rawData as readonly ContractReadRow[] | undefined;

  const rows: PodiumReadRow[] =
    data?.map((r) => {
      if (r.status !== "success") {
        return { winners: ["0x0", "0x0", "0x0"] as const, values: [0n, 0n, 0n] as const };
      }
      const result = r.result as readonly [readonly `0x${string}`[], readonly (bigint | string)[]];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const values = result[1];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [
          rawToBigIntForFormat(values[0]),
          rawToBigIntForFormat(values[1]),
          rawToBigIntForFormat(values[2]),
        ] as const,
      };
    }) ?? [];

  return { data: rows, isLoading: isPending };
}
