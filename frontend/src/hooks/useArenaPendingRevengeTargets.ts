// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import { getIndexerBackoffPollMs } from "@/lib/indexerConnectivity";
import {
  fetchWarbowPendingRevenge,
  type WarbowPendingRevengeItem,
  type WarbowPendingRevengeResponse,
} from "@/lib/indexerApi";

const REVENGE_POLL_MS = 5_000;

export type UseArenaPendingRevengeOptions = {
  /** Default 5000 on play surfaces; `false` for audit / read-only (fetch once on connect). */
  pollMs?: number | false;
};

/**
 * Open WarBow revenge windows for `victim` via `GET /v1/arena/warbow/pending-revenge` (#135).
 * Omits client `now_sec` so the indexer uses authoritative head chain time (#301).
 */
export function useArenaPendingRevengeTargets(
  victim: string | undefined,
  options: UseArenaPendingRevengeOptions = {},
) {
  const pollMs = options.pollMs ?? REVENGE_POLL_MS;
  const revengeIndexerConfigured = Boolean(indexerBaseUrl());
  const [response, setResponse] = useState<WarbowPendingRevengeResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!victim || !revengeIndexerConfigured) {
      setResponse(null);
      setLoadFailed(false);
      return;
    }

    let cancelled = false;
    let timerId = 0;

    const schedule = (immediate: boolean) => {
      const delay =
        pollMs === false ? (immediate ? 0 : Number.POSITIVE_INFINITY) : getIndexerBackoffPollMs(pollMs);
      if (!Number.isFinite(delay)) {
        return;
      }
      timerId = window.setTimeout(() => {
        void fetchWarbowPendingRevenge(victim).then((body) => {
          if (cancelled) {
            return;
          }
          setResponse(body);
          setLoadFailed(body === null);
          if (pollMs !== false) {
            schedule(false);
          }
        });
      }, immediate ? 0 : delay);
    };

    schedule(true);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [victim, revengeIndexerConfigured, pollMs]);

  const pendingRevengeTargets = useMemo(
    (): readonly WarbowPendingRevengeItem[] => response?.items ?? [],
    [response],
  );

  return {
    pendingRevengeTargets,
    hasRevengeOpen: pendingRevengeTargets.length > 0,
    revengeIndexerConfigured,
    revengeWindowSec: response?.revenge_window_sec,
    pendingRevengeLoadFailed: loadFailed,
  };
}
