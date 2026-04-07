import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RootLayout } from "@/layout/RootLayout";

// SPDX-License-Identifier: AGPL-3.0-only

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
const RabbitTreasuryPage = lazyPage(
  () => import("@/pages/RabbitTreasuryPage"),
  "RabbitTreasuryPage",
);
const CollectionPage = lazyPage(() => import("@/pages/CollectionPage"), "CollectionPage");
const ReferralsPage = lazyPage(() => import("@/pages/ReferralsPage"), "ReferralsPage");
const KumbayaPage = lazyPage(() => import("@/pages/KumbayaPage"), "KumbayaPage");
const SirPage = lazyPage(() => import("@/pages/SirPage"), "SirPage");

const ROUTES = [
  { path: undefined, element: <HomePage /> },
  { path: "timecurve", element: <TimeCurvePage /> },
  { path: "rabbit-treasury", element: <RabbitTreasuryPage /> },
  { path: "collection", element: <CollectionPage /> },
  { path: "referrals", element: <ReferralsPage /> },
  { path: "kumbaya", element: <KumbayaPage /> },
  { path: "sir", element: <SirPage /> },
] as const;

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          {ROUTES.map((route) =>
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
