// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";

function pathSegments(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/**
 * Extracts a referral code from the path for client capture (localStorage).
 * **Supported:** `/arena/{code}` or legacy `/timecurve/{code}` when the second
 * segment is not a fixed sub-route (`protocol`, …) and not otherwise reserved.
 * Prefer `?ref=` or `/arena/{code}` (GitLab #266).
 */
export function extractReferralCodeFromPathname(pathname: string): string | null {
  const parts = pathSegments(pathname);
  if (parts.length === 2) {
    const root = parts[0]!.toLowerCase();
    if (root !== "timecurve" && root !== "arena") {
      return null;
    }
    const seg = parts[1]!;
    if (isReferralSlugReservedForRouting(seg)) {
      return null;
    }
    return tryNormalizeReferralSlug(seg);
  }
  return null;
}


function tryNormalizeReferralSlug(raw: string): string | null {
  try {
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}
