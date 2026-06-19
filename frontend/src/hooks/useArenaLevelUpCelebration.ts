// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from "react";
import { type ArenaFeatureKey } from "@/lib/arenaProgression";
import { detectUnseenLevelUpFeature } from "@/lib/arenaLevelUpCelebration";

/** Auto-opens level-up celebration popover when player level crosses L2+ (#335). */
export function useArenaLevelUpCelebration(
  playerLevel: bigint | undefined,
): readonly [ArenaFeatureKey | null, () => void] {
  const [celebrationFeature, setCelebrationFeature] = useState<ArenaFeatureKey | null>(null);
  const prevLevelRef = useRef<number | undefined>(undefined);
  const dismiss = () => setCelebrationFeature(null);

  useEffect(() => {
    if (playerLevel === undefined) {
      return;
    }
    const lvl = Number(playerLevel);
    const prev = prevLevelRef.current;
    prevLevelRef.current = lvl;
    const feature = detectUnseenLevelUpFeature(prev, lvl);
    if (feature) {
      setCelebrationFeature(feature);
    }
  }, [playerLevel]);

  return [celebrationFeature, dismiss] as const;
}
