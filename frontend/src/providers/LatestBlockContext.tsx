// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, useContext, type ReactNode } from "react";
import { useBlock, useChainId, type UseBlockReturnType } from "wagmi";
import { MEGAETH_MAINNET_CHAIN_ID } from "@/lib/chain";

const LatestBlockContext = createContext<UseBlockReturnType | null>(null);

/**
 * Single `useBlock` subscription for the app. Multiple `useBlock({ watch: true })` hooks each
 * start an independent viem `watchBlocks` poller — on MegaETH (fast blocks) that multiplies
 * `eth_getBlockByNumber` traffic ([GitLab #182](https://gitlab.com/PlasticDigits/yieldomega/-/issues/182) arena note).
 *
 * MegaETH mainnet: cap head polling at **1s**. Other chains: default viem/wagmi polling.
 */
export function LatestBlockProvider({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const mega = chainId === MEGAETH_MAINNET_CHAIN_ID;
  const blockQuery = useBlock({
    watch: mega ? { pollingInterval: 1000 } : true,
    query: { enabled: true },
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
