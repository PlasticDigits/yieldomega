// SPDX-License-Identifier: AGPL-3.0-only

import type { BuyItem } from "@/lib/indexerApi";

export type PeerBuyHeadSfxTickResult =
  | { kind: "noop" }
  | { kind: "seed"; nextHeadTx: string }
  | { kind: "newHead"; nextHeadTx: string; play: boolean };

/**
 * Pure transition for indexer “latest buy” head changes → optional SFX (issue #68).
 */
export function peerBuyHeadSfxTick(args: {
  previousHeadTx: string | null;
  head: BuyItem | null | undefined;
  walletAddress: string | undefined;
  reduceMotion: boolean;
}): PeerBuyHeadSfxTickResult {
  if (args.reduceMotion) return { kind: "noop" };
  const head = args.head ?? null;
  if (!head) return { kind: "noop" };
  if (args.previousHeadTx === null) return { kind: "seed", nextHeadTx: head.tx_hash };
  if (args.previousHeadTx === head.tx_hash) return { kind: "noop" };
  const w = args.walletAddress?.trim() ?? "";
  const self = w.length > 0 && head.buyer.toLowerCase() === w.toLowerCase();
  return { kind: "newHead", nextHeadTx: head.tx_hash, play: !self };
}
