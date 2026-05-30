// SPDX-License-Identifier: AGPL-3.0-only
//
// CL8Y → Time Arena ERC-20 approval sizing (GitLab #143 / audit H-01 coupling).

import { useCallback, useEffect, useState } from "react";
import { maxUint256 } from "viem";

/** Local preference: opt-in unlimited `approve(TimeArena, type(uint256).max)` ([GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143)). */
export const CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY = [
  "yieldomega",
  "erc20",
  "cl8yArenaUnlimited",
  "v1",
].join(".");
const CL8Y_ARENA_UNLIMITED_APPROVAL_LEGACY_KEY = [
  "yieldomega",
  "erc20",
  "cl8yTimeCurveUnlimited",
  "v1",
].join(".");

export function readArenaDoubUnlimitedApproval(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return (
      window.localStorage.getItem(CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY) === "1" ||
      window.localStorage.getItem(CL8Y_ARENA_UNLIMITED_APPROVAL_LEGACY_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function writeCl8yArenaUnlimitedApproval(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (enabled) {
      window.localStorage.setItem(CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY, "1");
      window.localStorage.removeItem(CL8Y_ARENA_UNLIMITED_APPROVAL_LEGACY_KEY);
    } else {
      window.localStorage.removeItem(CL8Y_ARENA_UNLIMITED_APPROVAL_STORAGE_KEY);
      window.localStorage.removeItem(CL8Y_ARENA_UNLIMITED_APPROVAL_LEGACY_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Extra allowance above quoted gross CL8Y so `TimeArena.buy` still succeeds when
 * `mulDiv(charmWad, priceWad(elapsed))` ticks up between submit-time sizing and inclusion
 * (MegaETH evidence: `ERC20InsufficientAllowance` with exact approve — same root as [#82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) drift family).
 *
 * Uses the same **50 bps** scale as CHARM submit slack in `timeArenaBuySubmitSizing.ts`; no runtime RPC.
 */
export const CL8Y_ARENA_APPROVE_INCLUSION_HEADROOM_BPS = 50n;

/**
 * Size for `approve(TimeArena, amount)` on CL8Y: **`needWei` + inclusion headroom** unless unlimited is opted in (`maxUint256`).
 */
export function arenaDoubApprovalAmountWei(needWei: bigint, unlimitedPreferred: boolean): bigint {
  if (needWei <= 0n) {
    return 0n;
  }
  if (unlimitedPreferred) {
    return maxUint256;
  }
  const pad =
    (needWei * CL8Y_ARENA_APPROVE_INCLUSION_HEADROOM_BPS + 9999n) / 10000n;
  return needWei + pad;
}

export function useCl8yArenaUnlimitedApproval(): readonly [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(false);
  useEffect(() => {
    setValue(readArenaDoubUnlimitedApproval());
  }, []);
  const set = useCallback((next: boolean) => {
    writeCl8yArenaUnlimitedApproval(next);
    setValue(next);
  }, []);
  return [value, set] as const;
}
