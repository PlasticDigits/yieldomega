// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchWarbowGuardLatest,
  fetchWarbowStealsByVictimDay,
  type WarbowLeaderboardItem,
} from "@/lib/indexerApi";
import { getIndexerBackoffPollMs } from "@/lib/indexerConnectivity";

export type StealCandidateOnchainSlice = {
  bp?: bigint;
  steals?: bigint;
  guardUntil?: bigint;
};

function stealsTodayFromIndexerItems(
  items: { utc_day: string; steal_count: string }[] | undefined,
  utcDayId: bigint,
): bigint | undefined {
  if (!items?.length) return 0n;
  const day = utcDayId.toString();
  const row = items.find((i) => i.utc_day === day);
  if (!row) return 0n;
  try {
    return BigInt(row.steal_count);
  } catch {
    return undefined;
  }
}

/**
 * Indexer-backed steal-hero display state (BP from leaderboard; steals/guard per victim) ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216)).
 */
export function useWarbowStealCandidateIndexerReads(
  candidates: readonly { address: `0x${string}` }[],
  warbowLb: readonly WarbowLeaderboardItem[] | null,
  utcDayId: bigint,
  refreshNonce: number,
): Map<string, StealCandidateOnchainSlice> {
  const candidateKey = useMemo(
    () =>
      [...candidates]
        .map((c) => c.address.toLowerCase())
        .sort()
        .join("|"),
    [candidates],
  );

  const bpByAddr = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const row of warbowLb ?? []) {
      try {
        m.set(row.buyer.toLowerCase(), BigInt(row.battle_points_after));
      } catch {
        /* skip malformed */
      }
    }
    return m;
  }, [warbowLb]);

  const [extraByAddr, setExtraByAddr] = useState<Map<string, StealCandidateOnchainSlice>>(new Map());
  const seqRef = useRef(0);

  useEffect(() => {
    if (!candidateKey) {
      setExtraByAddr(new Map());
      return;
    }
    const addrs = candidateKey.split("|").filter(Boolean) as `0x${string}`[];
    if (addrs.length === 0) {
      setExtraByAddr(new Map());
      return;
    }

    let cancelled = false;
    const seq = ++seqRef.current;

    const load = async () => {
      const pairs = await Promise.all(
        addrs.map(async (addr) => {
          const [stealsPage, guardPage] = await Promise.all([
            fetchWarbowStealsByVictimDay(addr),
            fetchWarbowGuardLatest(addr),
          ]);
          const steals = stealsTodayFromIndexerItems(stealsPage?.items, utcDayId);
          let guardUntil: bigint | undefined;
          const g = guardPage?.latest_guard_activation?.guard_until_ts;
          if (g != null) {
            try {
              guardUntil = BigInt(g);
            } catch {
              guardUntil = undefined;
            }
          }
          return [addr.toLowerCase(), { steals, guardUntil }] as const;
        }),
      );
      if (cancelled || seq !== seqRef.current) return;
      const m = new Map<string, StealCandidateOnchainSlice>();
      for (const [k, v] of pairs) {
        m.set(k, v);
      }
      setExtraByAddr(m);
    };

    void load();
    const id = window.setInterval(() => void load(), getIndexerBackoffPollMs(1500));
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [candidateKey, utcDayId, refreshNonce]);

  return useMemo(() => {
    const m = new Map<string, StealCandidateOnchainSlice>();
    for (const c of candidates) {
      const key = c.address.toLowerCase();
      const bp = bpByAddr.get(key);
      const extra = extraByAddr.get(key);
      m.set(key, {
        bp: bp ?? extra?.bp,
        steals: extra?.steals,
        guardUntil: extra?.guardUntil,
      });
    }
    return m;
  }, [candidates, bpByAddr, extraByAddr]);
}
