// SPDX-License-Identifier: AGPL-3.0-only

import type { BuyItem } from "@/lib/indexerApi";

export type PeerBuyHeadSfxTickResult =
  | { kind: "noop" }
  | { kind: "seed"; nextHeadId: string }
  | { kind: "newHead"; nextHeadId: string; play: boolean };

/** Stable row id for “latest indexed buy” head transitions (tx can carry multiple logs). */
export function peerBuyHeadSfxId(buy: Pick<BuyItem, "tx_hash" | "log_index">): string {
  return `${buy.tx_hash}-${buy.log_index}`;
}

/**
 * Pure transition for indexer “latest buy” head changes → optional SFX (issue #68).
 */
export function peerBuyHeadSfxTick(args: {
  previousHeadId: string | null;
  head: BuyItem | null | undefined;
  walletAddress: string | undefined;
  reduceMotion: boolean;
}): PeerBuyHeadSfxTickResult {
  if (args.reduceMotion) return { kind: "noop" };
  const head = args.head ?? null;
  if (!head) return { kind: "noop" };
  const id = peerBuyHeadSfxId(head);
  if (args.previousHeadId === null) return { kind: "seed", nextHeadId: id };
  if (args.previousHeadId === id) return { kind: "noop" };
  const w = args.walletAddress?.trim() ?? "";
  const self = w.length > 0 && head.buyer.toLowerCase() === w.toLowerCase();
  return { kind: "newHead", nextHeadId: id, play: !self };
}
