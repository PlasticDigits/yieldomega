// SPDX-License-Identifier: AGPL-3.0-only

import { defineChain } from "viem";

/** MegaETH mainnet — see deployment guide + `address-registry.megaeth-mainnet.json`. */
export const MEGAETH_MAINNET_CHAIN_ID = 4326;

/** Canonical public RPC when none is set via env (ordered first before fallbacks). */
export const MEGAETH_MAINNET_PRIMARY_RPC = "https://mainnet.megaeth.com/rpc";

/**
 * Extra MegaETH mainnet JSON-RPC endpoints tried after the primary when the first
 * transport fails (429/502/503/504, etc. — viem `fallback` + `http` retry behavior).
 */
const MEGAETH_MAINNET_PUBLIC_RPC_FALLBACKS: readonly string[] = [
  "https://rpc-megaeth-mainnet.globalstake.io",
  "https://carrot.megaeth.com/rpc",
];

/** Default when `VITE_CHAIN_ID` / `VITE_RPC_URL` are unset: local Anvil. */
const DEFAULT_CHAIN_ID = 31_337;
const DEFAULT_RPC_HTTP = "http://127.0.0.1:8545";

/** Ordered RPC list for MegaETH mainnet: env/primary first, then public fallbacks (deduped). */
export function megaethMainnetOrderedRpcUrls(primary: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const raw of [primary, ...MEGAETH_MAINNET_PUBLIC_RPC_FALLBACKS]) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    ordered.push(u);
  }
  return ordered;
}

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
  let defaultRpcHttp = rpc && rpc.length > 0 ? rpc : DEFAULT_RPC_HTTP;
  if (id === MEGAETH_MAINNET_CHAIN_ID && (!rpc || rpc.length === 0)) {
    defaultRpcHttp = MEGAETH_MAINNET_PRIMARY_RPC;
  }
  return { id, defaultRpcHttp };
}

/** Target chain id from `VITE_CHAIN_ID` + `VITE_RPC_URL` (same semantics as {@link configuredChain}). */
export function configuredTargetChainId(): number {
  return resolveChainRpcConfig(import.meta.env.VITE_CHAIN_ID, import.meta.env.VITE_RPC_URL).id;
}

/** Target dev/test chain from `VITE_CHAIN_ID` + `VITE_RPC_URL` (MegaETH or local anvil). */
export function configuredChain() {
  const { id, defaultRpcHttp } = resolveChainRpcConfig(
    import.meta.env.VITE_CHAIN_ID,
    import.meta.env.VITE_RPC_URL,
  );
  const nameOverride = import.meta.env.VITE_CHAIN_NAME?.trim();
  const rpcHttpList =
    id === MEGAETH_MAINNET_CHAIN_ID
      ? megaethMainnetOrderedRpcUrls(defaultRpcHttp)
      : [defaultRpcHttp];
  return defineChain({
    id,
    name: nameOverride && nameOverride.length > 0 ? nameOverride : `Chain ${id}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: rpcHttpList },
    },
  });
}

