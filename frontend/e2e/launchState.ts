// SPDX-License-Identifier: AGPL-3.0-only

import type { Page } from "@playwright/test";

/**
 * The launch gate is decided at build time via `VITE_LAUNCH_TIMESTAMP`
 * (Vite inlines `import.meta.env`). The value of `LaunchGate` therefore
 * partitions e2e specs into three runtime states:
 *
 * - `"countdown"` — `VITE_LAUNCH_TIMESTAMP` is in the future. Every route
 *   (`/`, `/timecurve`, `/arena`, …) renders `LaunchCountdownPage`.
 *   Tests that assume the regular `RootLayout` chrome must skip.
 * - `"post-launch"` — `VITE_LAUNCH_TIMESTAMP` is set but already in the past.
 *   Index `/` lands on `ArenaSimplePage` (issue #40); HomePage moves to
 *   `/home`. Secondary surfaces render normally.
 * - `"no-env"` — `VITE_LAUNCH_TIMESTAMP` is unset. Routing matches post-launch:
 *   index `/` lands on `ArenaSimplePage`; HomePage lives at `/home`.
 *
 * `detectLaunchState` is the single source of truth for this branching across
 * the e2e suite; new specs that assume a particular shell should call it and
 * `test.skip` when the build mismatches.
 */
export type LaunchState = "countdown" | "post-launch" | "no-env";

export async function detectLaunchState(page: Page): Promise<LaunchState> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () =>
        Boolean(
          document.querySelector('[data-testid="launch-countdown"]') ||
            document.querySelector('[data-testid="arena-command-console"]') ||
            document.querySelector('[data-testid="time-arena-page-mounted"]') ||
            document.querySelector('main [aria-label="Primary"]') ||
            document.querySelector("main h1"),
        ),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {});
  if (await page.getByTestId("launch-countdown").isVisible().catch(() => false)) {
    return "countdown";
  }
  const arenaAtRoot = await page.getByTestId("arena-command-console").isVisible().catch(() => false);
  if (arenaAtRoot) {
    return "post-launch";
  }
  return "no-env";
}
