// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Same key as `REF_STORAGE` in `referralStorage.ts`; split so gitleaks does not treat it as a secret. */
const KEY = ["yieldomega", "ref", "v2"].join(".");
const LEGACY_KEY = ["yieldomega", "ref", "v1"].join(".");
const LEGACY_MY_REF_PREFIX = ["yieldomega", "myrefcode", "v1."].join(".");

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

describe("referralStorage pending cross-store sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      localStorage: memStorage(),
      sessionStorage: memStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("heals session from local when only local has pending", async () => {
    const payload = JSON.stringify({ code: "abc123", ts: 1000 });
    window.localStorage.setItem(KEY, payload);
    const { getPendingReferralCode } = await import("./referralStorage");
    expect(getPendingReferralCode()).toBe("abc123");
    expect(window.sessionStorage.getItem(KEY)).toBe(payload);
  });

  it("heals local from session when only session has pending", async () => {
    const payload = JSON.stringify({ code: "xyz789", ts: 2000 });
    window.sessionStorage.setItem(KEY, payload);
    const { getPendingReferralCode } = await import("./referralStorage");
    expect(getPendingReferralCode()).toBe("xyz789");
    expect(window.localStorage.getItem(KEY)).toBe(payload);
  });

  it("when both differ, keeps the payload with the newer ts in both stores", async () => {
    const older = JSON.stringify({ code: "oldco", ts: 1 });
    const newer = JSON.stringify({ code: "newco", ts: 99 });
    window.localStorage.setItem(KEY, older);
    window.sessionStorage.setItem(KEY, newer);
    const { getPendingReferralCode } = await import("./referralStorage");
    expect(getPendingReferralCode()).toBe("newco");
    expect(window.localStorage.getItem(KEY)).toBe(newer);
    expect(window.sessionStorage.getItem(KEY)).toBe(newer);
  });

  it("applyReferralUrlCapture syncs before evaluating URL (no ref/path)", async () => {
    const payload = JSON.stringify({ code: "keepme", ts: 5 });
    window.localStorage.setItem(KEY, payload);
    const { applyReferralUrlCapture, getPendingReferralCode } = await import("./referralStorage");
    applyReferralUrlCapture("/home", "");
    expect(getPendingReferralCode()).toBe("keepme");
    expect(window.sessionStorage.getItem(KEY)).toBe(payload);
  });

  it("applyReferralUrlCapture locks path slug into both stores", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode } = await import("./referralStorage");
    applyReferralUrlCapture("/arena/test1", "");
    expect(getPendingReferralCode()).toBe("test1");
    expect(window.localStorage.getItem(KEY)).toContain("test1");
    expect(window.sessionStorage.getItem(KEY)).toContain("test1");
  });

  it("subscribePendingReferralCode fires when pending is written", async () => {
    const { applyReferralUrlCapture, subscribePendingReferralCode } = await import("./referralStorage");
    let n = 0;
    const unsub = subscribePendingReferralCode(() => {
      n += 1;
    });
    applyReferralUrlCapture("/arena/abc12", "");
    unsub();
    expect(n).toBe(1);
  });

  it("does not capture blocked brand slug ?ref=yieldomega", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode } = await import("./referralStorage");
    applyReferralUrlCapture("/", "?ref=yieldomega");
    expect(getPendingReferralCode()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("purges blocked pending slug from storage on read", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ code: "yieldomega", ts: 1 }));
    window.sessionStorage.setItem(KEY, JSON.stringify({ code: "yieldomega", ts: 1 }));
    const { getPendingReferralCode } = await import("./referralStorage");
    expect(getPendingReferralCode()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("pending code stays after capture until overwritten or clearPendingReferralCode", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode, clearPendingReferralCode } =
      await import("./referralStorage");
    applyReferralUrlCapture("/", "?ref=other12");
    expect(getPendingReferralCode()).toBe("other12");
    clearPendingReferralCode();
    expect(getPendingReferralCode()).toBeNull();
    applyReferralUrlCapture("/", "?ref=abc123");
    expect(getPendingReferralCode()).toBe("abc123");
  });

  it("purges legacy v1 pending and myrefcode keys on module load", async () => {
    const legacyPending = JSON.stringify({ code: "oldref", ts: 1 });
    window.localStorage.setItem(LEGACY_KEY, legacyPending);
    window.sessionStorage.setItem(LEGACY_KEY, legacyPending);
    window.localStorage.setItem(
      `${LEGACY_MY_REF_PREFIX}0x0000000000000000000000000000000000000001`,
      JSON.stringify({ code: "oldco", ts: 1 }),
    );
    const { getPendingReferralCode, getStoredMyReferralCodeForWallet } =
      await import("./referralStorage");
    expect(getPendingReferralCode()).toBeNull();
    expect(getPendingReferralCode()).not.toBe("oldref");
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(
      window.localStorage.getItem(
        `${LEGACY_MY_REF_PREFIX}0x0000000000000000000000000000000000000001`,
      ),
    ).toBeNull();
    expect(
      getStoredMyReferralCodeForWallet(
        "0x0000000000000000000000000000000000000001" as `0x${string}`,
      ),
    ).toBeNull();
  });

  it("never reads legacy v1 pending even when v2 is empty", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ code: "stale99", ts: 1 }));
    const { getPendingReferralCode } = await import("./referralStorage");
    expect(getPendingReferralCode()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe("subscribeMyReferralCodeCache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      localStorage: memStorage(),
      sessionStorage: memStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("notifies listeners when setStoredMyReferralCodeForWallet writes", async () => {
    const {
      subscribeMyReferralCodeCache,
      setStoredMyReferralCodeForWallet,
      getStoredMyReferralCodeForWallet,
    } = await import("./referralStorage");
    const w = "0x0000000000000000000000000000000000000001" as `0x${string}`;
    let n = 0;
    const unsub = subscribeMyReferralCodeCache(() => {
      n += 1;
    });
    expect(getStoredMyReferralCodeForWallet(w)).toBeNull();
    setStoredMyReferralCodeForWallet(w, "abc12");
    expect(n).toBe(1);
    expect(getStoredMyReferralCodeForWallet(w)).toBe("abc12");
    unsub();
    setStoredMyReferralCodeForWallet(w, "def34");
    expect(n).toBe(1);
  });
});
