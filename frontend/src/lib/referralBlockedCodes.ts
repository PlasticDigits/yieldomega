// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeReferralCode } from "@/lib/referralCode";

/**
 * Referral slugs that must never be captured, registered, or attached to buys.
 * `yieldomega` is the product brand — common `?ref=` / path captures were never
 * registered on ReferralRegistry and caused `TimeArena: invalid referral` reverts.
 */
export const BLOCKED_REFERRAL_CODES: ReadonlySet<string> = new Set(["yieldomega"]);

/** True when a normalized slug is blocked from referral capture and buy attachment. */
export function isReferralCodeBlocked(normalizedSlug: string): boolean {
  return BLOCKED_REFERRAL_CODES.has(normalizedSlug.trim().toLowerCase());
}

/** Normalize when possible; blocked check uses lowercase slug either way. */
export function isReferralCodeBlockedRaw(raw: string): boolean {
  const t = raw.trim();
  if (!t) {
    return false;
  }
  try {
    return isReferralCodeBlocked(normalizeReferralCode(t));
  } catch {
    return isReferralCodeBlocked(t.toLowerCase());
  }
}
