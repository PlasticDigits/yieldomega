// SPDX-License-Identifier: AGPL-3.0-only

import { resolveChainRpcConfig } from "@/lib/chain";

/** Subset needed for deterministic tests (Vitest passes a plain env object). */
export type ChainConfigEnvSlice = Pick<ImportMeta["env"], "VITE_CHAIN_ID" | "VITE_RPC_URL">;

/**
 * Compares wallet `chainId` to build-time [`VITE_CHAIN_ID`](../../frontend/.env.example) / RPC-driven defaults
 * (see {@link resolveChainRpcConfig}). When they differ and the wallet is connected to the wrong chain, the frontend
 * must not build contract calldata aimed at deployments on another network ([GitLab #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)).
 */
export function chainMismatchWriteMessage(
  walletChainId: number,
  env: ChainConfigEnvSlice = import.meta.env,
): string | null {
  const targetId = resolveChainRpcConfig(env.VITE_CHAIN_ID, env.VITE_RPC_URL).id;
  if (walletChainId === targetId) {
    return null;
  }
  return `Wrong network: this build targets chain ${targetId}, but your wallet is on chain ${walletChainId}. Switch to chain ${targetId}, then retry.`;
}
