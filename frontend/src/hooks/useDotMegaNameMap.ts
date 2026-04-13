// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useChainId, useReadContracts } from "wagmi";
import { dotMegaRegistryAddress, megaNamesReadAbi } from "@/lib/dotMega";
import type { HexAddress } from "@/lib/addresses";

/**
 * Maps lowercased `0x…` wallet addresses to onchain DotMega primary names for the
 * active chain’s MegaNames registry (when configured).
 */
export function useDotMegaNameMap(addresses: readonly HexAddress[]): ReadonlyMap<string, string> {
  const chainId = useChainId();
  const registry = useMemo(() => dotMegaRegistryAddress(chainId), [chainId]);

  const uniq = useMemo(() => {
    const byLower = new Map<string, HexAddress>();
    for (const a of addresses) {
      byLower.set(a.toLowerCase(), a);
    }
    return [...byLower.values()];
  }, [addresses]);

  const { data } = useReadContracts({
    allowFailure: true,
    contracts:
      registry && uniq.length > 0
        ? uniq.map((addr) => ({
            address: registry,
            abi: megaNamesReadAbi,
            functionName: "getName" as const,
            args: [addr] as const,
            chainId,
          }))
        : [],
    query: {
      enabled: Boolean(registry && uniq.length > 0),
      staleTime: 120_000,
    },
  });

  return useMemo(() => {
    const m = new Map<string, string>();
    if (!data || !registry) {
      return m;
    }
    uniq.forEach((addr, i) => {
      const row = data[i];
      if (row?.status === "success" && typeof row.result === "string") {
        const name = row.result.trim();
        if (name.length > 0) {
          m.set(addr.toLowerCase(), name);
        }
      }
    });
    return m;
  }, [data, registry, uniq]);
}
