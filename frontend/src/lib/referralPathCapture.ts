// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeReferralCode } from "@/lib/referralCode";
import { isReservedTopLevelPathSegment, isReservedUnderTimecurve } from "@/lib/referralPathReserved";

function pathSegments(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/**
 * Extracts a referral code from the path for client capture (localStorage).
 * **Supported:** `/timecurve/{code}` when the second segment is not a fixed
 * sub-route (`arena`, `protocol`, …) and not otherwise reserved. A root-level
 * `/{code}` path is *not* hooked up as a public route: the app needs literal
 * routes like `/home` in post-launch, and a `/:param` would collide with them
 * in the router. Prefer `?ref=`, or `/timecurve/{code}` (this shape).
 */
export function extractReferralCodeFromPathname(pathname: string): string | null {
  const parts = pathSegments(pathname);
  if (parts.length === 2 && parts[0]!.toLowerCase() === "timecurve") {
    const seg = parts[1]!;
    if (isReservedUnderTimecurve(seg)) {
      return null;
    }
    if (isReservedTopLevelPathSegment(seg)) {
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
