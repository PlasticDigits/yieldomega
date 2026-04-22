// SPDX-License-Identifier: AGPL-3.0-only

import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RootLayout } from "@/layout/RootLayout";
import { LaunchCountdownPage } from "@/pages/LaunchCountdownPage";
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
const TimeCurvePage = lazyPage(() => import("@/pages/TimeCurvePage"), "TimeCurvePage");
const TimeCurveSimplePage = lazyPage(
  () => import("@/pages/TimeCurveSimplePage"),
  "TimeCurveSimplePage",
);
const TimeCurveProtocolPage = lazyPage(
  () => import("@/pages/TimeCurveProtocolPage"),
  "TimeCurveProtocolPage",
);
const RabbitTreasuryPage = lazyPage(
  () => import("@/pages/RabbitTreasuryPage"),
  "RabbitTreasuryPage",
);
const CollectionPage = lazyPage(() => import("@/pages/CollectionPage"), "CollectionPage");
const ReferralsPage = lazyPage(() => import("@/pages/ReferralsPage"), "ReferralsPage");
const KumbayaPage = lazyPage(() => import("@/pages/KumbayaPage"), "KumbayaPage");
const SirPage = lazyPage(() => import("@/pages/SirPage"), "SirPage");

type Surface = { path: string | undefined; element: ReactNode };

const SECONDARY_ROUTES: Surface[] = [
  { path: "rabbit-treasury", element: <RabbitTreasuryPage /> },
  { path: "collection", element: <CollectionPage /> },
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
  { path: "timecurve", element: <TimeCurveSimplePage /> },
  { path: "timecurve/arena", element: <TimeCurvePage /> },
  { path: "timecurve/protocol", element: <TimeCurveProtocolPage /> },
];

const ROUTES_NO_ENV: Surface[] = [
  { path: undefined, element: <HomePage /> },
  ...TIMECURVE_ROUTES,
  ...SECONDARY_ROUTES,
];

const ROUTES_POST_LAUNCH: Surface[] = [
  { path: undefined, element: <TimeCurveSimplePage /> },
  { path: "home", element: <HomePage /> },
  ...TIMECURVE_ROUTES,
  ...SECONDARY_ROUTES,
];

function RouteFallback() {
  return (
    <div className="loading-state" aria-live="polite">
      <img
        src="/art/loading-mascot.png"
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
          element={<LaunchCountdownPage secondsRemaining={secondsRemaining} />}
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
