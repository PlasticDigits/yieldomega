// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import {
  playGameSfxPeerBuyThrottled,
  playGameSfxTimerCalmThrottled,
  playGameSfxTimerUrgentThrottled,
} from "@/audio/playGameSfx";
import type { SaleSessionPhase } from "@/pages/timecurve/timeCurveSimplePhase";

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
  const lastHeadTx = useRef<string | null>(null);

  useEffect(() => {
    const head = recentBuys?.[0];
    if (!head || !walletAddress) return;
    if (lastHeadTx.current === null) {
      lastHeadTx.current = head.tx_hash;
      return;
    }
    if (lastHeadTx.current === head.tx_hash) return;
    lastHeadTx.current = head.tx_hash;
    if (head.buyer.toLowerCase() !== walletAddress.toLowerCase()) {
      playGameSfxPeerBuyThrottled();
    }
  }, [recentBuys, walletAddress]);

  useEffect(() => {
    if (reduceMotion || phase !== "saleActive" || saleCountdownSec === undefined) return;
    const r = saleCountdownSec;
    if (r <= 0 || r > ATTENTION_SEC) return;
    if (r <= URGENT_SEC) playGameSfxTimerUrgentThrottled();
    else playGameSfxTimerCalmThrottled();
  }, [saleCountdownSec, phase, reduceMotion]);
}
