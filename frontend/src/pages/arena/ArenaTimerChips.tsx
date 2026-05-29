// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { fetchArenaTimers } from "@/lib/indexerApi";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { timeArenaReadAbi } from "@/lib/abis";
import { formatMmSsCountdown } from "@/pages/timecurve/formatTimer";

const LABELS = ["Last Buy", "Time Booster", "Streak", "WarBow"] as const;

export function ArenaTimerChips() {
  const arena = addresses.timeArena ?? addresses.timeCurve;
  const indexerOn = Boolean(indexerBaseUrl());

  const { data: indexerData } = useQuery({
    queryKey: ["arena-timers", indexerBaseUrl()],
    queryFn: fetchArenaTimers,
    enabled: indexerOn,
    refetchInterval: 5_000,
  });

  const { data: rpcRows } = useReadContracts({
    contracts: arena
      ? [
          { address: arena, abi: timeArenaReadAbi, functionName: "deadline" },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [0] },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [1] },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [2] },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [3] },
        ]
      : [],
    query: { enabled: Boolean(arena) && !indexerOn },
  });

  const data = indexerData ?? (() => {
    if (!rpcRows?.[0] || rpcRows[0].status !== "success") return null;
    const lastBuy = Number(rpcRows[0].result as bigint);
    const podium = [1, 2, 3, 4].map((i) =>
      rpcRows[i]?.status === "success" ? Number(rpcRows[i]!.result as bigint) : lastBuy,
    );
    return {
      block_timestamp_sec: String(Math.floor(Date.now() / 1000)),
      last_buy_deadline_sec: String(lastBuy),
      podium_deadlines_sec: podium.map(String),
    };
  })();

  const now = data ? Number(data.block_timestamp_sec) : Math.floor(Date.now() / 1000);
  const deadlines = data?.podium_deadlines_sec ?? [];
  const lastBuy = data?.last_buy_deadline_sec;

  return (
    <div className="arena-timer-chips" data-testid="arena-timer-chips" aria-label="Podium timers">
      {LABELS.map((label, i) => {
        const dl = data
          ? Number(deadlines[i] ?? lastBuy)
          : undefined;
        const rem = dl !== undefined ? Math.max(0, dl - now) : undefined;
        return (
          <span key={label} className="arena-timer-chips__chip">
            {label}: {rem !== undefined ? formatMmSsCountdown(rem) : "—"}
          </span>
        );
      })}
    </div>
  );
}
