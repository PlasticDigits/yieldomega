// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchWarbowPendingRevenge,
  type WarbowPendingRevengeItem,
  type WarbowPendingRevengeResponse,
} from "@/lib/indexerApi";

const REVENGE_POLL_MS = 5_000;

/**
 * Open WarBow revenge windows for `victim` via `GET /v1/arena/warbow/pending-revenge` (#135).
 */
export function useArenaPendingRevengeTargets(
  victim: string | undefined,
  chainNowSec?: number,
) {
  const revengeIndexerConfigured = Boolean(indexerBaseUrl());
  const [response, setResponse] = useState<WarbowPendingRevengeResponse | null>(null);

  useEffect(() => {
    if (!victim || !revengeIndexerConfigured) {
      setResponse(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const load = () => {
      void fetchWarbowPendingRevenge(victim, chainNowSec).then((body) => {
        if (!cancelled) {
          setResponse(body);
        }
      });
    };

    load();
    timer = setInterval(load, REVENGE_POLL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearInterval(timer);
      }
    };
  }, [victim, revengeIndexerConfigured, chainNowSec]);

  const pendingRevengeTargets = useMemo(
    (): readonly WarbowPendingRevengeItem[] => response?.items ?? [],
    [response],
  );

  return {
    pendingRevengeTargets,
    hasRevengeOpen: pendingRevengeTargets.length > 0,
    revengeIndexerConfigured,
    revengeWindowSec: response?.revenge_window_sec,
  };
}
