// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maxUint256 } from "viem";
import {
  CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY,
  cl8yTimeCurveApprovalAmountWei,
  readCl8yTimeCurveUnlimitedApproval,
  writeCl8yTimeCurveUnlimitedApproval,
} from "./cl8yTimeCurveApprovalPreference";

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

describe("cl8yTimeCurveApprovalPreference", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cl8yTimeCurveApprovalAmountWei: exact need when not unlimited", () => {
    expect(cl8yTimeCurveApprovalAmountWei(1234n, false)).toBe(1234n);
    expect(cl8yTimeCurveApprovalAmountWei(0n, false)).toBe(0n);
  });

  it("cl8yTimeCurveApprovalAmountWei: max when unlimited and need positive", () => {
    expect(cl8yTimeCurveApprovalAmountWei(1n, true)).toBe(maxUint256);
  });

  it("storage roundtrip", () => {
    expect(readCl8yTimeCurveUnlimitedApproval()).toBe(false);
    writeCl8yTimeCurveUnlimitedApproval(true);
    expect(window.localStorage.getItem(CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY)).toBe("1");
    expect(readCl8yTimeCurveUnlimitedApproval()).toBe(true);
    writeCl8yTimeCurveUnlimitedApproval(false);
    expect(window.localStorage.getItem(CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY)).toBeNull();
    expect(readCl8yTimeCurveUnlimitedApproval()).toBe(false);
  });
});
