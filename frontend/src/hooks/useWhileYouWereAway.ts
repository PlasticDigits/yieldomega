// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  ARENA_SESSION_SUMMARY_MIN_ABSENT_MS,
  installArenaSessionClosePersistence,
  readArenaLastClosedAt,
} from "@/lib/arenaSessionClose";
import { fetchArenaSessionSummary, type ArenaSessionSummary } from "@/lib/indexerApi";

export type WhileYouWereAwayState = {
  summary: ArenaSessionSummary;
  lastClosedAt: number;
};

/**
 * On play mount: if the browser has a prior close timestamp and the indexer
 * reports activity since then, surface the session summary once per page load.
 */
export function useWhileYouWereAway() {
  const { address } = useAccount();
  const [state, setState] = useState<WhileYouWereAwayState | null>(null);
  const dismissedRef = useRef(false);
  const fetchedRef = useRef(false);

  useEffect(() => installArenaSessionClosePersistence(), []);

  useEffect(() => {
    if (fetchedRef.current || dismissedRef.current) return;
    const base = indexerBaseUrl();
    if (!base) return;

    const lastClosedAt = readArenaLastClosedAt();
    if (lastClosedAt == null) return;

    const absentMs = Date.now() - lastClosedAt;
    if (absentMs < ARENA_SESSION_SUMMARY_MIN_ABSENT_MS) return;

    fetchedRef.current = true;
    let cancelled = false;

    void (async () => {
      const wallet = address?.trim().toLowerCase();
      const summary = await fetchArenaSessionSummary(lastClosedAt, wallet);
      if (cancelled || !summary) return;

      const totalBuys = Number(summary.total_buys);
      const podiumUpdates = Number(summary.podium_updates);
      const hasActivity =
        (Number.isFinite(totalBuys) && totalBuys > 0) ||
        (Number.isFinite(podiumUpdates) && podiumUpdates > 0) ||
        (summary.podium_epochs_ended?.length ?? 0) > 0;
      if (!hasActivity) return;

      setState({ summary, lastClosedAt });
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const dismiss = (suppressForSession = false) => {
    if (suppressForSession) dismissedRef.current = true;
    setState(null);
  };

  return { state, dismiss };
}
