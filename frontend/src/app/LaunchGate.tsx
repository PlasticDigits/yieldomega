// SPDX-License-Identifier: AGPL-3.0-only

import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
const TimeCurveBranchPage = lazyPage(
  () => import("@/pages/TimeCurveBranchPage"),
  "TimeCurveBranchPage",
);
const TimeCurvePage = lazyPage(() => import("@/pages/TimeCurvePage"), "TimeCurvePage");
const TimeArenaPage = lazyPage(() => import("@/pages/TimeArenaPage"), "TimeArenaPage");
const TimeCurveProtocolPage = lazyPage(
  () => import("@/pages/TimeCurveProtocolPage"),
  "TimeCurveProtocolPage",
);
const ReferralsPage = lazyPage(() => import("@/pages/ReferralsPage"), "ReferralsPage");
const KumbayaPage = lazyPage(() => import("@/pages/KumbayaPage"), "KumbayaPage");
const SirPage = lazyPage(() => import("@/pages/SirPage"), "SirPage");
const NotFoundPage = lazyPage(() => import("@/pages/NotFoundPage"), "NotFoundPage");

type Surface = { path: string | undefined; element: ReactNode };

const SECONDARY_ROUTES: Surface[] = [
  { path: "referrals", element: <ReferralsPage /> },
  { path: "kumbaya", element: <KumbayaPage /> },
  { path: "sir", element: <SirPage /> },
];

/**
 * `/timecurve` lands on the simple, first-run view (issue #40). Advanced PvP
 * lives at `/timecurve/arena`; raw onchain reads at `/timecurve/protocol`.
 * The post-launch index also lands on the simple view so the LaunchCountdown
 * → Simple handoff feels gentle.
 */
const TIMECURVE_ROUTES: Surface[] = [
  { path: "arena", element: <TimeArenaPage /> },
  { path: "timecurve/arena", element: <TimeCurvePage /> },
  { path: "timecurve/protocol", element: (
      <TimeCurveProtocolDataProvider>
        <TimeCurveProtocolPage />
      </TimeCurveProtocolDataProvider>
    ) },
  { path: "timecurve", element: <Navigate to="/arena" replace /> },
  { path: "timecurve/:timecurveSegment", element: <TimeCurveBranchPage /> },
];

const ROUTES_NO_ENV: Surface[] = [
  { path: undefined, element: <HomePage /> },
  /**
   * Hub alias: post-launch builds use `/home` for `HomePage` while `/` is
   * TimeCurve. When `VITE_LAUNCH_TIMESTAMP` is unset, `/` stays canonical for
   * the hub — still register `/home` so deep links and QA checklists do not
   * hit an empty `<Outlet />` (GitLab #199).
   */
  { path: "home", element: <HomePage /> },
  ...TIMECURVE_ROUTES,
  ...SECONDARY_ROUTES,
];

const ROUTES_POST_LAUNCH: Surface[] = [
  { path: undefined, element: <TimeArenaPage /> },
  { path: "home", element: <HomePage /> },
  ...TIMECURVE_ROUTES,
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
