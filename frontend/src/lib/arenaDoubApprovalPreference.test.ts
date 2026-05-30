// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maxUint256 } from "viem";
import {
  CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY,
  arenaDoubApprovalAmountWei,
  readArenaDoubUnlimitedApproval,
  writeCl8yArenaUnlimitedApproval,
} from "./arenaDoubApprovalPreference";

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

describe("arenaDoubApprovalPreference", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arenaDoubApprovalAmountWei: needWei plus inclusion headroom when not unlimited", () => {
    expect(arenaDoubApprovalAmountWei(10_000n, false)).toBe(10_050n);
    expect(arenaDoubApprovalAmountWei(1234n, false)).toBe(1241n);
    expect(arenaDoubApprovalAmountWei(0n, false)).toBe(0n);
  });

  it("arenaDoubApprovalAmountWei: max when unlimited and need positive", () => {
    expect(arenaDoubApprovalAmountWei(1n, true)).toBe(maxUint256);
  });

  it("storage roundtrip", () => {
    expect(readArenaDoubUnlimitedApproval()).toBe(false);
    writeCl8yArenaUnlimitedApproval(true);
    expect(window.localStorage.getItem(CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY)).toBe("1");
    expect(readArenaDoubUnlimitedApproval()).toBe(true);
    writeCl8yArenaUnlimitedApproval(false);
    expect(window.localStorage.getItem(CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY)).toBeNull();
    expect(readArenaDoubUnlimitedApproval()).toBe(false);
  });
});
