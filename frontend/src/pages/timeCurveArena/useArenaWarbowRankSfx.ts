// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import {
  shouldPlayWarbowRankStinger,
  WARBOW_RANK_SFX_UNSET,
  type WarbowRankSfxPrior,
} from "@/audio/warbowRankSfxPolicy";
import { playGameSfxWarbowTwangThrottled } from "@/audio/playGameSfx";

/** Sparse `warbow_twang.wav` — indexed‑ladder **top‑3 podium** cues only (`warbowRankSfxPolicy`; mixer‑throttled). */
export function useArenaWarbowRankSfx(params: {
  viewerConnected: boolean;
  saleActive: boolean;
  warbowRank: number | null;
}): void {
  const { viewerConnected, saleActive, warbowRank } = params;
  const priorRef = useRef<WarbowRankSfxPrior>(WARBOW_RANK_SFX_UNSET);

  useEffect(() => {
    if (!viewerConnected || !saleActive) {
      priorRef.current = WARBOW_RANK_SFX_UNSET;
      return;
    }
    const prev = priorRef.current;
    const cur = warbowRank;
    const play = shouldPlayWarbowRankStinger(prev, cur);
    priorRef.current = cur;
    if (play) playGameSfxWarbowTwangThrottled();
  }, [viewerConnected, saleActive, warbowRank]);
}
