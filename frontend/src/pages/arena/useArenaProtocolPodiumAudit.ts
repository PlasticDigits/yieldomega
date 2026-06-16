// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { timeArenaReadAbi } from "@/lib/abis";
import type { ArenaPodiumApiRow, ArenaTimersResponse } from "@/lib/indexerApi";
import {
  PODIUM_CONTRACT_CATEGORY_INDEX,
  PODIUM_LABELS,
} from "@/pages/arena/podiumCopy";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { PodiumReadRow } from "@/pages/arena/usePodiumReads";

export type ProtocolPodiumAuditRow = {
  uxIndex: number;
  label: string;
  contractCategoryIndex: number;
  epoch: string | undefined;
  secondsRemaining: number | undefined;
  timerExtensionSec: number | undefined;
  initialTimerSec: number | undefined;
  timerCapSec: number | undefined;
  participantCount: number | undefined;
  winners: readonly [`0x${string}`, `0x${string}`, `0x${string}`];
  values: readonly [string, string, string];
  prizesCurrent: readonly [string, string, string] | undefined;
  prizesEpochPlus1: readonly [string, string, string] | undefined;
  prizesEpochPlus2: readonly [string, string, string] | undefined;
};

const ZERO_WINNER = "0x0000000000000000000000000000000000000000" as const;

function indexerRowForContractCat(
  rows: readonly ArenaPodiumApiRow[],
  contractCat: number,
): ArenaPodiumApiRow | undefined {
  return rows.find((row) => row.category_index === contractCat);
}

function parseEpochPlus(epoch: string | undefined, delta: number): string | undefined {
  if (epoch == null || epoch === "") {
    return undefined;
  }
  try {
    return (BigInt(epoch) + BigInt(delta)).toString();
  } catch {
    return undefined;
  }
}

/** Indexer head deadlines minus skew-adjusted chain now (matches play-page podium chips). */
export function podiumAuditSecondsRemaining(
  contractCategoryIndex: number,
  timerData: ArenaTimersResponse | undefined,
  chainNowSec: number | undefined,
): number | undefined {
  if (!timerData || chainNowSec === undefined || !Number.isFinite(chainNowSec)) {
    return undefined;
  }
  const deadlineRaw =
    contractCategoryIndex === 0
      ? timerData.last_buy_deadline_sec
      : timerData.podium_deadlines_sec[contractCategoryIndex];
  const deadline = Number(deadlineRaw ?? 0);
  if (!Number.isFinite(deadline)) {
    return undefined;
  }
  return Math.max(0, Math.floor(deadline - chainNowSec));
}

/**
 * Per-podium audit rows for the protocol accordion: on-chain timer params + indexer prizes / leaders.
 */
export function useArenaProtocolPodiumAudit(
  arenaAddress: `0x${string}` | undefined,
  podiumRows: readonly PodiumReadRow[],
  indexerRows: readonly ArenaPodiumApiRow[],
  chainNowSec: number | undefined,
) {
  const { data: timerData } = useArenaTimersQuery(arenaAddress);

  const timerContracts = useMemo(() => {
    if (!arenaAddress) {
      return [];
    }
    const contracts: {
      address: `0x${string}`;
      abi: typeof timeArenaReadAbi;
      functionName: "podiumTimerExtensionSec" | "podiumInitialTimerSec" | "podiumTimerCapSec";
      args: readonly [bigint];
    }[] = [];
    for (let cat = 0; cat < 4; cat += 1) {
      const catArg = BigInt(cat);
      contracts.push(
        {
          address: arenaAddress,
          abi: timeArenaReadAbi,
          functionName: "podiumTimerExtensionSec",
          args: [catArg],
        },
        {
          address: arenaAddress,
          abi: timeArenaReadAbi,
          functionName: "podiumInitialTimerSec",
          args: [catArg],
        },
        {
          address: arenaAddress,
          abi: timeArenaReadAbi,
          functionName: "podiumTimerCapSec",
          args: [catArg],
        },
      );
    }
    return contracts;
  }, [arenaAddress]);

  const { data: timerReads } = useReadContracts({
    contracts: timerContracts,
    query: { enabled: Boolean(arenaAddress) },
  });

  const rows: ProtocolPodiumAuditRow[] = useMemo(() => {
    const readTimerSec = (contractCat: number, slot: 0 | 1 | 2): number | undefined => {
      const idx = contractCat * 3 + slot;
      const row = timerReads?.[idx];
      if (row?.status === "success" && row.result !== undefined) {
        return Number(row.result as bigint);
      }
      return undefined;
    };

    return PODIUM_LABELS.map((label, uxIndex) => {
      const contractCategoryIndex = PODIUM_CONTRACT_CATEGORY_INDEX[uxIndex]!;
      const podiumRow = podiumRows[uxIndex];
      const apiRow = indexerRowForContractCat(indexerRows, contractCategoryIndex);
      const winners = podiumRow?.winners ?? [ZERO_WINNER, ZERO_WINNER, ZERO_WINNER];
      const values = podiumRow?.values ?? (["0", "0", "0"] as const);
      return {
        uxIndex,
        label,
        contractCategoryIndex,
        epoch: podiumRow?.epoch,
        secondsRemaining: podiumAuditSecondsRemaining(
          contractCategoryIndex,
          timerData ?? undefined,
          chainNowSec,
        ),
        timerExtensionSec: readTimerSec(contractCategoryIndex, 0),
        initialTimerSec: readTimerSec(contractCategoryIndex, 1),
        timerCapSec: readTimerSec(contractCategoryIndex, 2),
        participantCount: apiRow?.participant_count,
        winners,
        values,
        prizesCurrent: apiRow?.prize_places_doub_wad,
        prizesEpochPlus1: apiRow?.seed_prize_places_doub_wad,
        prizesEpochPlus2: apiRow?.future_prize_places_doub_wad,
      };
    });
  }, [chainNowSec, indexerRows, podiumRows, timerData, timerReads]);

  return {
    rows,
    epochPlus1Label: (epoch: string | undefined) => parseEpochPlus(epoch, 1),
    epochPlus2Label: (epoch: string | undefined) => parseEpochPlus(epoch, 2),
  };
}
