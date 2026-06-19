// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaBuyPreviewPolicy } from "@/lib/timeArenaBuyPreview";
import {
  buildArenaBuyActualEffectLines,
  buildArenaBuyProjectedEffectLines,
  type BuildArenaBuyProjectedEffectLinesArgs,
} from "@/pages/arena/arenaBuyProjectedEffects";
import { peerBuyHeadSfxId } from "@/pages/arena/peerBuyHeadSfxTick";

export const ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE = 4;
export const ARENA_BUY_EFFECT_TOAST_DISMISS_MS = 4000;
export const ARENA_BUY_EFFECT_TOAST_STAGGER_MS = 80;

export type ArenaBuyEffectToast = {
  id: string;
  line: string;
};

export type ResolveArenaBuyEffectToastLinesArgs = {
  previewLines: readonly string[];
  indexedBuy?: BuyItem | null;
  recentBuys?: readonly BuyItem[] | null;
  previewPolicy?: ArenaBuyPreviewPolicy;
  playerLevel?: bigint | number;
  formatRivalWallet?: (addr: HexAddress) => string;
};

/** Indexer-first effect copy; preview snapshot when the buy row is not indexed yet. */
export function resolveArenaBuyEffectToastLines(
  args: ResolveArenaBuyEffectToastLinesArgs,
): readonly string[] {
  if (args.indexedBuy) {
    return buildArenaBuyActualEffectLines(args.indexedBuy, {
      recentBuys: args.recentBuys,
      previewPolicy: args.previewPolicy,
      playerLevel: args.playerLevel,
      formatRivalWallet: args.formatRivalWallet ?? shortAddress,
    });
  }
  return args.previewLines;
}

/** Latest indexed buy when it belongs to the connected wallet. */
export function findViewerBuyAtHead(
  recentBuys: readonly BuyItem[] | null | undefined,
  walletAddress: string | undefined,
): BuyItem | undefined {
  const head = recentBuys?.[0];
  const wallet = walletAddress?.trim();
  if (!head || !wallet) return undefined;
  if (head.buyer.toLowerCase() !== wallet.toLowerCase()) return undefined;
  return head;
}

export function arenaBuyEffectToastId(buy: Pick<BuyItem, "tx_hash" | "log_index">): string {
  return peerBuyHeadSfxId(buy);
}

export function buildArenaBuyEffectToastEntries(
  lines: readonly string[],
  batchId: string,
): ArenaBuyEffectToast[] {
  return lines.map((line, index) => ({
    id: `${batchId}-${index}`,
    line,
  }));
}

export function mergeArenaBuyEffectToasts(
  current: readonly ArenaBuyEffectToast[],
  incoming: readonly ArenaBuyEffectToast[],
  maxVisible = ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE,
): ArenaBuyEffectToast[] {
  if (incoming.length === 0) return [...current];
  return [...current, ...incoming].slice(-maxVisible);
}

/** Swap a pending preview batch for indexer-confirmed effect lines (#337). */
export function replaceArenaBuyEffectToastBatch(
  current: readonly ArenaBuyEffectToast[],
  batchId: string,
  lines: readonly string[],
  maxVisible = ARENA_BUY_EFFECT_TOAST_MAX_VISIBLE,
): ArenaBuyEffectToast[] {
  const batchPrefix = `${batchId}-`;
  const kept = current.filter((toast) => !toast.id.startsWith(batchPrefix));
  const entries = buildArenaBuyEffectToastEntries(lines, batchId);
  return mergeArenaBuyEffectToasts(kept, entries, maxVisible);
}

export type BuildSimpleProjectedEffectLinesInput = BuildArenaBuyProjectedEffectLinesArgs;

export function buildSimpleProjectedEffectLines(
  args: BuildSimpleProjectedEffectLinesInput,
): readonly string[] {
  return buildArenaBuyProjectedEffectLines(args);
}
