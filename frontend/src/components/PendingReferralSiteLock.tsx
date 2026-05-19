// SPDX-License-Identifier: AGPL-3.0-only

import { usePendingReferralCode } from "@/hooks/usePendingReferralCode";

/**
 * Site-wide affordance when a referral slug is locked in browser storage
 * (`yieldomega.ref.v1`) — wallet not required.
 */
export function PendingReferralSiteLock() {
  const code = usePendingReferralCode();
  if (!code) {
    return null;
  }

  return (
    <div
      className="pending-referral-site-lock"
      data-testid="pending-referral-site-lock"
      role="status"
      aria-live="polite"
    >
      <span className="footer-link-pill pending-referral-site-lock__pill">
        Referral locked: <strong>{code}</strong>
      </span>
      <span className="pending-referral-site-lock__hint muted">
        Saved in this browser for your next buy
      </span>
    </div>
  );
}
