// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect } from "react";
import {
  purgePendingReferralIfBlocked,
  subscribePendingReferralCode,
} from "@/lib/referralStorage";

/** Clears blocked pending slugs (e.g. `yieldomega`) on load and when pending storage changes. */
export function ReferralBlockedCodePurge() {
  useLayoutEffect(() => {
    purgePendingReferralIfBlocked();
  }, []);

  useLayoutEffect(() => {
    const run = () => {
      purgePendingReferralIfBlocked();
    };
    return subscribePendingReferralCode(run);
  }, []);

  return null;
}
