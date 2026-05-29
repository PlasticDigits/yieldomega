// SPDX-License-Identifier: AGPL-3.0-only

import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AlbumPlayerBar } from "@/audio/AlbumPlayerBar";
import { RootLayout } from "@/layout/RootLayout";
import { LaunchCountdownPage } from "@/pages/LaunchCountdownPage";
import { TimeCurveProtocolDataProvider } from "@/pages/timecurve/TimeCurveProtocolDataContext";
import { launchTimestampSec, useLaunchCountdown } from "@/lib/launchCountdown";

function lazyPage(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

const HomePage = lazyPage(() => import("@/pages/HomePage"), "HomePage");
const TimeArenaPage = lazyPage(() => import("@/pages/TimeArenaPage"), "TimeArenaPage");
const TimeCurveProtocolPage = lazyPage(
  () => import("@/pages/TimeCurveProtocolPage"),
  "TimeCurveProtocolPage",
);
const ArenaBranchPage = lazyPage(() => import("@/pages/ArenaBranchPage"), "ArenaBranchPage");
const ReferralsPage = lazyPage(() => import("@/pages/ReferralsPage"), "ReferralsPage");
const KumbayaPage = lazyPage(() => import("@/pages/KumbayaPage"), "KumbayaPage");
const SirPage = lazyPage(() => import("@/pages/SirPage"), "SirPage");
const NotFoundPage = lazyPage(() => import("@/pages/NotFoundPage"), "NotFoundPage");

function LegacyTimecurveSegmentRedirect() {
  const { timecurveSegment } = useParams<{ timecurveSegment: string }>();
  const seg = timecurveSegment?.trim() ?? "";
  if (!seg) {
    return <Navigate to="/arena" replace />;
  }
  return <Navigate to={`/arena/${encodeURIComponent(seg)}`} replace />;
}

type Surface = { path: string | undefined; element: ReactNode };

const SECONDARY_ROUTES: Surface[] = [
  { path: "referrals", element: <ReferralsPage /> },
  { path: "kumbaya", element: <KumbayaPage /> },
  { path: "sir", element: <SirPage /> },
];

/** Canonical Arena routes (#256, #266). Legacy `/timecurve/*` redirects here. */
const ARENA_ROUTES: Surface[] = [
  { path: "arena", element: <TimeArenaPage /> },
  {
    path: "arena/protocol",
    element: (
      <TimeCurveProtocolDataProvider>
        <TimeCurveProtocolPage />
      </TimeCurveProtocolDataProvider>
    ),
  },
  { path: "arena/:arenaSegment", element: <ArenaBranchPage /> },
  { path: "timecurve", element: <Navigate to="/arena" replace /> },
  { path: "timecurve/arena", element: <Navigate to="/arena" replace /> },
  {
    path: "timecurve/protocol",
    element: <Navigate to="/arena/protocol" replace />,
  },
  { path: "timecurve/:timecurveSegment", element: <LegacyTimecurveSegmentRedirect /> },
];

const ROUTES_NO_ENV: Surface[] = [
  { path: undefined, element: <HomePage /> },
  { path: "home", element: <HomePage /> },
  ...ARENA_ROUTES,
  ...SECONDARY_ROUTES,
];

const ROUTES_POST_LAUNCH: Surface[] = [
  { path: undefined, element: <TimeArenaPage /> },
  { path: "home", element: <HomePage /> },
  ...ARENA_ROUTES,
  ...SECONDARY_ROUTES,
];

function RouteFallback() {
  return (
    <div className="loading-state" aria-live="polite">
      <img
        src="/art/icons/loading-mascot-ring.png"
        alt=""
        width={96}
        height={96}
        decoding="async"
      />
      <p>Loading YieldOmega route...</p>
    </div>
  );
}

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function ShellRoutes({ surfaces }: { surfaces: Surface[] }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          {surfaces.map((route) =>
            route.path === undefined ? (
              <Route key="index" index element={lazyElement(route.element)} />
            ) : (
              <Route key={route.path} path={route.path} element={lazyElement(route.element)} />
            ),
          )}
          {/** Catch-all last so explicit routes win (GitLab #223). */}
          <Route path="*" element={lazyElement(<NotFoundPage />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function CountdownRoutes({ secondsRemaining }: { secondsRemaining: number }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <LaunchCountdownPage secondsRemaining={secondsRemaining} />
              <AlbumPlayerBar />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function GatedRoutes({ launchSec }: { launchSec: number }) {
  const { secondsRemaining, hasLaunched } = useLaunchCountdown(launchSec);
  if (!hasLaunched) {
    return <CountdownRoutes secondsRemaining={secondsRemaining} />;
  }
  return <ShellRoutes surfaces={ROUTES_POST_LAUNCH} />;
}

const LAUNCH_TIMESTAMP_SEC = launchTimestampSec();

export function LaunchGate() {
  if (LAUNCH_TIMESTAMP_SEC === undefined) {
    return <ShellRoutes surfaces={ROUTES_NO_ENV} />;
  }
  return <GatedRoutes launchSec={LAUNCH_TIMESTAMP_SEC} />;
}
