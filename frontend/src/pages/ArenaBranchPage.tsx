// SPDX-License-Identifier: AGPL-3.0-only

import { lazy, Suspense } from "react";
import { Navigate, useParams } from "react-router-dom";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";

const TimeArenaPage = lazy(() =>
  import("@/pages/TimeArenaPage").then((m) => ({ default: m.TimeArenaPage })),
);

function ArenaRouteFallback() {
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

/**
 * `/arena/:segment` for referral slugs. Reserved segments redirect to canonical paths.
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
  return (
    <Suspense fallback={<ArenaRouteFallback />}>
      <TimeArenaPage />
    </Suspense>
  );
}
