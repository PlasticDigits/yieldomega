// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getPendingReferralCode, shouldShowPendingPill } from "@/lib/referralStorage";

/**
 * Footer pill showing the browser-locked pending referral code on `/referrals`
 * (GitLab #205).
 *
 * - Reads `yieldomega.ref.v1` via `getPendingReferralCode()` so the same
 *   normalization / cross-store sync used by the rest of the app applies here.
 * - Subscribes to the `storage` event so the pill stays accurate when other tabs
 *   capture a new `?ref=` (cross-tab) and refreshes on route navigation in the
 *   same tab (handled by location dep).
 * - Renders nothing when there is no pending code or we are off the referrals
 *   page (per acceptance criteria: omit rather than show empty muted state).
 */
export function ReferralsFooterPendingPill() {
  const location = useLocation();
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    setPendingCode(getPendingReferralCode());
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "yieldomega.ref.v1") {
        setPendingCode(getPendingReferralCode());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!shouldShowPendingPill(location.pathname, pendingCode)) {
    return null;
  }

  return (
    <span
      className="footer-link-pill"
      data-testid="referrals-footer-pending-pill"
      aria-label={`Pending referral code: ${pendingCode}`}
      title="This code will apply on your next qualifying buy"
    >
      Pending ref: <strong>{pendingCode}</strong>
    </span>
  );
}
