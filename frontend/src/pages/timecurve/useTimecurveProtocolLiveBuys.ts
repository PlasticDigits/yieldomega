// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchTimecurveBuys, type BuyItem } from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { mergeBuysNewestFirst } from "@/pages/timeCurveArena/arenaPageHelpers";

/**
 * Indexer-backed recent buys for read-only surfaces (e.g. protocol / audit view).
 * Mirrors the Arena poll + pagination merge semantics without pulling in the full arena model.
 */
export function useTimecurveProtocolLiveBuys() {
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [buysNextOffset, setBuysNextOffset] = useState<number | null>(null);
  const [loadingMoreBuys, setLoadingMoreBuys] = useState(false);
  const [hasExpandedBuyPages, setHasExpandedBuyPages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let requestSeq = 0;
    let timeoutId = 0;

    const loadBuys = async () => {
      const id = ++requestSeq;
      const data = await fetchTimecurveBuys(25, 0);
      if (cancelled || id !== requestSeq) {
        return;
      }
      const ok = data != null;
      if (indexerBaseUrl()) {
        reportIndexerFetchAttempt(ok);
      }
      if (!data) {
        setIndexerNote(
          indexerBaseUrl()
            ? "Could not load buys from the indexer (offline, CORS, or HTTP error). Check the indexer is running."
            : "Set VITE_INDEXER_URL to load recent buys from the indexer.",
        );
        setBuys([]);
        setBuysNextOffset(null);
        return;
      }
      setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
      if (!hasExpandedBuyPages) {
        setBuysNextOffset(data.next_offset);
      }
      setIndexerNote(null);
    };

    const scheduleLoop = () => {
      timeoutId = window.setTimeout(async () => {
        await loadBuys();
        if (!cancelled && indexerBaseUrl()) {
          scheduleLoop();
        }
      }, getIndexerBackoffPollMs(3000));
    };

    void (async () => {
      await loadBuys();
      if (!cancelled && indexerBaseUrl()) {
        scheduleLoop();
      }
    })();

    return () => {
      cancelled = true;
      requestSeq += 1;
      window.clearTimeout(timeoutId);
    };
  }, [hasExpandedBuyPages]);

  const handleLoadMoreBuys = useCallback(async () => {
    if (buysNextOffset === null) {
      return;
    }
    setLoadingMoreBuys(true);
    const data = await fetchTimecurveBuys(25, buysNextOffset);
    setLoadingMoreBuys(false);
    if (!data) {
      return;
    }
    setHasExpandedBuyPages(true);
    setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
    setBuysNextOffset(data.next_offset);
  }, [buysNextOffset]);

  return {
    buys,
    indexerNote,
    buysNextOffset,
    loadingMoreBuys,
    hasExpandedBuyPages,
    handleLoadMoreBuys,
  };
}
