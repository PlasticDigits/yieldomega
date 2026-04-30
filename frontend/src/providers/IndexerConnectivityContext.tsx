// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, type ReactNode, useEffect, useMemo, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { fetchIndexerStatus } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";

export type IndexerLastOkBanner = {
  schemaVersion: string;
  maxIndexedBlockDisplay: string;
};

export const IndexerLastOkContext = createContext<IndexerLastOkBanner | null>(null);

function parseBanner(s: Record<string, unknown>): IndexerLastOkBanner {
  const ver = typeof s.schema_version === "string" ? s.schema_version : "?";
  const blockRaw = s.max_indexed_block;
  const maxIndexedBlockDisplay =
    typeof blockRaw === "number" || typeof blockRaw === "string" ? formatLocaleInteger(blockRaw) : "?";
  return { schemaVersion: ver, maxIndexedBlockDisplay };
}

/**
 * Keeps `lastOk` snapshot for the footer / inline indexer pill and drives
 * {@link reportIndexerFetchAttempt} from `GET /v1/status` (with indexerApi fallback).
 */
export function IndexerConnectivityProvider({ children }: { children: ReactNode }) {
  const [lastOk, setLastOk] = useState<IndexerLastOkBanner | null>(null);

  useEffect(() => {
    if (!indexerBaseUrl()) {
      setLastOk(null);
      return;
    }
    let cancelled = false;
    let timeoutId = 0;

    const step = async () => {
      const s = await fetchIndexerStatus();
      if (cancelled) {
        return;
      }
      reportIndexerFetchAttempt(s != null);
      if (s) {
        setLastOk(parseBanner(s));
      }
      if (cancelled) {
        return;
      }
      timeoutId = window.setTimeout(step, getIndexerBackoffPollMs(3000));
    };

    void step();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const value = useMemo(() => lastOk, [lastOk]);

  return <IndexerLastOkContext.Provider value={value}>{children}</IndexerLastOkContext.Provider>;
}
