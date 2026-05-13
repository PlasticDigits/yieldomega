// SPDX-License-Identifier: AGPL-3.0-only

import type { Page } from "@playwright/test";

/**
 * The launch gate is decided at build time via `VITE_LAUNCH_TIMESTAMP`
 * (Vite inlines `import.meta.env`). The value of `LaunchGate` therefore
 * partitions e2e specs into three runtime states:
 *
 * - `"countdown"` — `VITE_LAUNCH_TIMESTAMP` is in the future. Every route
 *   (`/`, `/timecurve`, `/rabbit-treasury`, …) renders `LaunchCountdownPage`.
 *   Tests that assume the regular `RootLayout` chrome must skip.
 * - `"post-launch"` — `VITE_LAUNCH_TIMESTAMP` is set but already in the past.
 *   Index `/` lands on `TimeCurveSimplePage` (issue #40); HomePage moves to
 *   `/home`. Secondary surfaces render normally.
 * - `"no-env"` — `VITE_LAUNCH_TIMESTAMP` is unset. The shell renders normally
 *   with HomePage at `/`; `/home` is the same hub surface (alias — GitLab #199).
 *
 * `detectLaunchState` is the single source of truth for this branching across
 * the e2e suite; new specs that assume a particular shell should call it and
 * `test.skip` when the build mismatches.
 */
export type LaunchState = "countdown" | "post-launch" | "no-env";

export async function detectLaunchState(page: Page): Promise<LaunchState> {
  await page.goto("/");
  if (await page.getByTestId("launch-countdown").isVisible().catch(() => false)) {
    return "countdown";
  }
  const homeAtRoot = await page
    .getByRole("heading", { name: "YieldOmega", level: 1 })
    .isVisible()
    .catch(() => false);
  return homeAtRoot ? "no-env" : "post-launch";
}
