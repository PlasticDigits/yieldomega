// SPDX-License-Identifier: AGPL-3.0-only

import { useSyncExternalStore } from "react";
import { getPendingReferralCode, subscribePendingReferralCode } from "@/lib/referralStorage";

/** Reactive read of `yieldomega.ref.v2` (updates on `?ref=`, `/{code}`, or manual clear). */
export function usePendingReferralCode(): string | null {
  return useSyncExternalStore(
    subscribePendingReferralCode,
    getPendingReferralCode,
    () => null,
  );
}
