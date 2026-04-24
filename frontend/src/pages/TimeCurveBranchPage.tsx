// SPDX-License-Identifier: AGPL-3.0-only

import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";

const TimeCurvePage = lazy(() => import("@/pages/TimeCurvePage").then((m) => ({ default: m.TimeCurvePage })));
const TimeCurveProtocolPage = lazy(() =>
  import("@/pages/TimeCurveProtocolPage").then((m) => ({ default: m.TimeCurveProtocolPage })),
);
const TimeCurveSimplePage = lazy(() =>
  import("@/pages/TimeCurveSimplePage").then((m) => ({ default: m.TimeCurveSimplePage })),
);

function TimeCurveRouteFallback() {
  return (
    <div className="loading-state" aria-live="polite">
      <img
        src="/art/icons/loading-mascot-ring.png"
        alt=""
        width={96}
        height={96}
        decoding="async"
      />
      <p>Loading TimeCurve route…</p>
    </div>
  );
}

/**
 * One `timecurve/:segment` route so `arena` / `protocol` are not shadowed by a
 * generic param segment (issue #43). Any other segment renders the simple sale view.
 */
export function TimeCurveBranchPage() {
  const { timecurveSegment } = useParams<{ timecurveSegment: string }>();
  const s = timecurveSegment?.toLowerCase() ?? "";
  if (s === "arena") {
    return (
      <Suspense fallback={<TimeCurveRouteFallback />}>
        <TimeCurvePage />
      </Suspense>
    );
  }
  if (s === "protocol") {
    return (
      <Suspense fallback={<TimeCurveRouteFallback />}>
        <TimeCurveProtocolPage />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<TimeCurveRouteFallback />}>
      <TimeCurveSimplePage />
    </Suspense>
  );
}
