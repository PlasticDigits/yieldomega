// SPDX-License-Identifier: AGPL-3.0-only

import { addresses } from "@/lib/addresses";
import { type ArenaFeatureKey } from "@/lib/arenaProgression";
import type { BuyItem } from "@/lib/indexerApi";
import {
  formatPodiumChipTimerDisplay,
  isPodiumTimerArmed,
  podiumCountdownSec,
} from "@/pages/arena/arenaPodiumTimerDisplay";
import { ArenaPodiumTimerChip } from "@/pages/arena/ArenaPodiumTimerChip";
import { PODIUM_CONTRACT_TO_UX_CATEGORY } from "@/pages/arena/arenaSimplePodiumRanking";
import { useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { PodiumPayoutPreview, PodiumReadRow } from "@/pages/arena/usePodiumReads";

/** All four podium timer chips in command-console side rail order (#256). */
const PODIUM_CHIPS = [
  {
    podiumName: "Last Buy",
    contractIndex: 0,
    categoryIndex: 0,
    feature: "last_buy" as ArenaFeatureKey,
    testId: "arena-last-buy-chip",
    ariaLabel: "Last Buy leaders",
  },
  {
    podiumName: "Time Booster",
    contractIndex: 1,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[1],
    feature: "time_booster" as ArenaFeatureKey,
  },
  {
    podiumName: "Defended Streak",
    contractIndex: 2,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[2],
    feature: "defended_streak" as ArenaFeatureKey,
  },
  {
    podiumName: "WarBow",
    contractIndex: 3,
    categoryIndex: PODIUM_CONTRACT_TO_UX_CATEGORY[3],
    feature: "warbow" as ArenaFeatureKey,
  },
] as const;

type Props = {
  playerLevel?: bigint | number;
  address?: string;
  decimals: number;
  podiumRows: readonly PodiumReadRow[];
  podiumPayoutPreview?: PodiumPayoutPreview | null;
  recentBuys?: readonly BuyItem[] | null;
  activeDefendedStreak?: bigint;
  podiumNowUnixSec?: number;
  onFeatureHelp?: (feature: ArenaFeatureKey) => void;
  onOpenWalletProfile?: (address: string) => void;
};

export function ArenaTimerChips({
  playerLevel,
  address,
  decimals,
  podiumRows,
  podiumPayoutPreview,
  recentBuys = null,
  activeDefendedStreak,
  podiumNowUnixSec,
  onFeatureHelp,
  onOpenWalletProfile,
}: Props) {
  const arena = addresses.timeArena;

  const { data: indexerData } = useArenaTimersQuery(arena ?? undefined);

  const data = indexerData ?? null;
  const now = data ? Number(data.block_timestamp_sec) : Math.floor(Date.now() / 1000);
  const deadlines = data?.podium_deadlines_sec ?? [];
  const armedFlags = data?.podium_timer_armed;

  return PODIUM_CHIPS.map((chip) => {
    const idx = chip.contractIndex;
    const categoryIndex = chip.categoryIndex;
    const podiumRow = podiumRows[categoryIndex];
    const armed = isPodiumTimerArmed(armedFlags, idx);
    const dl = data && armed !== false ? Number(deadlines[idx] ?? 0) : undefined;
    const rem = podiumCountdownSec(armed, dl, data ? now : undefined);

    return (
      <ArenaPodiumTimerChip
        key={chip.podiumName}
        podiumName={chip.podiumName}
        contractIndex={chip.contractIndex}
        categoryIndex={categoryIndex}
        feature={chip.feature}
        playerLevel={playerLevel}
        address={address}
        decimals={decimals}
        podiumRow={podiumRow}
        podiumPayoutPreview={podiumPayoutPreview}
        recentBuys={recentBuys}
        podiumRows={podiumRows}
        activeDefendedStreak={activeDefendedStreak}
        podiumNowUnixSec={podiumNowUnixSec}
        onFeatureHelp={onFeatureHelp}
        onOpenWalletProfile={onOpenWalletProfile}
        countdownRemainingSec={rem}
        countdownDisplay={formatPodiumChipTimerDisplay(armed, rem)}
        showFeatureHelp={chip.contractIndex !== 0}
        testId={"testId" in chip ? chip.testId : undefined}
        ariaLabel={"ariaLabel" in chip ? chip.ariaLabel : undefined}
      />
    );
  });
}
