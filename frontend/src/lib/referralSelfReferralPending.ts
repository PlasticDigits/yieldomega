// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeReferralCode } from "@/lib/referralCode";
import {
  clearPendingReferralCode,
  getPendingReferralCode,
  getStoredMyReferralCodeForWallet,
} from "@/lib/referralStorage";

/** True when `pending` normalizes to the same slug as the wallet's cached registered code. */
export function pendingMatchesMyReferralCode(
  pending: string,
  myCode: string | null | undefined,
): boolean {
  if (!myCode?.trim() || !pending.trim()) {
    return false;
  }
  try {
    return normalizeReferralCode(pending) === normalizeReferralCode(myCode);
  } catch {
    return false;
  }
}

/**
 * Drop `yieldomega.ref.v1` when the pending slug is the connected wallet's own code
 * ([GitLab #222](https://gitlab.com/PlasticDigits/yieldomega/-/issues/222)).
 *
 * @returns whether pending storage was cleared
 */
export function purgePendingReferralIfSelfReferral(
  wallet: `0x${string}` | undefined,
): boolean {
  if (!wallet) {
    return false;
  }
  const pending = getPendingReferralCode();
  if (!pending?.trim()) {
    return false;
  }
  const mine = getStoredMyReferralCodeForWallet(wallet);
  if (!pendingMatchesMyReferralCode(pending, mine)) {
    return false;
  }
  clearPendingReferralCode();
  return true;
}
