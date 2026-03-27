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

function parseAddr(key: string): HexAddress | undefined {
  return parseHexAddress(import.meta.env[key]);
}

export const addresses = {
  timeCurve: parseAddr("VITE_TIMECURVE_ADDRESS"),
  rabbitTreasury: parseAddr("VITE_RABBIT_TREASURY_ADDRESS"),
  leprechaunNft: parseAddr("VITE_LEPRECHAUN_NFT_ADDRESS"),
  referralRegistry: parseAddr("VITE_REFERRAL_REGISTRY_ADDRESS"),
  feeRouter: parseAddr("VITE_FEE_ROUTER_ADDRESS"),
};

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
  const explicit = normalizeIndexerBaseUrl(import.meta.env.VITE_INDEXER_URL);
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
