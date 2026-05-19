// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FILTER_RPC_METHODS,
  RPC_FILTER_CAPABILITY_CACHE_TTL_MS,
  getFilterMethodExcludesForRpcUrl,
  hydrateRpcFilterCapabilityCache,
  isFilterCapabilityRpcError,
  resetRpcFilterCapabilityForTests,
  urlsNeedBlockingFilterProbe,
  urlsNeedFilterReprobe,
} from "./rpcFilterCapability";

const CACHE_KEY = "yieldomega.rpc.filterCapability.v1";

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear() {
      m.clear();
    },
    getItem(k: string) {
      return m.get(k) ?? null;
    },
    key(i: number) {
      return [...m.keys()][i] ?? null;
    },
    removeItem(k: string) {
      m.delete(k);
    },
    setItem(k: string, v: string) {
      m.set(k, v);
    },
  } as Storage;
}

describe("rpcFilterCapability cache", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", memStorage());
    resetRpcFilterCapabilityForTests();
  });

  afterEach(() => {
    resetRpcFilterCapabilityForTests();
    vi.unstubAllGlobals();
  });

  it("treats dRPC freetier code 35 as filter unsupported", () => {
    expect(
      isFilterCapabilityRpcError({
        code: 35,
        message: "method is not available on freetier",
      }),
    ).toBe(true);
  });

  it("returns filter method excludes when probe marked endpoint unsupported", () => {
    const url = "https://megaeth.drpc.org";
    globalThis.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: 1,
        entries: {
          [url]: {
            filterSupport: false,
            probedAtMs: Date.now(),
          },
        },
      }),
    );
    hydrateRpcFilterCapabilityCache();
    expect(getFilterMethodExcludesForRpcUrl(url)).toEqual([...FILTER_RPC_METHODS]);
  });

  it("needs blocking probe only when a URL has no cache entry", () => {
    const url = "https://primary.example/rpc";
    globalThis.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: 1,
        entries: {
          [url]: { filterSupport: true, probedAtMs: Date.now() },
        },
      }),
    );
    hydrateRpcFilterCapabilityCache();
    expect(urlsNeedBlockingFilterProbe([url])).toBe(false);
    expect(urlsNeedBlockingFilterProbe([url, "https://fallback.example"])).toBe(true);
  });

  it("flags URLs older than 4 hours for reprobe", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-19T12:00:00Z");
    vi.setSystemTime(now);

    const url = "https://megaeth.drpc.org";
    const probedAtMs = now.getTime() - RPC_FILTER_CAPABILITY_CACHE_TTL_MS - 1;
    globalThis.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: 1,
        entries: {
          [url]: { filterSupport: false, probedAtMs },
        },
      }),
    );
    hydrateRpcFilterCapabilityCache();

    expect(urlsNeedFilterReprobe([url])).toEqual([url]);
    expect(urlsNeedBlockingFilterProbe([url])).toBe(false);

    vi.useRealTimers();
  });
});
