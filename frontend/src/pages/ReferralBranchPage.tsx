// SPDX-License-Identifier: AGPL-3.0-only

import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralCodeBlockedRaw } from "@/lib/referralBlockedCodes";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";
import { NotFoundPage } from "@/pages/NotFoundPage";

const TimeArenaPage = lazy(() =>
  import("@/pages/TimeArenaPage").then((m) => ({ default: m.TimeArenaPage })),
);

function ReferralRouteFallback() {
  return (
    <div className="loading-state" aria-live="polite">
      <img
        src="/art/icons/loading-mascot-ring.png"
        alt=""
        width={96}
        height={96}
        decoding="async"
      />
      <p>Loading Time Arena route…</p>
    </div>
  );
}

function tryNormalizeReferralSlug(raw: string): string | null {
  try {
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}

/**
 * `/{code}` referral slugs load the play surface and capture pending referral state.
 */
export function ReferralBranchPage() {
  const { referralSegment } = useParams<{ referralSegment: string }>();
  const raw = referralSegment ?? "";
  if (
    isReferralSlugReservedForRouting(raw) ||
    isReferralCodeBlockedRaw(raw) ||
    !tryNormalizeReferralSlug(raw)
  ) {
    return <NotFoundPage />;
  }
  return (
    <Suspense fallback={<ReferralRouteFallback />}>
      <TimeArenaPage />
    </Suspense>
  );
}
