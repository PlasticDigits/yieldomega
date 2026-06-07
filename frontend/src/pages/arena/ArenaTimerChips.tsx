// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { ArenaLevelGate } from "@/components/ArenaLevelGate";
import { fetchArenaTimers } from "@/lib/indexerApi";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { timeArenaReadAbi } from "@/lib/abis";
import type { ArenaFeatureKey } from "@/lib/arenaProgression";
import { formatMmSsCountdown } from "@/pages/arena/formatTimer";

/** Secondary podium timers beside the Last Buy hero (#256). Contract category indices per arena-v2.md. */
const SECONDARY_PODIUM_CHIPS = [
  { label: "Time Booster", contractIndex: 1, feature: "time_booster" as ArenaFeatureKey },
  { label: "Defended Streak", contractIndex: 2, feature: "defended_streak" as ArenaFeatureKey },
  { label: "WarBow", contractIndex: 3, feature: "warbow" as ArenaFeatureKey },
] as const;

type Props = {
  playerLevel?: bigint | number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
};

export function ArenaTimerChips({ playerLevel, onFeatureHelp }: Props) {
  const arena = addresses.timeArena;
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
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [1] },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [2] },
          { address: arena, abi: timeArenaReadAbi, functionName: "podiumDeadline", args: [3] },
        ]
      : [],
    query: { enabled: Boolean(arena) && !indexerOn },
  });

  const data = indexerData ?? (() => {
    if (!rpcRows?.length) return null;
    const podium = SECONDARY_PODIUM_CHIPS.map((_chip, i) => {
      const row = rpcRows[i];
      return row?.status === "success" ? Number(row.result as bigint) : undefined;
    });
    if (podium.every((d) => d === undefined)) return null;
    return {
      block_timestamp_sec: String(Math.floor(Date.now() / 1000)),
      podium_deadlines_sec: podium.map((d) => String(d ?? 0)),
    };
  })();

  const now = data ? Number(data.block_timestamp_sec) : Math.floor(Date.now() / 1000);
  const deadlines = data?.podium_deadlines_sec ?? [];

  return (
    <div className="arena-timer-chips" data-testid="arena-timer-chips" aria-label="Podium timers">
      {SECONDARY_PODIUM_CHIPS.map((chip, i) => {
        const idx = indexerOn ? chip.contractIndex : i;
        const dl = data ? Number(deadlines[idx] ?? 0) : undefined;
        const rem = dl !== undefined ? Math.max(0, dl - now) : undefined;
        const chipEl = (
          <span className="arena-timer-chips__chip" data-testid={`arena-timer-chip-${chip.contractIndex}`}>
            {chip.label}: {rem !== undefined ? formatMmSsCountdown(rem) : "—"}
          </span>
        );
        return (
          <ArenaLevelGate
            key={chip.label}
            playerLevel={playerLevel}
            feature={chip.feature}
            onHelp={onFeatureHelp ? () => onFeatureHelp(chip.feature) : undefined}
            className="arena-timer-chips__gate"
            testId={`arena-timer-chip-gate-${chip.contractIndex}`}
          >
            {chipEl}
          </ArenaLevelGate>
        );
      })}
    </div>
  );
}
