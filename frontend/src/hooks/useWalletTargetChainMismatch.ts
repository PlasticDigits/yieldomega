// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { configuredTargetChainId } from "@/lib/chain";

/** True when a wallet session is connected and its `chainId` ≠ `{@link configuredTargetChainId()}`. */
export function useWalletTargetChainMismatch(): {
  mismatch: boolean;
  targetChainId: number;
  walletChainId: number;
  isConnected: boolean;
} {
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const targetChainId = useMemo(() => configuredTargetChainId(), []);
  const mismatch = Boolean(isConnected && walletChainId !== targetChainId);

  return { mismatch, targetChainId, walletChainId, isConnected };
}
