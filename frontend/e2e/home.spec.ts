// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test, type Page } from "@playwright/test";

/**
 * Where the YieldOmega home heading lives depends on the build:
 *
 * - No `VITE_LAUNCH_TIMESTAMP`: HomePage is at `/`, no `/home` route.
 * - Past `VITE_LAUNCH_TIMESTAMP` (post-launch): `/` lands on
 *   `TimeCurveSimplePage` (issue #40); HomePage is at `/home`.
 * - Future `VITE_LAUNCH_TIMESTAMP`: every route locks behind the countdown.
 *
 * This test detects the build state and asserts the matching home shell.
 */
async function detectBuild(page: Page) {
  await page.goto("/");
  if (await page.getByTestId("launch-countdown").isVisible().catch(() => false)) {
    return "countdown" as const;
  }
  const homeAtRoot = await page
    .getByRole("heading", { name: "YieldOmega", level: 1 })
    .isVisible()
    .catch(() => false);
  return homeAtRoot ? ("no-env" as const) : ("post-launch" as const);
}

test("home shows title and nav links", async ({ page }) => {
  const state = await detectBuild(page);
  test.skip(state === "countdown", "Build is locked behind LaunchCountdownPage.");

  if (state === "post-launch") {
    await page.goto("/home");
  }
  await expect(page.getByRole("heading", { name: "YieldOmega", level: 1 })).toBeVisible();
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "TimeCurve" }),
  ).toBeVisible();
});
