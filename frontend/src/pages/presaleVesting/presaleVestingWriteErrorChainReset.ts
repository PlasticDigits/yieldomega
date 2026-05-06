// SPDX-License-Identifier: AGPL-3.0-only

import { chainMismatchWriteMessage, type ChainConfigEnvSlice } from "@/lib/chainMismatchWriteGuard";

/**
 * When the wallet returns from a wrong-network session, wagmi's `useWriteContract` error can outlive
 * the chain switch. Call `reset()` only on a **transition** from target mismatch → target match so
 * a same-chain reject still shows `claimError` until the user retries or leaves and returns to target.
 *
 * @see https://gitlab.com/PlasticDigits/yieldomega/-/issues/166
 */
export function shouldResetWriteContractErrorAfterChainTransition(
  previousWalletChainId: number,
  walletChainId: number,
  hasWriteContractError: boolean,
  env: ChainConfigEnvSlice,
): boolean {
  if (!hasWriteContractError) return false;
  const hadMismatch = !!chainMismatchWriteMessage(previousWalletChainId, env);
  const hasTargetMatch = !chainMismatchWriteMessage(walletChainId, env);
  return hadMismatch && hasTargetMatch;
}
