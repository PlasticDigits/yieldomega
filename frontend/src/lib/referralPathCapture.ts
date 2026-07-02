// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";

function pathSegments(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/**
 * Extracts a referral code from the path for client capture (localStorage).
 * **Supported:** `/{code}`, legacy `/arena/{code}`, or `/timecurve/{code}` when the
 * segment is not a fixed sub-route (`protocol`, …) and not otherwise reserved.
 * Prefer `?ref=` or `/{code}` for share links.
 */
export function extractReferralCodeFromPathname(pathname: string): string | null {
  const parts = pathSegments(pathname);
  if (parts.length === 1) {
    const seg = parts[0]!;
    if (isReferralSlugReservedForRouting(seg)) {
      return null;
    }
    return tryNormalizeReferralSlug(seg);
  }
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

/** True when the pathname should use the minimal arena play shell (index or referral slug). */
export function isReferralPlayPathname(pathname: string): boolean {
  if (pathname === "/" || pathname === "/arena") {
    return true;
  }
  return extractReferralCodeFromPathname(pathname) !== null;
}

function tryNormalizeReferralSlug(raw: string): string | null {
  try {
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}
