// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useWalletStats } from "@/hooks/useWalletStats";
import { indexerBaseUrl } from "@/lib/addresses";
import { clampPlayerLevel } from "@/lib/arenaProgression";
import { normalizeXpProgress } from "@/lib/arenaXpMath";

/** Indexer-first buyer level for XP hero and lock gates (#301). */
export function useArenaPlayerLevel(address: string | undefined) {
  const indexerOn = Boolean(indexerBaseUrl());
  const { data: stats, isLoading, isFetching } = useWalletStats(address);

  const level = useMemo(() => {
    if (!stats) return 1;
    const indexedLevel = BigInt(stats.level || "1");
    const toward = BigInt(stats.xp_toward_next ?? "0");
    const { level: normalized } = normalizeXpProgress(indexedLevel, toward);
    return clampPlayerLevel(normalized);
  }, [stats]);

  return {
    level,
    levelBigint: BigInt(level),
    stats,
    isLoading: indexerOn && (isLoading || isFetching) && !stats,
    indexerOn,
  };
}
