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

const WALLET = "0x00000000000000000000000000000000000000Aa" as `0x${string}`;

describe("referralSelfReferralPending", () => {
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

  it("purges pending when it matches my registered code for the wallet", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode, setStoredMyReferralCodeForWallet } =
      await import("./referralStorage");
    const { purgePendingReferralIfSelfReferral } = await import("./referralSelfReferralPending");

    setStoredMyReferralCodeForWallet(WALLET, "abc12");
    applyReferralUrlCapture("/", "?ref=abc12");
    expect(getPendingReferralCode()).toBe("abc12");

    expect(purgePendingReferralIfSelfReferral(WALLET)).toBe(true);
    expect(getPendingReferralCode()).toBeNull();
  });

  it("does not purge when pending is a third-party code", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode, setStoredMyReferralCodeForWallet } =
      await import("./referralStorage");
    const { purgePendingReferralIfSelfReferral } = await import("./referralSelfReferralPending");

    applyReferralUrlCapture("/", "?ref=other12");
    setStoredMyReferralCodeForWallet(WALLET, "mine12");
    expect(purgePendingReferralIfSelfReferral(WALLET)).toBe(false);
    expect(getPendingReferralCode()).toBe("other12");
  });

  it("setStoredMyReferralCodeForWallet clears matching pending without a wallet arg", async () => {
    const { applyReferralUrlCapture, getPendingReferralCode, setStoredMyReferralCodeForWallet } =
      await import("./referralStorage");

    applyReferralUrlCapture("/", "?ref=abc12");
    setStoredMyReferralCodeForWallet(WALLET, "abc12");
    expect(getPendingReferralCode()).toBeNull();
  });

  it("pendingMatchesMyReferralCode normalizes case", async () => {
    const { pendingMatchesMyReferralCode } = await import("./referralSelfReferralPending");
    expect(pendingMatchesMyReferralCode("AbC12", "abc12")).toBe(true);
    expect(pendingMatchesMyReferralCode("other", "abc12")).toBe(false);
  });
});
