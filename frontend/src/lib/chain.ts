// SPDX-License-Identifier: AGPL-3.0-only

import { defineChain } from "viem";

/** Default when `VITE_CHAIN_ID` / `VITE_RPC_URL` are unset: local Anvil. */
const DEFAULT_CHAIN_ID = 31_337;
const DEFAULT_RPC_HTTP = "http://127.0.0.1:8545";

/**
 * Resolve chain id and default RPC URL from env-like strings (unit-testable).
 * Default chain id when unset or invalid is **31337** (local Anvil), consistent with `scripts/start-local-anvil-stack.sh`.
 */
export function resolveChainRpcConfig(
  chainIdStr: string | undefined,
  rpcUrlRaw: string | undefined,
): { id: number; defaultRpcHttp: string } {
  const rpc = rpcUrlRaw?.trim();
  const raw = chainIdStr?.trim();
  const parsed =
    raw && raw.length > 0 ? Number.parseInt(raw, 10) : Number.NaN;
  const defaultAnvilLocal =
    rpc === "http://127.0.0.1:8545" || rpc === "http://localhost:8545";
  let id: number;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 0x7fff_ffff) {
    id = parsed;
  } else if (defaultAnvilLocal) {
    // Common dev setup: Anvil default chain without VITE_CHAIN_ID set.
    id = 31337;
  } else {
    id = DEFAULT_CHAIN_ID;
  }
  const defaultRpcHttp = rpc && rpc.length > 0 ? rpc : DEFAULT_RPC_HTTP;
  return { id, defaultRpcHttp };
}

/** Target dev/test chain from `VITE_CHAIN_ID` + `VITE_RPC_URL` (MegaETH or local anvil). */
export function configuredChain() {
  const { id, defaultRpcHttp } = resolveChainRpcConfig(
    import.meta.env.VITE_CHAIN_ID,
    import.meta.env.VITE_RPC_URL,
  );
  const nameOverride = import.meta.env.VITE_CHAIN_NAME?.trim();
  return defineChain({
    id,
    name: nameOverride && nameOverride.length > 0 ? nameOverride : `Chain ${id}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [defaultRpcHttp] },
    },
  });
}

