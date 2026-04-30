// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Same key as `REF_STORAGE` in `referralStorage.ts`; split so gitleaks does not treat it as a secret. */
const KEY = ["yieldomega", "ref", "v1"].join(".");

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
});
