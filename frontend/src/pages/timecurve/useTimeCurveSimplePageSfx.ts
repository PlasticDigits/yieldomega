// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import {
  playGameSfxTimerCalmThrottled,
  playGameSfxTimerUrgentThrottled,
} from "@/audio/playGameSfx";
import type { SaleSessionPhase } from "@/pages/timecurve/timeCurveSimplePhase";
import { usePeerBuyHeadSfx } from "@/pages/timecurve/usePeerBuyHeadSfx";

const ATTENTION_SEC = 13 * 60;
const URGENT_SEC = 120;

/**
 * Ambient SFX for the TimeCurve Simple page: peer buys (indexer head) and
 * sparse timer heartbeats in the attention / urgent bands (see
 * `docs/frontend/sound-effects-recommendations.md` §2).
 */
export function useTimeCurveSimplePageSfx(opts: {
  recentBuys: BuyItem[] | null;
  walletAddress: string | undefined;
  saleCountdownSec: number | undefined;
  phase: SaleSessionPhase;
  reduceMotion: boolean;
}): void {
  const { recentBuys, walletAddress, saleCountdownSec, phase, reduceMotion } = opts;

  usePeerBuyHeadSfx({ recentBuys, walletAddress, reduceMotion });

  useEffect(() => {
    if (reduceMotion || phase !== "saleActive" || saleCountdownSec === undefined) return;
    const r = saleCountdownSec;
    if (r <= 0 || r > ATTENTION_SEC) return;
    if (r <= URGENT_SEC) playGameSfxTimerUrgentThrottled();
    else playGameSfxTimerCalmThrottled();
  }, [saleCountdownSec, phase, reduceMotion]);
}
