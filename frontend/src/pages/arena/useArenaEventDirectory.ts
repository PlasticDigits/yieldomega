// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchArenaEvents,
  type ArenaEventKind,
  type ArenaEventListItem,
} from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";

const PAGE_LIMIT = 25;
const POLL_MS = 12_000;

export type ArenaEventDirectoryKind = ArenaEventKind | "all";

export function useArenaEventDirectory(kind: ArenaEventDirectoryKind, search: string) {
  const [items, setItems] = useState<ArenaEventListItem[] | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!indexerBaseUrl()) {
        setIndexerNote("Indexer URL not configured — event history unavailable in this build.");
        setItems([]);
        setNextOffset(null);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setIndexerNote(null);
      try {
        const page = await fetchArenaEvents(PAGE_LIMIT, offset, kind, search);
        reportIndexerFetchAttempt(page != null);
        if (!page) {
          setIndexerNote("Indexer unreachable — event directory may be stale or empty.");
          if (!append) {
            setItems([]);
            setNextOffset(null);
          }
          return;
        }
        setItems((prev) => (append && prev ? [...prev, ...page.items] : page.items));
        setNextOffset(page.next_offset ?? null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, search],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (cancelled) return;
      await loadPage(0, false);
      if (cancelled) return;
      timer = setTimeout(run, getIndexerBackoffPollMs(POLL_MS));
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (nextOffset == null || loadingMore) return;
    void loadPage(nextOffset, true);
  }, [loadPage, loadingMore, nextOffset]);

  return {
    items,
    loading,
    loadingMore,
    indexerNote,
    nextOffset,
    loadMore,
    refresh: () => loadPage(0, false),
  };
}
