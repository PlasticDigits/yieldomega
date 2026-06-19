// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { playGameSfx } from "@/audio/playGameSfx";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaBuyPreviewPolicy } from "@/lib/timeArenaBuyPreview";
import {
  arenaBuyEffectToastId,
  buildArenaBuyEffectToastEntries,
  findViewerBuyAtHead,
  mergeArenaBuyEffectToasts,
  replaceArenaBuyEffectToastBatch,
  resolveArenaBuyEffectToastLines,
  type ArenaBuyEffectToast,
} from "@/pages/arena/arenaBuyEffectToastLines";

type PendingBuyEffectToast = {
  previewLines: readonly string[];
  batchId: string;
};

export function useArenaBuyEffectToasts(opts: {
  recentBuys: BuyItem[] | null;
  walletAddress: string | undefined;
  previewPolicy?: ArenaBuyPreviewPolicy;
  playerLevel?: bigint | number;
  reduceMotion: boolean;
}): {
  toasts: ArenaBuyEffectToast[];
  dismissToast: (id: string) => void;
  onBuySuccess: (previewLines: readonly string[]) => void;
} {
  const { recentBuys, walletAddress, previewPolicy, playerLevel, reduceMotion } = opts;
  const [toasts, setToasts] = useState<ArenaBuyEffectToast[]>([]);
  const pendingRef = useRef<PendingBuyEffectToast | null>(null);
  const lastResolvedBuyIdRef = useRef<string | null>(null);

  const pushToastLines = useCallback(
    (lines: readonly string[], batchId: string, playChime: boolean) => {
      if (lines.length === 0) return;
      const entries = buildArenaBuyEffectToastEntries(lines, batchId);
      if (playChime && !reduceMotion) {
        playGameSfx("charmed_confirm", { gainMul: 0.38 });
      }
      setToasts((current) => mergeArenaBuyEffectToasts(current, entries));
    },
    [reduceMotion],
  );

  const replaceToastBatch = useCallback((batchId: string, lines: readonly string[]) => {
    setToasts((current) => replaceArenaBuyEffectToastBatch(current, batchId, lines));
  }, []);

  const onBuySuccess = useCallback(
    (previewLines: readonly string[]) => {
      if (previewLines.length === 0) return;
      const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingRef.current = { previewLines: [...previewLines], batchId };
      pushToastLines(previewLines, batchId, true);
    },
    [pushToastLines],
  );

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !walletAddress) return;
    const indexedBuy = findViewerBuyAtHead(recentBuys, walletAddress);
    if (!indexedBuy) return;
    const buyId = arenaBuyEffectToastId(indexedBuy);
    if (lastResolvedBuyIdRef.current === buyId) return;
    const lines = resolveArenaBuyEffectToastLines({
      previewLines: pending.previewLines,
      indexedBuy,
      recentBuys,
      previewPolicy,
      playerLevel,
    });
    replaceToastBatch(pending.batchId, lines);
    lastResolvedBuyIdRef.current = buyId;
    pendingRef.current = null;
  }, [playerLevel, previewPolicy, recentBuys, replaceToastBatch, walletAddress]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, dismissToast, onBuySuccess };
}
