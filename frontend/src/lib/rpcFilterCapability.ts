// SPDX-License-Identifier: AGPL-3.0-only

import { createPublicClient, http, MethodNotSupportedRpcError } from "viem";
import { configuredChain } from "@/lib/chain";

/** JSON-RPC methods that require a working filter + `eth_getFilterChanges` poll loop. */
export const FILTER_RPC_METHODS = [
  "eth_newFilter",
  "eth_newBlockFilter",
  "eth_newPendingTransactionFilter",
  "eth_getFilterChanges",
  "eth_getFilterLogs",
  "eth_uninstallFilter",
] as const;

export type FilterRpcMethod = (typeof FILTER_RPC_METHODS)[number];

const CACHE_STORAGE_KEY = "yieldomega.rpc.filterCapability.v1";
/** Re-probe each endpoint after this many milliseconds (4 hours). */
export const RPC_FILTER_CAPABILITY_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

const CACHE_VERSION = 1 as const;

type CacheEntry = {
  filterSupport: boolean;
  probedAtMs: number;
};

type RpcFilterCapabilityCache = {
  v: typeof CACHE_VERSION;
  entries: Record<string, CacheEntry>;
};

const memoryEntries = new Map<string, CacheEntry>();
const probeInFlight = new Map<string, Promise<boolean>>();

function normalizeRpcUrl(url: string): string {
  return url.trim();
}

function isFresh(entry: CacheEntry, nowMs = Date.now()): boolean {
  return nowMs - entry.probedAtMs < RPC_FILTER_CAPABILITY_CACHE_TTL_MS;
}

function readStorageCache(): RpcFilterCapabilityCache | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RpcFilterCapabilityCache;
    if (parsed?.v !== CACHE_VERSION || !parsed.entries || typeof parsed.entries !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorageCache(): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: RpcFilterCapabilityCache = {
    v: CACHE_VERSION,
    entries: Object.fromEntries(memoryEntries),
  };
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — in-memory cache still applies for this session.
  }
}

/** Hydrate the in-memory cache from `sessionStorage` (safe to call at module load). */
export function hydrateRpcFilterCapabilityCache(): void {
  const stored = readStorageCache();
  if (!stored) return;
  for (const [url, entry] of Object.entries(stored.entries)) {
    if (
      entry &&
      typeof entry.filterSupport === "boolean" &&
      typeof entry.probedAtMs === "number"
    ) {
      memoryEntries.set(normalizeRpcUrl(url), entry);
    }
  }
}

function setCacheEntry(url: string, filterSupport: boolean, probedAtMs = Date.now()): void {
  const key = normalizeRpcUrl(url);
  memoryEntries.set(key, { filterSupport, probedAtMs });
  writeStorageCache();
}

/** Provider-specific or spec errors indicating filter polling is unavailable. */
export function isFilterCapabilityRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  if (code === 35) return true;
  if (code === -32004) return true;
  if (message.includes("freetier")) return true;
  if (message.includes("method is not available")) return true;
  if (message.includes("method not supported") && message.includes("filter")) return true;
  return false;
}

export function rpcUrlSupportsEventFilters(url: string): boolean {
  const entry = memoryEntries.get(normalizeRpcUrl(url));
  if (!entry) return true;
  return entry.filterSupport;
}

/** Viem `http({ methods: { exclude } })` list for endpoints that failed the filter probe. */
export function getFilterMethodExcludesForRpcUrl(url: string): FilterRpcMethod[] {
  return rpcUrlSupportsEventFilters(url) ? [] : [...FILTER_RPC_METHODS];
}

export function urlsNeedBlockingFilterProbe(urls: readonly string[]): boolean {
  return urls.some((raw) => {
    const url = normalizeRpcUrl(raw);
    if (!url) return false;
    return memoryEntries.get(url) === undefined;
  });
}

export function urlsNeedFilterReprobe(urls: readonly string[], nowMs = Date.now()): string[] {
  return urls
    .map(normalizeRpcUrl)
    .filter((url) => {
      if (!url) return false;
      const entry = memoryEntries.get(url);
      return !entry || !isFresh(entry, nowMs);
    });
}

/**
 * Probe whether `rpcUrl` supports `eth_*Filter` + `eth_getFilterChanges`.
 * Uses a block filter so we do not depend on deployed contract addresses.
 */
export async function probeRpcEventFilterSupport(rpcUrl: string): Promise<boolean> {
  const url = normalizeRpcUrl(rpcUrl);
  const existing = probeInFlight.get(url);
  if (existing) return existing;

  const chain = configuredChain();
  const client = createPublicClient({
    chain,
    transport: http(url, { timeout: 10_000 }),
  });

  const work = (async () => {
    try {
      const filter = await client.createBlockFilter();
      await client.getFilterChanges({ filter });
      await client.uninstallFilter({ filter });
      return true;
    } catch (err) {
      if (isFilterCapabilityRpcError(err)) return false;
      return true;
    }
  })();

  probeInFlight.set(url, work);
  try {
    return await work;
  } finally {
    probeInFlight.delete(url);
  }
}

async function probeAndCache(url: string): Promise<boolean> {
  const filterSupport = await probeRpcEventFilterSupport(url);
  setCacheEntry(url, filterSupport);
  return filterSupport;
}

/**
 * Startup: probe URLs with no cache entry (blocking) and stale entries (>4h, background).
 */
export async function ensureRpcFilterCapabilitiesProbed(urls: readonly string[]): Promise<void> {
  const normalized = [...new Set(urls.map(normalizeRpcUrl).filter(Boolean))];
  if (normalized.length === 0) return;

  const missing = normalized.filter((url) => memoryEntries.get(url) === undefined);
  await Promise.all(missing.map((url) => probeAndCache(url)));

  const stale = urlsNeedFilterReprobe(normalized).filter((url) => !missing.includes(url));
  if (stale.length === 0) return;

  await Promise.all(stale.map((url) => probeAndCache(url)));
}

/** Throws `MethodNotSupportedRpcError` for filter RPC on endpoints that failed the probe. */
export function assertFilterRpcMethodAllowedForUrl(url: string | undefined, method: string): void {
  if (!url) return;
  if (!FILTER_RPC_METHODS.includes(method as FilterRpcMethod)) return;
  if (rpcUrlSupportsEventFilters(url)) return;
  throw new MethodNotSupportedRpcError(new Error("method not supported"), { method });
}

/** Vitest-only reset. */
export function resetRpcFilterCapabilityForTests(): void {
  memoryEntries.clear();
  probeInFlight.clear();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CACHE_STORAGE_KEY);
  }
}

hydrateRpcFilterCapabilityCache();
