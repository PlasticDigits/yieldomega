// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyReferralUrlCapture } from "@/lib/referralStorage";

/**
 * Keeps pending referral in sync when the client router moves without a full reload.
 * Initial capture still runs in `main.tsx` for the first document load.
 */
export function ReferralPathSync() {
  const { pathname, search } = useLocation();
  useLayoutEffect(() => {
    applyReferralUrlCapture(pathname, search);
  }, [pathname, search]);
  return null;
}
