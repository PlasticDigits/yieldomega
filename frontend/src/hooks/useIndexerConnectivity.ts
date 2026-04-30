// SPDX-License-Identifier: AGPL-3.0-only

import { useContext, useSyncExternalStore } from "react";
import {
  type IndexerLastOkBanner,
  IndexerLastOkContext,
} from "@/providers/IndexerConnectivityContext";
import {
  INDEXER_OFFLINE_FAILURE_STREAK,
  getIndexerFailureStreak,
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
  subscribeIndexerConnectivity,
} from "@/lib/indexerConnectivity";

export type UseIndexerConnectivityResult = {
  failureStreak: number;
  isOffline: boolean;
  lastOkBanner: IndexerLastOkBanner | null;
  reportAttempt: typeof reportIndexerFetchAttempt;
  backoffPollMs: (fastIntervalMs: number) => number;
};

export function useIndexerConnectivity(): UseIndexerConnectivityResult {
  const lastOkBanner = useContext(IndexerLastOkContext);
  const failureStreak = useSyncExternalStore(
    subscribeIndexerConnectivity,
    getIndexerFailureStreak,
    getIndexerFailureStreak,
  );
  return {
    failureStreak,
    isOffline: failureStreak >= INDEXER_OFFLINE_FAILURE_STREAK,
    lastOkBanner,
    reportAttempt: reportIndexerFetchAttempt,
    backoffPollMs: getIndexerBackoffPollMs,
  };
}
