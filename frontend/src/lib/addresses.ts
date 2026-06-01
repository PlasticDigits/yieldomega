// SPDX-License-Identifier: AGPL-3.0-only

import { resolveChainRpcConfig } from "./chain";

export type HexAddress = `0x${string}`;

const ADDR_HEX = /^0x[0-9a-fA-F]{40}$/;

/** Parse a 20-byte hex address from env or config strings (no `import.meta` — unit-testable). */
export function parseHexAddress(v: string | undefined | null): HexAddress | undefined {
  const t = v?.trim();
  if (!t || !ADDR_HEX.test(t)) {
    return undefined;
  }
  return t as HexAddress;
}

/** Arena v2 contract addresses — required for play and protocol surfaces (GitLab #266).
 *  Use static `import.meta.env.VITE_*` keys so Vite inlines them in production builds (E2E #256). */
export const addresses = {
  timeArena: parseHexAddress(import.meta.env.VITE_TIME_ARENA_ADDRESS),
  podiumVaults: parseHexAddress(import.meta.env.VITE_PODIUM_VAULTS_ADDRESS),
  adminSellVault: parseHexAddress(import.meta.env.VITE_ADMIN_SELL_VAULT_ADDRESS),
  referralRegistry: parseHexAddress(import.meta.env.VITE_REFERRAL_REGISTRY_ADDRESS),
  /** Optional override when `TimeArena.playCred()` read is unavailable (#269). */
  playCred: parseHexAddress(import.meta.env.VITE_PLAY_CRED_ADDRESS),
};

/** Primary Time Arena proxy for reads and writes. */
export function timeArenaAddress(): HexAddress | undefined {
  return addresses.timeArena;
}

/** Optional public URL for CL8Y / governance (footer link). */
export function governanceUrl(): string | undefined {
  const u = import.meta.env.VITE_GOVERNANCE_URL?.trim();
  return u && u.length > 0 ? u : undefined;
}

/** Optional outbound link for third-party Kumbaya DEX (spot / v3 pool). */
export function kumbayaDexUrl(): string | undefined {
  const u = import.meta.env.VITE_KUMBAYA_DEX_URL?.trim();
  return u && u.length > 0 ? u : undefined;
}

/** Optional outbound link for third-party Sir DEX (levs / derivatives). */
export function sirDexUrl(): string | undefined {
  const u = import.meta.env.VITE_SIR_DEX_URL?.trim();
  return u && u.length > 0 ? u : undefined;
}

export function normalizeIndexerBaseUrl(u: string | undefined | null): string | undefined {
  const t = u?.trim();
  if (!t || t.length === 0) {
    return undefined;
  }
  return t.replace(/\/$/, "");
}

const DEVNET_INDEXER_URL = "http://127.0.0.1:3100";

export function indexerBaseUrl(): string | undefined {
  const rawIndexer = import.meta.env.VITE_INDEXER_URL;
  // `VITE_INDEXER_URL=` (empty) disables indexer on devnet — used by Anvil E2E.
  if (rawIndexer !== undefined && String(rawIndexer).trim() === "") {
    return undefined;
  }

  const explicit = normalizeIndexerBaseUrl(rawIndexer);
  if (explicit) return explicit;

  const { id } = resolveChainRpcConfig(
    import.meta.env.VITE_CHAIN_ID,
    import.meta.env.VITE_RPC_URL,
  );
  if (id === 31337) {
    return DEVNET_INDEXER_URL;
  }
  return undefined;
}
