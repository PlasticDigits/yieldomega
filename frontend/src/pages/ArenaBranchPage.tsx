// SPDX-License-Identifier: AGPL-3.0-only

import { Navigate, useParams } from "react-router-dom";
import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";

function tryNormalizeReferralSlug(raw: string): string | null {
  try {
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}

/**
 * Legacy `/arena/:segment` redirects to canonical `/{code}` referral paths.
 */
export function ArenaBranchPage() {
  const { arenaSegment } = useParams<{ arenaSegment: string }>();
  const s = arenaSegment?.toLowerCase() ?? "";
  if (s === "protocol") {
    return <Navigate to="/audit" replace />;
  }
  if (isReferralSlugReservedForRouting(s)) {
    return <Navigate to="/" replace />;
  }
  const code = tryNormalizeReferralSlug(s);
  if (!code) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/${encodeURIComponent(code)}`} replace />;
}
