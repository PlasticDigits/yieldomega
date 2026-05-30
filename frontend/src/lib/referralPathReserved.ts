// SPDX-License-Identifier: AGPL-3.0-only

/**
 * First URL path segments reserved for app routing (governance-updatable on-chain set
 * is TBD; keep this list in sync when adding new top-level routes — see issue #43).
 * All comparisons use lowercase ASCII.
 */
export const APP_RESERVED_TOP_LEVEL_SEGMENTS: ReadonlySet<string> = new Set([
  "api",
  "assets",
  "collection",
  "favicon.ico",
  "home",
  "kumbaya",
  "referrals",
  "sir",
  "static",
  "timecurve",
]);

/**
 * Reserved under `/arena/...` besides product sub-routes (`arena`, `protocol`).
 * Add here if a new static `timecurve/foo` route is introduced.
 */
export const APP_RESERVED_UNDER_TIMECURVE: ReadonlySet<string> = new Set([
  "arena",
  "protocol",
]);

export function isReservedTopLevelPathSegment(segment: string): boolean {
  return APP_RESERVED_TOP_LEVEL_SEGMENTS.has(segment.trim().toLowerCase());
}

export function isReservedUnderLegacyArenaPath(segment: string): boolean {
  return APP_RESERVED_UNDER_TIMECURVE.has(segment.trim().toLowerCase());
}

/**
 * True when a normalized referral slug must not be used for path/query capture or
 * registration in the web app — same rules as the second segment of `/arena/{slug}`.
 * Input should already be normalized (lowercase `[a-z0-9]`, length 3–16).
 */
export function isReferralSlugReservedForRouting(normalizedSlug: string): boolean {
  const s = normalizedSlug.trim().toLowerCase();
  return isReservedUnderLegacyArenaPath(s) || isReservedTopLevelPathSegment(s);
}
