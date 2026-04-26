// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import { playGameSfxPeerBuyThrottled } from "@/audio/playGameSfx";
import { peerBuyHeadSfxTick } from "@/pages/timecurve/peerBuyHeadSfxTick";

/**
 * When the indexer-fed buy list gets a **new** head row (latest tx), play the
 * throttled peer-buy SFX. Skips the viewer's own buys when a wallet address is
 * known. Works without a connected wallet so the live strip still “ticks” for
 * spectators (TimerHero live buys, issue #68).
 */
export function usePeerBuyHeadSfx(opts: {
  recentBuys: BuyItem[] | null;
  walletAddress: string | undefined;
  reduceMotion: boolean;
}): void {
  const { recentBuys, walletAddress, reduceMotion } = opts;
  const lastHeadTx = useRef<string | null>(null);

  useEffect(() => {
    const tick = peerBuyHeadSfxTick({
      previousHeadTx: lastHeadTx.current,
      head: recentBuys?.[0],
      walletAddress,
      reduceMotion,
    });
    if (tick.kind === "noop") return;
    if (tick.kind === "seed") {
      lastHeadTx.current = tick.nextHeadTx;
      return;
    }
    lastHeadTx.current = tick.nextHeadTx;
    if (tick.play) playGameSfxPeerBuyThrottled();
  }, [recentBuys, walletAddress, reduceMotion]);
}
