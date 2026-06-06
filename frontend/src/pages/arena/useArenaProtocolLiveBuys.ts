// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchArenaActivity,
  fetchArenaBuysAsBuyItems,
  type ArenaActivityItem,
  type BuyItem,
} from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { mergeBuysNewestFirst } from "@/lib/arenaPageHelpers";

function mergeActivityNewestFirst(
  nextItems: ArenaActivityItem[],
  prev: ArenaActivityItem[] | null,
): ArenaActivityItem[] {
  const seen = new Set<string>();
  return [...nextItems, ...(prev ?? [])].filter((item) => {
    const key = `${item.tx_hash}:${item.log_index}:${item.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Indexer-backed recent buys for read-only surfaces (e.g. protocol / audit view).
 * Mirrors the Arena poll + pagination merge semantics without pulling in the full arena model.
 */
export function useArenaProtocolLiveBuys() {
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [activity, setActivity] = useState<ArenaActivityItem[] | null>(null);
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
      const [activityData, data] = await Promise.all([
        fetchArenaActivity(25, 0),
        fetchArenaBuysAsBuyItems(25, 0),
      ]);
      if (cancelled || id !== requestSeq) {
        return;
      }
      const ok = activityData != null || data != null;
      if (indexerBaseUrl()) {
        reportIndexerFetchAttempt(ok);
      }
      if (!activityData && !data) {
        setIndexerNote(
          indexerBaseUrl()
            ? "Could not load buys from the indexer (offline, CORS, or HTTP error). Check the indexer is running."
            : "Set VITE_INDEXER_URL to load recent buys from the indexer.",
        );
        setBuys([]);
        setActivity([]);
        setBuysNextOffset(null);
        return;
      }
      if (data) {
        setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
      }
      if (activityData) {
        setActivity((prev) => mergeActivityNewestFirst(activityData.items, prev));
      }
      if (!hasExpandedBuyPages) {
        setBuysNextOffset(data?.next_offset ?? activityData?.next_offset ?? null);
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
    const [activityData, data] = await Promise.all([
      fetchArenaActivity(25, buysNextOffset),
      fetchArenaBuysAsBuyItems(25, buysNextOffset),
    ]);
    setLoadingMoreBuys(false);
    if (!activityData && !data) {
      return;
    }
    setHasExpandedBuyPages(true);
    if (data) {
      setBuys((prev) => mergeBuysNewestFirst(data.items, prev));
    }
    if (activityData) {
      setActivity((prev) => mergeActivityNewestFirst(activityData.items, prev));
    }
    setBuysNextOffset(data?.next_offset ?? activityData?.next_offset ?? null);
  }, [buysNextOffset]);

  return {
    buys,
    activity,
    indexerNote,
    buysNextOffset,
    loadingMoreBuys,
    hasExpandedBuyPages,
    handleLoadMoreBuys,
  };
}
