// SPDX-License-Identifier: AGPL-3.0-only
//
// CL8Y → TimeCurve ERC-20 approval sizing (GitLab #143 / audit H-01 coupling).

import { useCallback, useEffect, useState } from "react";
import { maxUint256 } from "viem";

/** Local preference: opt-in unlimited `approve(TimeCurve, type(uint256).max)` ([GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)). */
export const CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY =
  "yieldomega.erc20.cl8yTimeCurveUnlimited.v1";

export function readCl8yTimeCurveUnlimitedApproval(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCl8yTimeCurveUnlimitedApproval(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (enabled) {
      window.localStorage.setItem(CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(CL8Y_TIMECURVE_UNLIMITED_APPROVAL_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Size for `approve(TimeCurve, amount)` on CL8Y. Exact `needWei` by default; `maxUint256` only when opted in.
 */
export function cl8yTimeCurveApprovalAmountWei(needWei: bigint, unlimitedPreferred: boolean): bigint {
  if (needWei <= 0n) {
    return 0n;
  }
  return unlimitedPreferred ? maxUint256 : needWei;
}

export function useCl8yTimeCurveUnlimitedApproval(): readonly [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(false);
  useEffect(() => {
    setValue(readCl8yTimeCurveUnlimitedApproval());
  }, []);
  const set = useCallback((next: boolean) => {
    writeCl8yTimeCurveUnlimitedApproval(next);
    setValue(next);
  }, []);
  return [value, set] as const;
}
