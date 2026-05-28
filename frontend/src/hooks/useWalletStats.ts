// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from "@tanstack/react-query";
import { fetchArenaWalletStats } from "@/lib/indexerApi";
import { indexerBaseUrl } from "@/lib/addresses";

export function useWalletStats(address: string | undefined) {
  const base = indexerBaseUrl();
  const w = address?.trim().toLowerCase();
  return useQuery({
    queryKey: ["arena-wallet-stats", base, w],
    enabled: Boolean(base && w?.startsWith("0x") && w.length === 42),
    queryFn: () => fetchArenaWalletStats(w!),
    staleTime: 15_000,
  });
}
