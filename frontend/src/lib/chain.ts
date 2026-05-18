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

/**
 * Split `VITE_RPC_URL` when it lists several JSON-RPC endpoints (comma-separated).
 * Order is preserved; empty entries are dropped.
 */
export function parseCommaSeparatedRpcUrls(rpcUrlRaw: string | undefined): string[] {
  if (!rpcUrlRaw?.trim()) return [];
  return rpcUrlRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Ordered RPC list for MegaETH mainnet: env URLs first (already parsed), then public fallbacks (deduped).
 * Pass the env-derived list (possibly empty — callers substitute `[defaultRpcHttp]` first).
 */
export function megaethMainnetOrderedRpcUrls(envRpcUrls: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...envRpcUrls, ...MEGAETH_MAINNET_PUBLIC_RPC_FALLBACKS]) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    ordered.push(u);
  }
  return ordered;
}

/**
 * Resolve chain id and default RPC URL from env-like strings (unit-testable).
 * `rpcUrlRaw` may list several endpoints separated by commas; the first URL is `defaultRpcHttp`.
 * Default chain id when unset or invalid is **31337** (local Anvil), consistent with `scripts/start-local-anvil-stack.sh`.
 */
export function resolveChainRpcConfig(
  chainIdStr: string | undefined,
  rpcUrlRaw: string | undefined,
): { id: number; defaultRpcHttp: string } {
  const urls = parseCommaSeparatedRpcUrls(rpcUrlRaw);
  const firstRpc = urls[0];
  const raw = chainIdStr?.trim();
  const parsed =
    raw && raw.length > 0 ? Number.parseInt(raw, 10) : Number.NaN;
  const defaultAnvilLocal =
    firstRpc === "http://127.0.0.1:8545" || firstRpc === "http://localhost:8545";
  let id: number;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 0x7fff_ffff) {
    id = parsed;
  } else if (defaultAnvilLocal) {
    // Common dev setup: Anvil default chain without VITE_CHAIN_ID set.
    id = 31337;
  } else {
    id = DEFAULT_CHAIN_ID;
  }
  let defaultRpcHttp =
    firstRpc && firstRpc.length > 0 ? firstRpc : DEFAULT_RPC_HTTP;
  if (id === MEGAETH_MAINNET_CHAIN_ID && urls.length === 0) {
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
  const envRpcUrls = parseCommaSeparatedRpcUrls(import.meta.env.VITE_RPC_URL);
  const envBase = envRpcUrls.length > 0 ? envRpcUrls : [defaultRpcHttp];
  const nameOverride = import.meta.env.VITE_CHAIN_NAME?.trim();
  const rpcHttpList =
    id === MEGAETH_MAINNET_CHAIN_ID
      ? megaethMainnetOrderedRpcUrls(envBase)
      : envBase;
  return defineChain({
    id,
    name: nameOverride && nameOverride.length > 0 ? nameOverride : `Chain ${id}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: rpcHttpList },
    },
  });
}

