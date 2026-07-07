// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { playGameSfx } from "@/audio/playGameSfx";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaBuyPreviewPolicy } from "@/lib/timeArenaBuyPreview";
import { findViewerBuyAtHead } from "@/pages/arena/arenaBuyEffectToastLines";
import {
  arenaBuyShareSummaryId,
  buildArenaBuyShareSummary,
  type ArenaBuyShareSummary,
} from "@/pages/arena/arenaBuyShareSummary";

type PendingBuyShareCard = {
  previewLines: readonly string[];
  batchId: string;
};

type E2eWindow = Window & {
  __yieldomegaE2eBuyResultEnabled?: boolean;
  __yieldomegaE2eShowBuyResult?: (summary: ArenaBuyShareSummary) => void;
};

export function useArenaBuyResultSharePopover(opts: {
  recentBuys: BuyItem[] | null;
  walletAddress: string | undefined;
  previewPolicy?: ArenaBuyPreviewPolicy;
  playerLevel?: bigint | number;
  reduceMotion: boolean;
  /** Level-up celebration or WYWA — defer buy result until inactive (#365). */
  celebrationActive: boolean;
}): {
  card: ArenaBuyShareSummary | null;
  cardId: string | null;
  dismissCard: () => void;
  onBuySuccess: (previewLines: readonly string[]) => void;
} {
  const {
    recentBuys,
    walletAddress,
    previewPolicy,
    playerLevel,
    reduceMotion,
    celebrationActive,
  } = opts;

  const [card, setCard] = useState<ArenaBuyShareSummary | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const pendingRef = useRef<PendingBuyShareCard | null>(null);
  const deferredCardRef = useRef<ArenaBuyShareSummary | null>(null);
  const deferredCardIdRef = useRef<string | null>(null);
  const lastResolvedBuyIdRef = useRef<string | null>(null);

  const showCard = useCallback((summary: ArenaBuyShareSummary, id: string, playChime: boolean) => {
    if (celebrationActive) {
      deferredCardRef.current = summary;
      deferredCardIdRef.current = id;
      return;
    }
    if (playChime && !reduceMotion) {
      playGameSfx("charmed_confirm", { gainMul: 0.38 });
    }
    setCard(summary);
    setCardId(id);
  }, [celebrationActive, reduceMotion]);

  const dismissCard = useCallback(() => {
    setCard(null);
    setCardId(null);
    pendingRef.current = null;
    deferredCardRef.current = null;
    deferredCardIdRef.current = null;
  }, []);

  const onBuySuccess = useCallback(
    (previewLines: readonly string[]) => {
      if (previewLines.length === 0) return;
      const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingRef.current = { previewLines: [...previewLines], batchId };
      lastResolvedBuyIdRef.current = null;
      const summary = buildArenaBuyShareSummary({ previewLines });
      if (!summary) return;
      showCard(summary, arenaBuyShareSummaryId(undefined, batchId), true);
    },
    [showCard],
  );

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !walletAddress) return;
    const indexedBuy = findViewerBuyAtHead(recentBuys, walletAddress);
    if (!indexedBuy) return;
    const buyId = arenaBuyShareSummaryId(indexedBuy, pending.batchId);
    if (lastResolvedBuyIdRef.current === buyId) return;
    const summary = buildArenaBuyShareSummary({
      previewLines: pending.previewLines,
      indexedBuy,
      recentBuys,
      previewPolicy,
      playerLevel,
    });
    if (!summary) return;
    if (celebrationActive) {
      deferredCardRef.current = summary;
      deferredCardIdRef.current = buyId;
    } else {
      setCard(summary);
      setCardId(buyId);
    }
    lastResolvedBuyIdRef.current = buyId;
    pendingRef.current = null;
  }, [celebrationActive, playerLevel, previewPolicy, recentBuys, walletAddress]);

  useEffect(() => {
    if (celebrationActive) {
      if (card) {
        deferredCardRef.current = card;
        deferredCardIdRef.current = cardId;
        setCard(null);
        setCardId(null);
      }
      return;
    }
    if (deferredCardRef.current) {
      setCard(deferredCardRef.current);
      setCardId(deferredCardIdRef.current);
      deferredCardRef.current = null;
      deferredCardIdRef.current = null;
    }
  }, [card, cardId, celebrationActive]);

  useEffect(() => {
    const w = window as E2eWindow;
    if (!w.__yieldomegaE2eBuyResultEnabled && import.meta.env.VITE_E2E_MOCK_WALLET !== "1") {
      return;
    }
    w.__yieldomegaE2eShowBuyResult = (summary) => {
      showCard(summary, `e2e-${Date.now()}`, false);
    };
    return () => {
      delete w.__yieldomegaE2eShowBuyResult;
    };
  }, [showCard]);

  return { card, cardId, dismissCard, onBuySuccess };
}
