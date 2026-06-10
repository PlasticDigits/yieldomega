// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { fetchArenaWalletStats } from "@/lib/indexerApi";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  getIndexerBackoffPollMs,
  reportIndexerFetchAttempt,
} from "@/lib/indexerConnectivity";

export const ARENA_WALLET_STATS_QUERY_KEY = "arena-wallet-stats" as const;

export function arenaWalletStatsQueryKey(
  base: string | undefined,
  address: string | undefined,
) {
  return [ARENA_WALLET_STATS_QUERY_KEY, base, address?.trim().toLowerCase()] as const;
}

export {
  invalidateArenaWalletStatsQueries,
  optimisticArenaWalletBuyStats,
  optimisticArenaWalletXpGain,
} from "@/lib/arenaWalletXpOptimistic";

export function useWalletStats(address: string | undefined) {
  const base = indexerBaseUrl();
  const w = address?.trim().toLowerCase();
  return useQuery({
    queryKey: arenaWalletStatsQueryKey(base, w),
    enabled: Boolean(base && w?.startsWith("0x") && w.length === 42),
    queryFn: async () => {
      const body = await fetchArenaWalletStats(w!);
      reportIndexerFetchAttempt(body != null);
      return body;
    },
    staleTime: 0,
    refetchInterval: () => getIndexerBackoffPollMs(2000),
    placeholderData: (previous) => previous,
  });
}
