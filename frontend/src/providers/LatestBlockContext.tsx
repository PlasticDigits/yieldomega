// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, useContext, type ReactNode } from "react";
import { useBlock, useChainId, type UseBlockReturnType } from "wagmi";
import { useRpcBackoffPollInterval, useRpcConnectivity } from "@/hooks/useRpcConnectivity";
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { MEGAETH_MAINNET_CHAIN_ID } from "@/lib/chain";

const LatestBlockContext = createContext<UseBlockReturnType | null>(null);

/**
 * Single `useBlock` subscription for the app. Multiple `useBlock({ watch: true })` hooks each
 * start an independent viem `watchBlocks` poller — on MegaETH (fast blocks) that multiplies
 * `eth_getBlockByNumber` traffic ([GitLab #182](https://gitlab.com/PlasticDigits/yieldomega/-/issues/182) arena note).
 *
 * MegaETH mainnet: cap head polling at **1s** while healthy, then shared RPC backoff (**5s → 15s → 30s**)
 * after failure streaks ([#221](https://gitlab.com/PlasticDigits/yieldomega/-/issues/221)). Other chains: default viem/wagmi polling.
 */
export function LatestBlockProvider({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const mega = chainId === MEGAETH_MAINNET_CHAIN_ID;
  const { isOffline: isRpcOffline } = useRpcConnectivity();
  const blockPollMs = useRpcBackoffPollInterval(1000);
  const blockQuery = useBlock({
    watch: mega ? { pollingInterval: blockPollMs } : true,
    query: {
      enabled: true,
      retry: isRpcOffline ? 0 : 1,
    },
  });
  useRpcQueryHealthForRefetch({
    isFetched: blockQuery.isFetched,
    isFetching: blockQuery.isFetching,
    isError: blockQuery.isError,
    isSuccess: blockQuery.isSuccess,
    error: blockQuery.error,
  });
  return (
    <LatestBlockContext.Provider value={blockQuery}>{children}</LatestBlockContext.Provider>
  );
}

/** @throws if used outside {@link LatestBlockProvider} */
export function useLatestBlock(): UseBlockReturnType {
  const ctx = useContext(LatestBlockContext);
  if (!ctx) {
    throw new Error("useLatestBlock must be used within LatestBlockProvider");
  }
  return ctx;
}
