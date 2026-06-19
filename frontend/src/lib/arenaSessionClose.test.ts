// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("arenaSessionClose (#338)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memStorage());
    vi.stubGlobal("window", {
      localStorage: memStorage(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and reads last close timestamp", async () => {
    const {
      ARENA_LAST_CLOSED_AT_KEY,
      readArenaLastClosedAt,
      writeArenaLastClosedAt,
    } = await import("./arenaSessionClose");
    expect(readArenaLastClosedAt()).toBeNull();
    writeArenaLastClosedAt(1_700_000_000_123);
    expect(readArenaLastClosedAt()).toBe(1_700_000_000_123);
    expect(localStorage.getItem(ARENA_LAST_CLOSED_AT_KEY)).toBe("1700000000123");
  });

  it("formats elapsed durations for modal copy", async () => {
    const { ARENA_SESSION_SUMMARY_MIN_ABSENT_MS, formatElapsedSinceMs } = await import(
      "./arenaSessionClose"
    );
    expect(formatElapsedSinceMs(45_000)).toBe("45s");
    expect(formatElapsedSinceMs(ARENA_SESSION_SUMMARY_MIN_ABSENT_MS)).toBe("1m");
    expect(formatElapsedSinceMs(3_700_000)).toBe("1h 1m");
    expect(formatElapsedSinceMs(90_000_000)).toBe("1d 1h");
  });

  it("registers visibility and pagehide listeners", async () => {
    const { installArenaSessionClosePersistence } = await import("./arenaSessionClose");
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      localStorage: memStorage(),
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(`window:${type}`, fn);
      },
      removeEventListener: (type: string, fn: EventListener) => {
        if (listeners.get(`window:${type}`) === fn) listeners.delete(`window:${type}`);
      },
      dispatchEvent: () => true,
    });
    vi.stubGlobal("document", {
      visibilityState: "hidden",
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(`document:${type}`, fn);
      },
      removeEventListener: (type: string, fn: EventListener) => {
        if (listeners.get(`document:${type}`) === fn) listeners.delete(`document:${type}`);
      },
      dispatchEvent: () => true,
    });

    const cleanup = installArenaSessionClosePersistence();
    const now = 1_700_000_100_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const onVisibility = listeners.get("window:visibilitychange");
    expect(onVisibility).toBeTypeOf("function");
    onVisibility?.(new Event("visibilitychange"));

    const { readArenaLastClosedAt } = await import("./arenaSessionClose");
    expect(readArenaLastClosedAt()).toBe(now);

    localStorage.clear();
    const onPageHide = listeners.get("window:pagehide");
    onPageHide?.(new Event("pagehide"));
    expect(readArenaLastClosedAt()).toBe(now);

    cleanup();
    vi.restoreAllMocks();
  });
});
