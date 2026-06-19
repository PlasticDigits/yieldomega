// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { playGameSfx } from "@/audio/playGameSfx";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaBuyPreviewPolicy } from "@/lib/timeArenaBuyPreview";
import {
  ARENA_BUY_EFFECT_TOAST_INDEXER_WAIT_MS,
  arenaBuyEffectToastId,
  buildArenaBuyEffectToastEntries,
  findViewerBuyAtHead,
  mergeArenaBuyEffectToasts,
  resolveArenaBuyEffectToastLines,
  type ArenaBuyEffectToast,
} from "@/pages/arena/arenaBuyEffectToastLines";

type PendingBuyEffectToast = {
  previewLines: readonly string[];
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
  const fallbackTimeoutRef = useRef<number | null>(null);
  const lastResolvedBuyIdRef = useRef<string | null>(null);

  const clearFallbackTimeout = useCallback(() => {
    if (fallbackTimeoutRef.current !== null) {
      window.clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }, []);

  const pushToastLines = useCallback(
    (lines: readonly string[], playChime: boolean) => {
      if (lines.length === 0) return;
      const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entries = buildArenaBuyEffectToastEntries(lines, batchId);
      if (playChime && !reduceMotion) {
        playGameSfx("charmed_confirm", { gainMul: 0.38 });
      }
      setToasts((current) => mergeArenaBuyEffectToasts(current, entries));
    },
    [reduceMotion],
  );

  const resolvePending = useCallback(
    (lines: readonly string[], indexedBuy?: BuyItem) => {
      if (indexedBuy) {
        const buyId = arenaBuyEffectToastId(indexedBuy);
        if (lastResolvedBuyIdRef.current === buyId) return;
        lastResolvedBuyIdRef.current = buyId;
      }
      pendingRef.current = null;
      clearFallbackTimeout();
      pushToastLines(lines, true);
    },
    [clearFallbackTimeout, pushToastLines],
  );

  const onBuySuccess = useCallback(
    (previewLines: readonly string[]) => {
      pendingRef.current = { previewLines: [...previewLines] };
      clearFallbackTimeout();
      fallbackTimeoutRef.current = window.setTimeout(() => {
        const pending = pendingRef.current;
        if (!pending) return;
        resolvePending(pending.previewLines);
      }, ARENA_BUY_EFFECT_TOAST_INDEXER_WAIT_MS);
    },
    [clearFallbackTimeout, resolvePending],
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
    resolvePending(lines, indexedBuy);
  }, [playerLevel, previewPolicy, recentBuys, resolvePending, walletAddress]);

  useEffect(() => () => clearFallbackTimeout(), [clearFallbackTimeout]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, dismissToast, onBuySuccess };
}
